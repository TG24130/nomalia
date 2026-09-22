/**
 * emulateurs.mjs — lance les émulateurs Firebase avec persistance des données.
 *
 * Usage : node scripts/emulateurs.mjs
 *
 * Sans persistance, les émulateurs repartent d'une base vide à chaque
 * démarrage : il faut alors réamorcer la liste blanche, recréer un voyage de
 * test et régénérer la fiche destination — cette dernière coûtant un appel à
 * l'API Claude. Le dossier emulateurs-donnees/ conserve tout cela d'une
 * session à l'autre.
 *
 * Le script s'occupe aussi de trouver le JDK, dont l'émulateur Firestore a
 * besoin, et de ne demander l'import que si des données existent déjà.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const donnees = path.join(racine, 'emulateurs-donnees');

/**
 * Cherche un JDK utilisable : celui de l'environnement, sinon une
 * installation Microsoft OpenJDK sous Program Files.
 *
 * @returns {string|null} chemin du JDK
 */
function trouverJdk() {
  if (process.env.JAVA_HOME && fs.existsSync(process.env.JAVA_HOME)) {
    return process.env.JAVA_HOME;
  }

  const dossier = 'C:\\Program Files\\Microsoft';
  if (!fs.existsSync(dossier)) return null;

  const jdk = fs
    .readdirSync(dossier)
    .filter((nom) => nom.startsWith('jdk-'))
    .sort()
    .pop();

  return jdk ? path.join(dossier, jdk) : null;
}

const jdk = trouverJdk();

if (!jdk) {
  console.error("Aucun JDK trouvé. L'émulateur Firestore en a besoin.");
  console.error('Installez-le avec : winget install --id Microsoft.OpenJDK.21');
  process.exit(1);
}

const arguments_ = [
  'emulators:start',
  '--only',
  'auth,firestore,functions',
  '--project',
  'demo-mytrip',
  '--export-on-exit',
  donnees,
];

// L'import échoue si le dossier n'existe pas encore : au premier lancement,
// on démarre à vide et l'export de sortie le créera.
if (fs.existsSync(donnees)) {
  arguments_.splice(arguments_.length - 2, 0, '--import', donnees);
  console.log('Données précédentes rechargées depuis emulateurs-donnees/');
} else {
  console.log('Premier lancement : base vide, les données seront conservées en sortant.');
  console.log('Pensez à réamorcer la liste blanche :');
  console.log('  node scripts/seed-autorises.mjs votre.adresse@gmail.com "Votre Nom"');
}

// Node refuse de lancer directement un .cmd depuis la version 24 : sous
// Windows on passe donc par l'interpréteur de commandes, qui se charge de
// retrouver firebase dans le PATH.
const estWindows = process.platform === 'win32';
const commande = estWindows ? 'cmd.exe' : 'firebase';
const parametres = estWindows ? ['/c', 'firebase.cmd', ...arguments_] : arguments_;

const processus = spawn(commande, parametres, {
  cwd: racine,
  stdio: 'inherit',
  env: {
    ...process.env,
    JAVA_HOME: jdk,
    // L'émulateur découvre les fonctions en lançant functions/index.js dans un
    // sous-processus qui publie sa spécification sur un port local, et
    // abandonne au bout de dix secondes. Sur Windows, l'ouverture de ce port
    // dépasse parfois ce délai alors que le code se charge en une demi-seconde
    // — l'émulateur démarre alors sans aucune fonction, et l'application n'a
    // plus de genererFiche. Une minute laisse la marge nécessaire.
    FUNCTIONS_DISCOVERY_TIMEOUT: '60',
    PATH: `${path.join(jdk, 'bin')}${path.delimiter}${process.env.PATH}`,
    // Évite que la CLI attende une réponse à ses questions de télémétrie.
    CI: 'true',
  },
});

// Ctrl+C doit laisser la CLI se fermer proprement, faute de quoi l'export de
// sortie n'a pas lieu et les données de la session sont perdues.
process.on('SIGINT', () => processus.kill('SIGINT'));

processus.on('exit', (code) => process.exit(code ?? 0));
