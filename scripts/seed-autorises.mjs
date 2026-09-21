/**
 * seed-autorises.mjs — ajoute une adresse à la liste blanche de l'émulateur.
 *
 * Réservé au développement local : le script parle à l'émulateur Firestore,
 * jamais à la production. En production, les entrées de `autorises` sont
 * ajoutées à la main depuis la console Firebase.
 *
 * Usage :
 *   node scripts/seed-autorises.mjs prenom.nom@gmail.com "Prénom Nom"
 *   node scripts/seed-autorises.mjs --lister
 */

const PROJET = 'demo-mytrip';
const HOTE = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
const BASE = `http://${HOTE}/v1/projects/${PROJET}/databases/(default)/documents`;

/** L'émulateur accepte ce jeton factice et ignore les règles de sécurité. */
const ENTETES = {
  Authorization: 'Bearer owner',
  'Content-Type': 'application/json',
};

/** Vérifie que l'émulateur répond avant d'écrire quoi que ce soit. */
async function verifierEmulateur() {
  try {
    await fetch(`http://${HOTE}/`, { method: 'GET' });
  } catch {
    console.error(`Émulateur Firestore introuvable sur ${HOTE}.`);
    console.error('Lancez-le avec : npm run emulateurs (dans functions/) ou firebase emulators:start');
    process.exit(1);
  }
}

async function lister() {
  const reponse = await fetch(`${BASE}/autorises`, { headers: ENTETES });
  const donnees = await reponse.json();
  const documents = donnees.documents ?? [];

  if (documents.length === 0) {
    console.log('Liste blanche vide.');
    return;
  }

  console.log(`${documents.length} adresse(s) autorisée(s) :`);
  for (const document of documents) {
    const email = document.name.split('/').pop();
    const nom = document.fields?.nom?.stringValue ?? '';
    console.log(` - ${email}${nom ? ` (${nom})` : ''}`);
  }
}

async function ajouter(email, nom) {
  const identifiant = email.toLowerCase();

  const reponse = await fetch(`${BASE}/autorises/${encodeURIComponent(identifiant)}`, {
    method: 'PATCH',
    headers: ENTETES,
    body: JSON.stringify({
      fields: {
        nom: { stringValue: nom },
        ajouteLe: { timestampValue: new Date().toISOString() },
      },
    }),
  });

  if (!reponse.ok) {
    console.error(`Échec (HTTP ${reponse.status}) :`, await reponse.text());
    process.exit(1);
  }

  console.log(`Ajouté : ${identifiant}${nom ? ` (${nom})` : ''}`);
}

const [argument, nom = ''] = process.argv.slice(2);

await verifierEmulateur();

if (!argument || argument === '--lister') {
  await lister();
} else if (!argument.includes('@')) {
  console.error('Usage : node scripts/seed-autorises.mjs adresse@exemple.com "Prénom Nom"');
  process.exit(1);
} else {
  await ajouter(argument, nom);
}
