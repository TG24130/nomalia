/**
 * test-randos.mjs — éprouve le prompt des randonnées sans passer par Firebase.
 *
 * Le tiroir Randonnées a longtemps renvoyé zéro itinéraire après deux à trois
 * minutes de recherche. Diagnostiquer cela à travers l'application coûtait un
 * parcours complet à chaque essai. Ce script appelle l'API directement, avec
 * les mêmes prompt et schéma que la Cloud Function, et affiche la durée, le
 * nombre d'itinéraires et les recherches consommées.
 *
 * Usage :
 *   node scripts/test-randos.mjs                    → cas simple, Népal
 *   node scripts/test-randos.mjs --tous             → tous les cas
 *
 * La clé est lue dans functions/.secret.local, qui n'est pas versionné.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '../functions/node_modules/@anthropic-ai/sdk/index.mjs';

import { SYSTEME_RANDOS, promptRandos } from '../functions/prompts/randos.js';
import { NOMBRE_RANDOS, SCHEMA_RANDOS, validerRandos } from '../functions/schemas/randos.js';

const racine = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Modèle et budget de recherche, alignés sur functions/randos.js.
 *
 * Le budget se règle en ligne de commande pour comparer : chaque recherche
 * ajoute un aller-retour au modèle et une vingtaine de secondes.
 */
const MODELE = 'claude-sonnet-5';
const argRecherches = process.argv.find((a) => a.startsWith('--recherches='));
const MAX_RECHERCHES = argRecherches ? Number(argRecherches.split('=')[1]) : 4;
const argEffort = process.argv.find((a) => a.startsWith('--effort='));
const EFFORT = argEffort ? argEffort.split('=')[1] : 'medium';

/**
 * Lit la clé API dans le fichier de secrets local.
 * @returns {string}
 */
function lireCle() {
  const chemin = path.join(racine, 'functions', '.secret.local');
  const contenu = fs.readFileSync(chemin, 'utf8');
  const ligne = contenu.split('\n').find((l) => l.startsWith('ANTHROPIC_API_KEY'));

  if (!ligne) throw new Error('ANTHROPIC_API_KEY absente de functions/.secret.local');
  return ligne.slice(ligne.indexOf('=') + 1).trim();
}

/** Cas d'essai : le premier est celui que Thierry a vu échouer. */
const CAS = [
  {
    nom: 'Népal, critères simples',
    parametres: {
      destination: 'Népal',
      mois: 10,
      langue: 'fr',
      nombre: NOMBRE_RANDOS,
      niveau: 'moyen',
      dureeMax: 6,
      deniveleMax: null,
      boucle: null,
      adapteeEnfants: false,
    },
  },
  {
    nom: 'Népal, critères contradictoires (difficile mais 600 m D+)',
    parametres: {
      destination: 'Népal',
      mois: 10,
      langue: 'fr',
      nombre: NOMBRE_RANDOS,
      niveau: 'difficile',
      dureeMax: 8,
      deniveleMax: 600,
      boucle: 'oui',
      adapteeEnfants: false,
    },
  },
  {
    nom: 'Crète, sans critère',
    parametres: {
      destination: 'Crète',
      mois: 7,
      langue: 'fr',
      nombre: NOMBRE_RANDOS,
      niveau: null,
      dureeMax: null,
      deniveleMax: null,
      boucle: null,
      adapteeEnfants: false,
    },
  },
];

/**
 * Lance un cas et rend compte.
 * @param {Anthropic} client
 * @param {{ nom: string, parametres: object }} cas
 */
async function essayer(client, cas) {
  console.log(`\n— ${cas.nom} —`);
  const depart = Date.now();

  const flux = client.messages.stream({
    model: MODELE,
    max_tokens: 16000,
    system: SYSTEME_RANDOS,
    messages: [{ role: 'user', content: promptRandos(cas.parametres) }],
    tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: MAX_RECHERCHES }],
    output_config: { effort: EFFORT, format: { type: 'json_schema', schema: SCHEMA_RANDOS } },
  });

  const reponse = await flux.finalMessage();
  const secondes = Math.round((Date.now() - depart) / 1000);

  const texte = reponse.content.find((bloc) => bloc.type === 'text')?.text ?? '';
  let donnees = null;
  try {
    donnees = JSON.parse(texte);
  } catch {
    console.log('  réponse non analysable');
  }

  const controle = donnees ? validerRandos(donnees) : { valide: false, erreurs: ['pas de JSON'] };
  const randos = donnees?.randos ?? [];

  console.log(`  durée        : ${secondes} s (effort ${EFFORT}, ${MAX_RECHERCHES} recherches max)`);
  console.log(`  recherches   : ${reponse.usage?.server_tool_use?.web_search_requests ?? 0}`);
  console.log(`  tokens entrée: ${reponse.usage?.input_tokens}`);
  console.log(`  randonnées   : ${randos.length}`);
  console.log(`  validation   : ${controle.valide ? 'OK' : controle.erreurs.join(', ')}`);

  for (const rando of randos) {
    console.log(
      `    · ${rando.nom} — ${rando.niveau}, ${rando.distanceKm} km, ` +
        `${rando.dureeHeures} h, ${rando.deniveleM} m D+${rando.boucle ? ', boucle' : ''}`
    );
  }
}

const client = new Anthropic({ apiKey: lireCle() });
const cas = process.argv.includes('--tous') ? CAS : [CAS[0]];

for (const unCas of cas) {
  try {
    await essayer(client, unCas);
  } catch (erreur) {
    console.log(`  échec : ${erreur.message}`);
  }
}
