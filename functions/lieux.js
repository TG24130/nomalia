/**
 * lieux.js — Cloud Function `genererLieux`.
 *
 * Renvoie cinq lieux d'une destination, selon le type de séjour choisi au
 * tiroir 4, depuis le cache Firestore si la liste y est encore valide
 * (CLAUDE.md §6, tiroir 4). Hors du français, la liste française est
 * traduite (voir traduction.js).
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';

import { CLE_ANTHROPIC, ecrireCache, lireCache, normaliser, verifierAcces } from './commun.js';
import { demanderJson } from './claude.js';
import { LANGUE_GENERATION, traduire } from './traduction.js';
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
    return obtenirLieux(parametres);
  }
);

/**
 * Liste dans une langue : depuis le cache, sinon générée en français, puis
 * traduite pour les autres langues (voir traduction.js).
 *
 * @param {object} parametres paramètres validés
 * @returns {Promise<{ cle: string, lieux: Array<object>, sources: string[], depuisCache: boolean }>}
 */
async function obtenirLieux(parametres) {
  const cle = cleLieux(parametres);

  // Le cache passe avant tout appel à l'API (CLAUDE.md §9).
  const enCache = await lireCache('lieux', cle);
  if (enCache) {
    logger.info('Lieux servis depuis le cache', { cle });
    return { cle, lieux: enCache.lieux, sources: enCache.sources, depuisCache: true };
  }

  let lieux;
  let sources;

  if (parametres.langue === LANGUE_GENERATION) {
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

    lieux = resultat.lieux.slice(0, NOMBRE_LIEUX);
    sources = Array.isArray(resultat.sources) ? resultat.sources : [];
  } else {
    const francaise = await obtenirLieux({ ...parametres, langue: LANGUE_GENERATION });
    lieux = francaise.lieux;
    sources = francaise.sources;

    if (lieux.length > 0) {
      try {
        const traduite = await traduire({
          donnees: { destination: parametres.destination, lieux, sources },
          schema: SCHEMA_LIEUX,
          valider: validerLieux,
          langue: parametres.langue,
          journal: { fonction: 'genererLieux', destination: parametres.destination, type: parametres.type },
        });
        lieux = traduite.lieux;
      } catch (erreur) {
        // Mieux vaut le français qu'une erreur. Rien n'est mis en cache sous
        // cette langue : la traduction sera retentée à la prochaine demande.
        logger.warn('Traduction impossible, liste servie en français', { cle, erreur: erreur.message });
        return { cle, lieux, sources, depuisCache: false };
      }
    }
  }

  // Une liste vide n'est pas mise en cache : elle tient souvent à des
  // critères trop serrés, et la figer trente jours interdirait de retrouver
  // quoi que ce soit avec les mêmes critères élargis entre-temps.
  if (lieux.length === 0) {
    logger.info('Liste vide pour cette demande', { cle });
    return { cle, lieux, sources, depuisCache: false };
  }

  await ecrireCache('lieux', cle, {
    lieux,
    sources,
    destinationNormalisee: normaliser(parametres.destination),
    type: parametres.type,
    mois: parametres.mois,
    langue: parametres.langue,
  });

  logger.info('Lieux générés et mis en cache', { cle, nombre: lieux.length });
  return { cle, lieux, sources, depuisCache: false };
}
