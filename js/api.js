/**
 * api.js — appels aux Cloud Functions.
 *
 * Aucune clé API ici : le front appelle les fonctions via httpsCallable,
 * les fonctions parlent à l'API Claude (CLAUDE.md §3.1).
 *
 * Les erreurs techniques sont traduites en codes simples que l'interface
 * associe à un libellé : aucune erreur brute n'est montrée (CLAUDE.md §7).
 */

import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js';

/** Noms des Cloud Functions appelables. */
export const FONCTIONS = {
  genererFiche: 'genererFiche',
  genererLieux: 'genererLieux',
  genererRandos: 'genererRandos',
};

let servicesFonctions = null;

/**
 * Branche le module sur Firebase. À appeler après l'authentification.
 * @param {object} fonctions instance Functions
 */
export function configurerApi(fonctions) {
  servicesFonctions = fonctions;
}

/**
 * Traduit une erreur Firebase en clé de libellé.
 * @param {object} erreur
 * @returns {string} clé pour t()
 */
function cleErreur(erreur) {
  switch (erreur?.code) {
    case 'functions/unauthenticated':
    case 'functions/permission-denied':
      return 'erreurs.nonAutorise';
    case 'functions/unavailable':
    case 'functions/deadline-exceeded':
    case 'functions/resource-exhausted':
      return 'erreurs.reseau';
    case 'functions/failed-precondition':
      return 'erreurs.destinationNonTraitable';
    // Les paramètres sont construits par le front : une erreur ici signale un
    // défaut de l'application, pas une panne de la recherche.
    case 'functions/invalid-argument':
      return 'erreurs.parametres';
    default:
      return 'erreurs.ia';
  }
}

/**
 * Appelle une Cloud Function.
 *
 * @param {string} nom nom de la fonction
 * @param {object} donnees paramètres
 * @returns {Promise<object>} le champ `data` de la réponse
 * @throws {Error} avec `cleLibelle` renseignée pour l'affichage
 */
async function appeler(nom, donnees) {
  if (!servicesFonctions) {
    throw new Error('api.js : configurerApi doit être appelé après la connexion.');
  }

  try {
    const fonction = httpsCallable(servicesFonctions, nom);
    const reponse = await fonction(donnees);
    return reponse.data;
  } catch (erreur) {
    console.error(`Échec de l'appel à ${nom}`, erreur);
    const echec = new Error(`appel-${nom}`);
    echec.cleLibelle = cleErreur(erreur);
    throw echec;
  }
}

/**
 * Demande la fiche pratique d'une destination.
 *
 * @param {{ destination: string, mois: number, langue: string, nationalite: string }} parametres
 * @returns {Promise<{ ficheId: string, fiche: object, depuisCache: boolean }>}
 */
export function genererFiche(parametres) {
  return appeler(FONCTIONS.genererFiche, parametres);
}
