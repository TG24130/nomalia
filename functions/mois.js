/**
 * mois.js — Cloud Function `conseillerMois`.
 *
 * Conseille, dès la saisie, le mois le moins cher et le mois au meilleur
 * climat pour une destination. Réponse de mémoire, sans recherche web : elle
 * doit arriver en quelques secondes, pendant que l'utilisateur remplit le
 * formulaire. Les deux conseils sont demandés ensemble et mis en cache par
 * destination, pour que passer de l'un à l'autre ne coûte rien.
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
import { SYSTEME_CONSEIL_MOIS, promptConseilMois } from './prompts/mois.js';
import { SCHEMA_CONSEIL_MOIS, validerConseilMois } from './schemas/mois.js';

/** Langues acceptées en entrée (seul `fr` est servi en V0). */
const LANGUES = ['fr', 'en', 'es', 'zh'];

/**
 * Valide les paramètres reçus du front.
 * @param {object} donnees
 * @returns {{ destination: string, langue: string }}
 */
function lireParametres(donnees) {
  const destination = String(donnees?.destination ?? '').trim();
  const langue = String(donnees?.langue ?? 'fr');

  if (destination.length < 2 || destination.length > 120) {
    throw new HttpsError('invalid-argument', 'Destination invalide.');
  }
  if (!LANGUES.includes(langue)) {
    throw new HttpsError('invalid-argument', 'Langue non prise en charge.');
  }

  return { destination, langue };
}

/**
 * `conseillerMois({ destination, langue })`
 *
 * @returns {Promise<{ moinsCher: { mois: number, raison: string },
 *                     meilleurClimat: { mois: number, raison: string },
 *                     depuisCache: boolean }>}
 */
export const conseillerMois = onCall(
  { secrets: [CLE_ANTHROPIC], timeoutSeconds: 60 },
  async (requete) => {
    await verifierAcces(requete);

    const parametres = lireParametres(requete.data);
    const cle = `${normaliser(parametres.destination)}_${parametres.langue}`;

    const enCache = await db.collection('conseilsMois').doc(cle).get();

    if (enCache.exists) {
      const donnees = enCache.data();
      const expiree = donnees.expireLe?.toMillis?.() < Date.now();
      const perimee = donnees.version !== VERSION_CACHE;

      if (!expiree && !perimee) {
        logger.info('Conseil de mois servi depuis le cache', { cle });
        return { moinsCher: donnees.moinsCher, meilleurClimat: donnees.meilleurClimat, depuisCache: true };
      }
    }

    const resultat = await demanderJson({
      systeme: SYSTEME_CONSEIL_MOIS,
      prompt: promptConseilMois(parametres),
      schema: SCHEMA_CONSEIL_MOIS,
      valider: validerConseilMois,
      effort: 'low',
      maxRecherches: 0,
      journal: { fonction: 'conseillerMois', destination: parametres.destination },
    });

    const { moinsCher, meilleurClimat } = resultat;

    await db.collection('conseilsMois').doc(cle).set({
      moinsCher,
      meilleurClimat,
      destinationNormalisee: normaliser(parametres.destination),
      langue: parametres.langue,
      modele: MODELE_CLAUDE,
      version: VERSION_CACHE,
      genereLe: FieldValue.serverTimestamp(),
      expireLe: new Date(Date.now() + DUREE_CACHE_MS),
    });

    logger.info('Conseil de mois généré et mis en cache', { cle });
    return { moinsCher, meilleurClimat, depuisCache: false };
  }
);
