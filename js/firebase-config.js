/**
 * firebase-config.js — choix automatique de l'environnement.
 *
 * localhost / 127.0.0.1 → environnement `test` (émulateurs Firebase)
 * tout autre hôte       → environnement `prod`
 *
 * Aucune clé secrète ici : la configuration Firebase côté client est publique
 * par conception. La clé de l'API Claude vit uniquement dans Secret Manager,
 * côté Cloud Functions.
 */

/** Hôtes considérés comme locaux. */
const HOTES_LOCAUX = ['localhost', '127.0.0.1', '[::1]', '0.0.0.0'];

/** @type {'test'|'prod'} */
export const ENVIRONNEMENT = HOTES_LOCAUX.includes(location.hostname) ? 'test' : 'prod';

/** Vrai quand l'app tourne en local contre les émulateurs. */
export const EST_LOCAL = ENVIRONNEMENT === 'test';

/**
 * Configurations Firebase.
 * À compléter à l'étape 2 (Auth + liste blanche), une fois les projets créés
 * dans la console Firebase.
 */
const CONFIGS = {
  test: {
    apiKey: 'A_REMPLIR',
    authDomain: 'A_REMPLIR.firebaseapp.com',
    projectId: 'mytrip-test',
    storageBucket: 'A_REMPLIR.appspot.com',
    messagingSenderId: 'A_REMPLIR',
    appId: 'A_REMPLIR',
  },
  prod: {
    apiKey: 'A_REMPLIR',
    authDomain: 'A_REMPLIR.firebaseapp.com',
    projectId: 'mytrip-prod',
    storageBucket: 'A_REMPLIR.appspot.com',
    messagingSenderId: 'A_REMPLIR',
    appId: 'A_REMPLIR',
  },
};

/** Configuration Firebase correspondant à l'environnement courant. */
export const configFirebase = CONFIGS[ENVIRONNEMENT];

/** Ports des émulateurs (doivent rester alignés avec firebase.json). */
export const EMULATEURS = {
  auth: { hote: '127.0.0.1', port: 9099 },
  firestore: { hote: '127.0.0.1', port: 8080 },
  functions: { hote: '127.0.0.1', port: 5001 },
};

/** Région des Cloud Functions (2nd gen). */
export const REGION_FONCTIONS = 'europe-west1';

/** Vrai tant que la configuration n'a pas été renseignée. */
export function configurationIncomplete() {
  return Object.values(configFirebase).some((valeur) => String(valeur).includes('A_REMPLIR'));
}
