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
  conseillerMois: 'conseillerMois',
};

/**
 * Délai d'attente côté client, en millisecondes.
 *
 * Le SDK abandonne au bout de soixante-dix secondes par défaut, alors qu'une
 * génération avec recherche web dépasse régulièrement cette durée : la
 * fonction terminait et mettait son résultat en cache, mais l'utilisateur
 * voyait une erreur de connexion. La valeur suit le délai des fonctions.
 */
const DELAI_APPEL_MS = 300000;

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
 * Absence de l'écran au-delà de laquelle un appel en cours est relancé au
 * retour. En deçà, la connexion a toutes les chances d'avoir tenu.
 */
const ABSENCE_AVANT_RELANCE_MS = 15000;

/**
 * Lance l'appel, et le relance quand l'écran revient après une veille.
 *
 * Sur téléphone, une mise en veille pendant la minute d'attente coupe parfois
 * la connexion sans que la requête échoue : l'app attendait alors
 * indéfiniment une réponse qui ne viendrait pas. Au retour, on relance ; la
 * première réponse arrivée l'emporte. Si la génération avait abouti côté
 * serveur, la relance est servie par le cache.
 *
 * @param {Function} fonction fonction appelable Firebase
 * @param {object} donnees
 * @returns {Promise<object>}
 */
function appelerAvecRelance(fonction, donnees) {
  return new Promise((resoudre, rejeter) => {
    let termine = false;
    let enCours = 0;
    let masqueDepuis = document.hidden ? Date.now() : null;
    let relanceAttendue = false;

    const conclure = (action, valeur) => {
      if (termine) return;
      termine = true;
      document.removeEventListener('visibilitychange', surVisibilite);
      action(valeur);
    };

    const lancer = () => {
      enCours += 1;
      fonction(donnees).then(
        (reponse) => conclure(resoudre, reponse),
        (erreur) => {
          enCours -= 1;
          if (enCours > 0) return;
          // Un échec survenu écran éteint vient le plus souvent de la veille :
          // on retente au retour plutôt que d'afficher une erreur.
          if (document.hidden) relanceAttendue = true;
          else conclure(rejeter, erreur);
        }
      );
    };

    function surVisibilite() {
      if (document.hidden) {
        masqueDepuis = Date.now();
        return;
      }
      const longueAbsence = masqueDepuis && Date.now() - masqueDepuis >= ABSENCE_AVANT_RELANCE_MS;
      masqueDepuis = null;
      if (relanceAttendue || longueAbsence) {
        relanceAttendue = false;
        lancer();
      }
    }

    document.addEventListener('visibilitychange', surVisibilite);
    lancer();
  });
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
    const fonction = httpsCallable(servicesFonctions, nom, { timeout: DELAI_APPEL_MS });
    const reponse = await appelerAvecRelance(fonction, donnees);
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

/**
 * Demande une liste de lieux (plages ou incontournables).
 *
 * @param {{ destination: string, type: string, mois: number, langue: string,
 *           voyageurs: { adultes: number, enfants: number } }} parametres
 * @returns {Promise<{ cle: string, lieux: Array<object>, sources: string[], depuisCache: boolean }>}
 */
export function genererLieux(parametres) {
  return appeler(FONCTIONS.genererLieux, parametres);
}

/**
 * Demande une liste de randonnées correspondant à des critères.
 *
 * @param {{ destination: string, mois: number, langue: string, niveau: string|null,
 *           dureeMax: number|null, deniveleMax: number|null,
 *           boucleUniquement: boolean, adapteeEnfants: boolean }} parametres
 * @returns {Promise<{ cle: string, randos: Array<object>, sources: string[], depuisCache: boolean }>}
 */
export function genererRandos(parametres) {
  return appeler(FONCTIONS.genererRandos, parametres);
}

/**
 * Conseille le mois le moins cher et le mois au meilleur climat.
 *
 * @param {{ destination: string, langue: string }} parametres
 * @returns {Promise<{ moinsCher: { mois: number, raison: string },
 *                     meilleurClimat: { mois: number, raison: string }, depuisCache: boolean }>}
 */
export function conseillerMois(parametres) {
  return appeler(FONCTIONS.conseillerMois, parametres);
}
