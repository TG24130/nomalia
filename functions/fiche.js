/**
 * fiche.js — Cloud Function `genererFiche`.
 *
 * Renvoie la fiche pratique en 10 points d'une destination, depuis le cache
 * Firestore si elle y est encore valide, sinon en interrogeant l'API Claude
 * avec l'outil de recherche web. Hors du français, la fiche française est
 * traduite (voir traduction.js).
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';

import { CLE_ANTHROPIC, cleFiche, ecrireCache, lireCache, verifierAcces } from './commun.js';
import { demanderJson } from './claude.js';
import { LANGUE_GENERATION, traduire } from './traduction.js';
import { SYSTEME_FICHE, promptFiche } from './prompts/fiche.js';
import { SCHEMA_FICHE, validerFiche } from './schemas/fiche.js';

/** Langues acceptées en entrée (seul `fr` est servi en V0). */
const LANGUES = ['fr', 'en', 'es', 'zh'];

/**
 * Valide les paramètres reçus du front.
 * @param {object} donnees
 * @returns {{ destination: string, mois: number, langue: string, nationalite: string }}
 */
function lireParametres(donnees) {
  const destination = String(donnees?.destination ?? '').trim();
  const mois = Number(donnees?.mois);
  const langue = String(donnees?.langue ?? 'fr');
  const nationalite = String(donnees?.nationalite ?? 'FR').toUpperCase();

  if (destination.length < 2 || destination.length > 120) {
    throw new HttpsError('invalid-argument', 'Destination invalide.');
  }
  if (!Number.isInteger(mois) || mois < 1 || mois > 12) {
    throw new HttpsError('invalid-argument', 'Mois invalide.');
  }
  if (!LANGUES.includes(langue)) {
    throw new HttpsError('invalid-argument', 'Langue non prise en charge.');
  }
  if (!/^[A-Z]{2}$/.test(nationalite)) {
    throw new HttpsError('invalid-argument', 'Nationalité invalide.');
  }

  return { destination, mois, langue, nationalite };
}

/**
 * Recale la température de la mer du mois de voyage sur le tableau mensuel.
 *
 * Le champ s'appelle `moisChoisi` mais contient une température : le modèle y
 * a déjà écrit le numéro du mois. Le tableau des douze moyennes fait foi, car
 * il est explicitement demandé mois par mois.
 *
 * @param {object} fiche
 * @param {number} mois 1 à 12
 */
function recalerTemperatureMer(fiche, mois) {
  const mer = fiche.points?.temperatureMer;
  if (!mer || !Array.isArray(mer.parMois) || mer.parMois.length !== 12) return;

  const attendue = mer.parMois[mois - 1];
  if (typeof attendue !== 'number' || mer.moisChoisi === attendue) return;

  logger.warn('Température de la mer incohérente, recalée sur le tableau mensuel', {
    annoncee: mer.moisChoisi,
    retenue: attendue,
    mois,
  });
  mer.moisChoisi = attendue;
}

/**
 * `genererFiche({ destination, mois, langue, nationalite })`
 *
 * @returns {Promise<{ ficheId: string, fiche: object, depuisCache: boolean }>}
 */
export const genererFiche = onCall(
  { secrets: [CLE_ANTHROPIC], timeoutSeconds: 300 },
  async (requete) => {
    await verifierAcces(requete);

    const parametres = lireParametres(requete.data);
    return obtenirFiche(parametres);
  }
);

/**
 * Fiche d'une destination dans une langue : depuis le cache, sinon générée en
 * français, puis traduite pour les autres langues.
 *
 * @param {{ destination: string, mois: number, langue: string, nationalite: string }} parametres
 * @returns {Promise<{ ficheId: string, fiche: object, depuisCache: boolean }>}
 */
async function obtenirFiche(parametres) {
  const ficheId = cleFiche(parametres.destination, parametres.mois, parametres.langue, parametres.nationalite);

  // Le cache passe avant tout appel à l'API (CLAUDE.md §9).
  const enCache = await lireCache('fiches', ficheId);
  if (enCache) {
    logger.info('Fiche servie depuis le cache', { ficheId });
    return { ficheId, fiche: enCache.fiche, depuisCache: true };
  }

  const journal = { fonction: 'genererFiche', destination: parametres.destination };
  let fiche;

  if (parametres.langue === LANGUE_GENERATION) {
    fiche = await demanderJson({
      systeme: SYSTEME_FICHE,
      prompt: promptFiche(parametres),
      schema: SCHEMA_FICHE,
      valider: validerFiche,
      journal,
    });
    recalerTemperatureMer(fiche, parametres.mois);
  } else {
    const francaise = await obtenirFiche({ ...parametres, langue: LANGUE_GENERATION });
    try {
      fiche = await traduire({
        donnees: francaise.fiche,
        schema: SCHEMA_FICHE,
        valider: validerFiche,
        langue: parametres.langue,
        journal,
      });
    } catch (erreur) {
      // Mieux vaut le français qu'une erreur. Rien n'est mis en cache sous
      // cette langue : la traduction sera retentée à la prochaine demande.
      logger.warn('Traduction impossible, fiche servie en français', { ficheId, erreur: erreur.message });
      return { ficheId, fiche: francaise.fiche, depuisCache: false };
    }
  }

  await ecrireCache('fiches', ficheId, {
    fiche,
    destinationNormalisee: ficheId.split('_')[0],
    mois: parametres.mois,
    langue: parametres.langue,
  });

  logger.info('Fiche générée et mise en cache', { ficheId });
  return { ficheId, fiche, depuisCache: false };
}
