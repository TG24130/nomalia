/**
 * test-traduction.mjs — éprouve la chaîne « génération en français, puis
 * traduction » hors de Firebase, avec les vrais prompts et schémas.
 *
 * Usage :
 *   node scripts/test-traduction.mjs lieux es
 *   node scripts/test-traduction.mjs randos es
 *   node scripts/test-traduction.mjs fiche en
 *
 * La clé est lue dans functions/.secret.local, qui n'est pas versionné.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '../functions/node_modules/@anthropic-ai/sdk/index.mjs';

import { fusionnerTraduction, proportionTraduite } from '../functions/traduction.js';
import { SYSTEME_TRADUCTION, promptTraduction } from '../functions/prompts/traduction.js';
import { SYSTEME_LIEUX, promptLieux } from '../functions/prompts/lieux.js';
import { NOMBRE_LIEUX, SCHEMA_LIEUX, validerLieux } from '../functions/schemas/lieux.js';
import { SYSTEME_RANDOS, promptRandos } from '../functions/prompts/randos.js';
import { NOMBRE_RANDOS, SCHEMA_RANDOS, validerRandos } from '../functions/schemas/randos.js';
import { SYSTEME_FICHE, promptFiche } from '../functions/prompts/fiche.js';
import { SCHEMA_FICHE, validerFiche } from '../functions/schemas/fiche.js';

const racine = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ligne = fs
  .readFileSync(path.join(racine, 'functions', '.secret.local'), 'utf8')
  .split('\n')
  .find((l) => l.startsWith('ANTHROPIC_API_KEY'));
const client = new Anthropic({ apiKey: ligne.slice(ligne.indexOf('=') + 1).trim() });

/** Les trois générations, avec leurs réglages de production. */
const FAMILLES = {
  lieux: {
    systeme: SYSTEME_LIEUX,
    prompt: promptLieux({
      destination: 'Népal', type: 'etapes', mois: 10, langue: 'fr',
      nombre: NOMBRE_LIEUX, voyageurs: { adultes: 2, enfants: 0 },
    }),
    schema: SCHEMA_LIEUX, valider: validerLieux, effort: 'low', recherches: 2,
    extrait: (d) => d.lieux[0]?.description,
  },
  randos: {
    systeme: SYSTEME_RANDOS,
    prompt: promptRandos({
      destination: 'Crète', mois: 7, langue: 'fr', nombre: NOMBRE_RANDOS,
      niveau: null, dureeMax: null, deniveleMax: null, boucle: null, adapteeEnfants: false,
    }),
    schema: SCHEMA_RANDOS, valider: validerRandos, effort: 'low', recherches: 2,
    extrait: (d) => `${d.randos[0]?.nom} — ${d.randos[0]?.deniveleM} m — ${d.randos[0]?.niveau} — ${d.randos[0]?.description}`,
  },
  fiche: {
    systeme: SYSTEME_FICHE,
    prompt: promptFiche({ destination: 'Crète', mois: 7, langue: 'fr', nationalite: 'FR' }),
    schema: SCHEMA_FICHE, valider: validerFiche, effort: 'medium', recherches: 6,
    extrait: (d) => `${d.points.monnaie.code} — ${d.points.visa.resume}`,
  },
};

/** Appelle le modèle et renvoie le dernier bloc de texte analysé. */
async function demander({ systeme, prompt, schema, effort, recherches }) {
  const reponse = await client.messages
    .stream({
      model: 'claude-sonnet-5',
      max_tokens: 16000,
      system: systeme,
      messages: [{ role: 'user', content: prompt }],
      ...(recherches > 0
        ? { tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: recherches }] }
        : {}),
      output_config: { effort, format: { type: 'json_schema', schema } },
    })
    .finalMessage();
  return JSON.parse(reponse.content.filter((b) => b.type === 'text').at(-1).text);
}

const [nom, langue] = process.argv.slice(2);
const famille = FAMILLES[nom];
if (!famille || !langue) {
  console.log('Usage : node scripts/test-traduction.mjs <lieux|randos|fiche> <en|es>');
  process.exit(1);
}

let debut = Date.now();
const francais = await demander(famille);
console.log(`français  : ${Math.round((Date.now() - debut) / 1000)} s, ${famille.valider(francais).valide ? 'valide' : 'INVALIDE'}`);
console.log(`  ${famille.extrait(francais).slice(0, 160)}`);

debut = Date.now();
const brut = await demander({
  systeme: SYSTEME_TRADUCTION,
  prompt: promptTraduction(francais, langue),
  schema: famille.schema,
  effort: 'low',
  recherches: 0,
});
const traduit = fusionnerTraduction(francais, brut, famille.schema);
const controle = famille.valider(traduit);
console.log(`${langue}        : ${Math.round((Date.now() - debut) / 1000)} s, ${controle.valide ? 'valide' : controle.erreurs.join(', ')}, ${Math.round(proportionTraduite(francais, brut, famille.schema) * 100)} % traduit`);
console.log(`  ${famille.extrait(traduit).slice(0, 160)}`);
