/**
 * lieux.js — Cloud Function `genererLieux`.
 *
 * Renvoie cinq plages ou cinq incontournables d'une destination, selon le
 * type de séjour choisi au tiroir 4, depuis le cache Firestore si la liste y
 * est encore valide (CLAUDE.md §6, tiroir 4).
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { FieldValue } from 'firebase-admin/firestore';

import {
  CLE_ANTHROPIC,
  db,
  DUREE_CACHE_MS,
  MODELE_CLAUDE,
  normaliser,
  verifierAcces,
  VERSION_CACHE,
} from './commun.js';
import { demanderJson } from './claude.js';
import { SYSTEME_LIEUX, promptLieux } from './prompts/lieux.js';
import { NOMBRE_LIEUX, SCHEMA_LIEUX, TYPES_LIEUX, validerLieux } from './schemas/lieux.js';

/** Langues acceptées en entrée (seul `fr` est servi en V0). */
const LANGUES = ['fr', 'en', 'es', 'zh'];

/**
 * Valide les paramètres reçus du front.
 * @param {object} donnees
 * @returns {object} paramètres normalisés
 */
function lireParametres(donnees) {
  const destination = String(donnees?.destination ?? '').trim();
  const type = String(donnees?.type ?? '');
  const mois = Number(donnees?.mois);
  const langue = String(donnees?.langue ?? 'fr');

  const adultes = Number(donnees?.voyageurs?.adultes ?? 2);
  const enfants = Number(donnees?.voyageurs?.enfants ?? 0);

  if (destination.length < 2 || destination.length > 120) {
    throw new HttpsError('invalid-argument', 'Destination invalide.');
  }
  if (!TYPES_LIEUX.includes(type)) {
    throw new HttpsError('invalid-argument', 'Type de lieux invalide.');
  }
  if (!Number.isInteger(mois) || mois < 1 || mois > 12) {
    throw new HttpsError('invalid-argument', 'Mois invalide.');
  }
  if (!LANGUES.includes(langue)) {
    throw new HttpsError('invalid-argument', 'Langue non prise en charge.');
  }

  return {
    destination,
    type,
    mois,
    langue,
    nombre: NOMBRE_LIEUX,
    voyageurs: {
      adultes: Number.isInteger(adultes) && adultes > 0 ? adultes : 2,
      enfants: Number.isInteger(enfants) && enfants >= 0 ? enfants : 0,
    },
  };
}

/**
 * Clé de cache : destination, type de liste, mois et langue.
 *
 * Le nombre d'enfants n'entre pas dans la clé : il nuance les conseils sans
 * changer la sélection, et le faire varier multiplierait les appels.
 *
 * @param {object} parametres
 * @returns {string}
 */
function cleLieux({ destination, type, mois, langue }) {
  return `${normaliser(destination)}_${type}_${String(mois).padStart(2, '0')}_${langue}`;
}

/**
 * `genererLieux({ destination, type, mois, langue, voyageurs })`
 *
 * @returns {Promise<{ cle: string, lieux: Array<object>, sources: string[], depuisCache: boolean }>}
 */
export const genererLieux = onCall(
  { secrets: [CLE_ANTHROPIC], timeoutSeconds: 300 },
  async (requete) => {
    await verifierAcces(requete);

    const parametres = lireParametres(requete.data);
    const cle = cleLieux(parametres);

    // Le cache passe avant tout appel à l'API (CLAUDE.md §9).
    const enCache = await db.collection('lieux').doc(cle).get();

    if (enCache.exists) {
      const donnees = enCache.data();
      const expiree = donnees.expireLe?.toMillis?.() < Date.now();
      // Une entrée écrite sous un autre contrat est régénérée (voir
      // VERSION_CACHE dans commun.js).
      const perimee = donnees.version !== VERSION_CACHE;

      if (!expiree && !perimee) {
        logger.info('Lieux servis depuis le cache', { cle });
        return { cle, lieux: donnees.lieux, sources: donnees.sources, depuisCache: true };
      }
    }

    const resultat = await demanderJson({
      systeme: SYSTEME_LIEUX,
      prompt: promptLieux(parametres),
      schema: SCHEMA_LIEUX,
      valider: validerLieux,
      // Mesuré sur le même cas — Népal, incontournables :
      //   5 recherches, effort medium : 610 s, 234 000 tokens d'entrée
      //   2 recherches, effort low    :  42 s,  31 000 tokens d'entrée
      // Les cinq mêmes lieux dans les deux cas. Sans budget explicite,
      // demanderJson en accordait six par défaut, et le modèle vérifiait
      // chaque lieu puis chaque tarif l'un après l'autre.
      effort: 'low',
      maxRecherches: 2,
      journal: {
        fonction: 'genererLieux',
        destination: parametres.destination,
        type: parametres.type,
      },
    });

    // Le modèle en renvoie parfois un de plus ou un de moins : on s'en tient
    // au nombre demandé plutôt que de rejeter une liste par ailleurs correcte.
    const lieux = resultat.lieux.slice(0, NOMBRE_LIEUX);
    const sources = Array.isArray(resultat.sources) ? resultat.sources : [];

    // Voir randos.js : une liste vide n'est pas mise en cache.
    if (lieux.length === 0) {
      logger.info('Aucun lieu pour cette demande', { cle });
      return { cle, lieux, sources, depuisCache: false };
    }

    await db.collection('lieux').doc(cle).set({
      lieux,
      sources,
      destinationNormalisee: normaliser(parametres.destination),
      type: parametres.type,
      mois: parametres.mois,
      langue: parametres.langue,
      modele: MODELE_CLAUDE,
      version: VERSION_CACHE,
      genereLe: FieldValue.serverTimestamp(),
      expireLe: new Date(Date.now() + DUREE_CACHE_MS),
    });

    logger.info('Lieux générés et mis en cache', { cle, nombre: lieux.length });
    return { cle, lieux, sources, depuisCache: false };
  }
);
