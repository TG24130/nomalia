/**
 * test-generation.mjs — éprouve les prompts sans passer par Firebase.
 *
 * Le tiroir Randonnées a longtemps renvoyé zéro itinéraire après deux à trois
 * minutes de recherche. Diagnostiquer cela à travers l'application coûtait un
 * parcours complet à chaque essai. Ce script appelle l'API directement, avec
 * les mêmes prompt et schéma que la Cloud Function, et affiche la durée, le
 * nombre de résultats et les recherches consommées.
 *
 * Usage :
 *   node scripts/test-generation.mjs randos
 *   node scripts/test-generation.mjs lieux
 *   node scripts/test-generation.mjs randos --tous
 *   node scripts/test-generation.mjs randos --cas=3
 *   node scripts/test-generation.mjs lieux --langue=en
 *   node scripts/test-generation.mjs lieux --recherches=2 --effort=low
 *
 * La clé est lue dans functions/.secret.local, qui n'est pas versionné.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '../functions/node_modules/@anthropic-ai/sdk/index.mjs';

import { SYSTEME_RANDOS, promptRandos } from '../functions/prompts/randos.js';
import { NOMBRE_RANDOS, SCHEMA_RANDOS, validerRandos } from '../functions/schemas/randos.js';
import { SYSTEME_LIEUX, promptLieux } from '../functions/prompts/lieux.js';
import { NOMBRE_LIEUX, SCHEMA_LIEUX, validerLieux } from '../functions/schemas/lieux.js';

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
const argLangue = process.argv.find((a) => a.startsWith('--langue='));
const LANGUE = argLangue ? argLangue.split('=')[1] : null;
const argOutil = process.argv.find((a) => a.startsWith('--outil='));
const OUTIL_RECHERCHE = argOutil ? argOutil.split('=')[1] : 'web_search_20260209';

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

/**
 * Les deux générations éprouvables, décrites de la même façon : de quoi
 * construire l'appel, le valider, et résumer ce qui revient.
 */
const FAMILLES = {
  randos: {
    systeme: SYSTEME_RANDOS,
    prompt: promptRandos,
    schema: SCHEMA_RANDOS,
    valider: validerRandos,
    liste: (donnees) => donnees?.randos ?? [],
    resumer: (r) =>
      `${r.nom} — ${r.niveau}, ${r.distanceKm} km, ${r.dureeHeures} h, ` +
      `${r.deniveleM} m D+${r.boucle ? ', boucle' : ''}`,
    cas: [
      {
        nom: 'Népal, critères simples',
        parametres: {
          destination: 'Népal', mois: 10, langue: 'fr', nombre: NOMBRE_RANDOS,
          niveau: 'moyen', dureeMax: 6, deniveleMax: null, boucle: null,
          adapteeEnfants: false,
        },
      },
      {
        nom: 'Népal, critères contradictoires (difficile mais 600 m D+)',
        parametres: {
          destination: 'Népal', mois: 10, langue: 'fr', nombre: NOMBRE_RANDOS,
          niveau: 'difficile', dureeMax: 8, deniveleMax: 600, boucle: 'oui',
          adapteeEnfants: false,
        },
      },
      {
        nom: 'Crète, sans critère',
        parametres: {
          destination: 'Crète', mois: 7, langue: 'fr', nombre: NOMBRE_RANDOS,
          niveau: null, dureeMax: null, deniveleMax: null, boucle: null,
          adapteeEnfants: false,
        },
      },
      {
        nom: 'Hong Kong, ville-territoire (bloquait en prod)',
        parametres: {
          destination: 'Hong Kong', mois: 11, langue: 'fr', nombre: NOMBRE_RANDOS,
          niveau: 'facile', dureeMax: 3, deniveleMax: null, boucle: null,
          adapteeEnfants: false,
        },
      },
    ],
  },

  lieux: {
    systeme: SYSTEME_LIEUX,
    prompt: promptLieux,
    schema: SCHEMA_LIEUX,
    valider: validerLieux,
    liste: (donnees) => donnees?.lieux ?? [],
    resumer: (l) =>
      `${l.nom} — ${l.prixEntree === null ? 'accès libre ou prix inconnu' : `${l.prixEntree} ${l.devise}`}`,
    cas: [
      {
        nom: 'Népal, trip liberté',
        parametres: {
          destination: 'Népal', type: 'etapes', mois: 10, langue: 'fr',
          nombre: NOMBRE_LIEUX, voyageurs: { adultes: 2, enfants: 0 },
        },
      },
      {
        nom: 'Hong Kong, business',
        parametres: {
          destination: 'Hong Kong', type: 'business', mois: 11, langue: 'fr',
          nombre: NOMBRE_LIEUX, voyageurs: { adultes: 1, enfants: 0 },
        },
      },
      {
        nom: 'Kenya, safari',
        parametres: {
          destination: 'Kenya', type: 'safari', mois: 8, langue: 'fr',
          nombre: NOMBRE_LIEUX, voyageurs: { adultes: 2, enfants: 0 },
        },
      },
    ],
  },
};

/**
 * Lance un cas et rend compte.
 * @param {Anthropic} client
 * @param {object} famille entrée de FAMILLES
 * @param {{ nom: string, parametres: object }} cas
 */
async function essayer(client, famille, cas) {
  console.log(`\n— ${cas.nom} —`);
  const depart = Date.now();

  const flux = client.messages.stream({
    model: MODELE,
    max_tokens: 16000,
    system: famille.systeme,
    messages: [{ role: 'user', content: famille.prompt({ ...cas.parametres, langue: LANGUE ?? cas.parametres.langue }) }],
    tools: [{ type: OUTIL_RECHERCHE, name: 'web_search', max_uses: MAX_RECHERCHES }],
    output_config: { effort: EFFORT, format: { type: 'json_schema', schema: famille.schema } },
  });

  const reponse = await flux.finalMessage();
  const secondes = Math.round((Date.now() - depart) / 1000);

  // Comme functions/claude.js : le dernier bloc de texte fait foi, la recherche
  // web pouvant être précédée d'un brouillon.
  const blocs = reponse.content.filter((bloc) => bloc.type === 'text');
  const texte = blocs.at(-1)?.text ?? '';
  console.log(`  blocs texte  : ${blocs.length}`);
  if (process.argv.includes('--brut')) console.log(`  séquence     : ${reponse.content.map((b) => b.type).join(' > ')}`);
  let donnees = null;
  try {
    donnees = JSON.parse(texte);
  } catch {
    console.log('  réponse non analysable');
  }

  const controle = donnees ? famille.valider(donnees) : { valide: false, erreurs: ['pas de JSON'] };
  const resultats = famille.liste(donnees);

  console.log(`  durée        : ${secondes} s (effort ${EFFORT}, ${MAX_RECHERCHES} recherches max)`);
  console.log(`  recherches   : ${reponse.usage?.server_tool_use?.web_search_requests ?? 0}`);
  console.log(`  tokens entrée: ${reponse.usage?.input_tokens}`);
  console.log(`  arrêt        : ${reponse.stop_reason}, ${reponse.usage?.output_tokens} tokens de sortie`);
  console.log(`  résultats    : ${resultats.length}`);
  if (!controle.valide && process.argv.includes('--brut')) console.log(texte.slice(0, 1500));
  console.log(`  validation   : ${controle.valide ? 'OK' : controle.erreurs.join(', ')}`);

  for (const resultat of resultats) console.log(`    · ${famille.resumer(resultat)}`);
  // Un extrait de texte, pour juger de la langue de rédaction.
  if (resultats[0]?.description) console.log(`  extrait      : ${resultats[0].description.slice(0, 160)}`);
}

const nomFamille = process.argv[2];
const famille = FAMILLES[nomFamille];

if (!famille) {
  console.log(`Famille inconnue. Choisir parmi : ${Object.keys(FAMILLES).join(', ')}`);
  process.exit(1);
}

const client = new Anthropic({ apiKey: lireCle() });
const argCas = process.argv.find((a) => a.startsWith('--cas='));
const cas = argCas ? [famille.cas[Number(argCas.split('=')[1])]] : process.argv.includes('--tous') ? famille.cas : [famille.cas[0]];

for (const unCas of cas) {
  try {
    await essayer(client, famille, unCas);
  } catch (erreur) {
    console.log(`  échec : ${erreur.message}`);
  }
}
