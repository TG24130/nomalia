/**
 * randos.js — Cloud Function `genererRandos`.
 *
 * Renvoie jusqu'à cinq randonnées correspondant aux critères choisis au
 * tiroir 5, depuis le cache Firestore si la liste y est encore valide
 * (CLAUDE.md §6, tiroir 5).
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';

import { CLE_ANTHROPIC, ecrireCache, lireCache, normaliser, verifierAcces } from './commun.js';
import { demanderJson } from './claude.js';
import { LANGUE_GENERATION, traduire } from './traduction.js';
import { SYSTEME_RANDOS, promptRandos } from './prompts/randos.js';
import { NIVEAUX, NOMBRE_RANDOS, SCHEMA_RANDOS, validerRandos } from './schemas/randos.js';

/** Langues acceptées en entrée (seul `fr` est servi en V0). */
const LANGUES = ['fr', 'en', 'es', 'zh'];

/** Bornes des critères numériques. */
const BORNES = {
  dureeMax: { min: 1, max: 12 },
  deniveleMax: { min: 50, max: 3000 },
};

/**
 * Lit un critère numérique facultatif.
 * @param {unknown} valeur
 * @param {{ min: number, max: number }} bornes
 * @returns {number|null}
 */
function lireNombreFacultatif(valeur, bornes) {
  if (valeur === null || valeur === undefined || valeur === '') return null;

  const nombre = Number(valeur);
  if (!Number.isFinite(nombre)) return null;

  return Math.min(Math.max(Math.round(nombre), bornes.min), bornes.max);
}

/**
 * Valide les paramètres reçus du front.
 * @param {object} donnees
 * @returns {object} paramètres normalisés
 */
function lireParametres(donnees) {
  const destination = String(donnees?.destination ?? '').trim();
  const mois = Number(donnees?.mois);
  const langue = String(donnees?.langue ?? 'fr');
  const niveau = donnees?.niveau ? String(donnees.niveau) : null;

  if (destination.length < 2 || destination.length > 120) {
    throw new HttpsError('invalid-argument', 'Destination invalide.');
  }
  if (!Number.isInteger(mois) || mois < 1 || mois > 12) {
    throw new HttpsError('invalid-argument', 'Mois invalide.');
  }
  if (!LANGUES.includes(langue)) {
    throw new HttpsError('invalid-argument', 'Langue non prise en charge.');
  }
  if (niveau !== null && !NIVEAUX.includes(niveau)) {
    throw new HttpsError('invalid-argument', 'Niveau invalide.');
  }

  // `boucle` a trois états : uniquement des boucles, uniquement des
  // aller-retours, ou indifférent.
  const boucle = ['oui', 'non'].includes(donnees?.boucle) ? donnees.boucle : null;

  return {
    destination,
    mois,
    langue,
    niveau,
    boucle,
    nombre: NOMBRE_RANDOS,
    dureeMax: lireNombreFacultatif(donnees?.dureeMax, BORNES.dureeMax),
    deniveleMax: lireNombreFacultatif(donnees?.deniveleMax, BORNES.deniveleMax),
    adapteeEnfants: donnees?.adapteeEnfants === true,
  };
}

/**
 * Clé de cache : destination, saison, langue et critères.
 *
 * Les critères entrent dans la clé parce qu'ils changent la sélection
 * elle-même, contrairement au nombre d'enfants pour les lieux.
 *
 * @param {object} parametres
 * @returns {string}
 */
function cleRandos({ destination, mois, langue, niveau, dureeMax, deniveleMax, boucle, adapteeEnfants }) {
  const criteres = [
    niveau ?? 'tous',
    dureeMax ? `${dureeMax}h` : 'sansduree',
    deniveleMax ? `${deniveleMax}m` : 'sansdenivele',
    boucle === 'oui' ? 'boucle' : boucle === 'non' ? 'allerretour' : 'libre',
    adapteeEnfants ? 'enfants' : 'adultes',
  ].join('-');

  return `${normaliser(destination)}_${String(mois).padStart(2, '0')}_${langue}_${criteres}`;
}

/**
 * `genererRandos({ destination, mois, langue, niveau, dureeMax, deniveleMax,
 *                  boucleUniquement, adapteeEnfants })`
 *
 * @returns {Promise<{ cle: string, randos: Array<object>, sources: string[], depuisCache: boolean }>}
 */
export const genererRandos = onCall(
  // Vérifier des itinéraires demande plus de recherches qu'une fiche : la
  // génération dépasse régulièrement cinq minutes.
  { secrets: [CLE_ANTHROPIC], timeoutSeconds: 540 },
  async (requete) => {
    await verifierAcces(requete);

    const parametres = lireParametres(requete.data);
    return obtenirRandos(parametres);
  }
);

/**
 * Liste dans une langue : depuis le cache, sinon générée en français, puis
 * traduite pour les autres langues (voir traduction.js).
 *
 * @param {object} parametres paramètres validés
 * @returns {Promise<{ cle: string, randos: Array<object>, sources: string[], depuisCache: boolean }>}
 */
async function obtenirRandos(parametres) {
  const cle = cleRandos(parametres);

  // Le cache passe avant tout appel à l'API (CLAUDE.md §9).
  const enCache = await lireCache('randos', cle);
  if (enCache) {
    logger.info('Randonnées servies depuis le cache', { cle });
    return { cle, randos: enCache.randos, sources: enCache.sources, depuisCache: true };
  }

  let randos;
  let sources;

  if (parametres.langue === LANGUE_GENERATION) {
    const resultat = await demanderJson({
      systeme: SYSTEME_RANDOS,
      prompt: promptRandos(parametres),
      schema: SCHEMA_RANDOS,
      valider: validerRandos,
      // Deux recherches, et un effort de raisonnement réduit. Mesuré sur le
      // même cas — Népal, niveau moyen, six heures :
      //   4 recherches, effort medium : 108 s
      //   2 recherches, effort medium :  88 s
      //   2 recherches, effort low    :  47 s
      // Les cinq itinéraires rendus sont les mêmes classiques dans les trois
      // cas. La liste venant désormais des connaissances du modèle (voir
      // prompts/randos.js), les recherches ne servent plus qu'à corriger les
      // chiffres douteux : en accorder davantage allongeait l'attente sans
      // rien ajouter.
      effort: 'low',
      maxRecherches: 2,
      journal: {
        fonction: 'genererRandos',
        destination: parametres.destination,
        niveau: parametres.niveau,
      },
    });

    randos = resultat.randos.slice(0, NOMBRE_RANDOS);
    sources = Array.isArray(resultat.sources) ? resultat.sources : [];
  } else {
    const francaise = await obtenirRandos({ ...parametres, langue: LANGUE_GENERATION });
    randos = francaise.randos;
    sources = francaise.sources;

    if (randos.length > 0) {
      try {
        const traduite = await traduire({
          donnees: { destination: parametres.destination, randos, sources },
          schema: SCHEMA_RANDOS,
          valider: validerRandos,
          langue: parametres.langue,
          journal: { fonction: 'genererRandos', destination: parametres.destination },
        });
        randos = traduite.randos;
      } catch (erreur) {
        // Mieux vaut le français qu'une erreur. Rien n'est mis en cache sous
        // cette langue : la traduction sera retentée à la prochaine demande.
        logger.warn('Traduction impossible, liste servie en français', { cle, erreur: erreur.message });
        return { cle, randos, sources, depuisCache: false };
      }
    }
  }

  // Une liste vide n'est pas mise en cache : elle tient souvent à des
  // critères trop serrés, et la figer trente jours interdirait de retrouver
  // quoi que ce soit avec les mêmes critères élargis entre-temps.
  if (randos.length === 0) {
    logger.info('Liste vide pour cette demande', { cle });
    return { cle, randos, sources, depuisCache: false };
  }

  await ecrireCache('randos', cle, {
    randos,
    sources,
    destinationNormalisee: normaliser(parametres.destination),
    mois: parametres.mois,
    langue: parametres.langue,
  });

  logger.info('Randonnées générées et mises en cache', { cle, nombre: randos.length });
  return { cle, randos, sources, depuisCache: false };
}
