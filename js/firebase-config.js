/**
 * firebase-config.js — configuration et initialisation de Firebase.
 *
 * localhost / 127.0.0.1 → environnement `test` (émulateurs Firebase)
 * tout autre hôte       → environnement `prod`
 *
 * Aucune clé secrète ici : la configuration Firebase côté client est publique
 * par conception. La clé de l'API Claude vit uniquement dans Secret Manager,
 * côté Cloud Functions.
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  getAuth,
  connectAuthEmulator,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  getFirestore,
  connectFirestoreEmulator,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import {
  getFunctions,
  connectFunctionsEmulator,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js';

/** Hôtes considérés comme locaux. */
const HOTES_LOCAUX = ['localhost', '127.0.0.1', '[::1]', '0.0.0.0'];

/** @type {'test'|'prod'} */
export const ENVIRONNEMENT = HOTES_LOCAUX.includes(location.hostname) ? 'test' : 'prod';

/** Vrai quand l'app tourne en local contre les émulateurs. */
export const EST_LOCAL = ENVIRONNEMENT === 'test';

/**
 * Configurations Firebase.
 *
 * `test` utilise un projet de démonstration (`demo-` par convention Firebase) :
 * les émulateurs l'acceptent tel quel et refusent tout accès au cloud, ce qui
 * garantit qu'un test local ne touche jamais de données réelles.
 *
 * `prod` est à compléter une fois le projet créé dans la console Firebase.
 */
const CONFIGS = {
  test: {
    apiKey: 'demo-cle-emulateur',
    authDomain: 'localhost',
    projectId: 'demo-mytrip',
    storageBucket: 'demo-mytrip.appspot.com',
    messagingSenderId: '000000000000',
    appId: '1:000000000000:web:demo',
  },
  prod: {
    apiKey: 'A_REMPLIR',
    authDomain: 'A_REMPLIR.firebaseapp.com',
    projectId: 'nomadia-prod',
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

/** Services Firebase, initialisés une seule fois. */
let services = null;

/**
 * Initialise Firebase et branche les émulateurs en local.
 * Appelable plusieurs fois : les services sont mis en cache.
 *
 * @returns {{ app: object, auth: object, db: object, fonctions: object }}
 */
export function initialiserFirebase() {
  if (services) return services;

  const app = initializeApp(configFirebase);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const fonctions = getFunctions(app, REGION_FONCTIONS);

  if (EST_LOCAL) {
    connectAuthEmulator(auth, `http://${EMULATEURS.auth.hote}:${EMULATEURS.auth.port}`, {
      disableWarnings: true,
    });
    connectFirestoreEmulator(db, EMULATEURS.firestore.hote, EMULATEURS.firestore.port);
    connectFunctionsEmulator(fonctions, EMULATEURS.functions.hote, EMULATEURS.functions.port);
  }

  services = { app, auth, db, fonctions };
  return services;
}
