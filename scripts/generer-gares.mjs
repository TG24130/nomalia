/**
 * generer-gares.mjs — construit data/gares.json.
 *
 * Source : trainline-eu/stations (https://github.com/trainline-eu/stations),
 * publiée sous licence ODbL. Le fichier complet fait seize mégaoctets pour
 * près de 72 000 entrées ; on n'en garde que les villes et les gares
 * principales, soit ce qu'un voyageur saisit réellement.
 *
 * Usage : node scripts/generer-gares.mjs
 *
 * Script de maintenance, à relancer pour rafraîchir la table.
 * Il n'est pas appelé par l'application.
 */

import fs from 'node:fs/promises';

const SOURCE = 'https://raw.githubusercontent.com/trainline-eu/stations/master/stations.csv';
const SORTIE = new URL('../data/gares.json', import.meta.url);

/**
 * Pays couverts. La V0 s'adresse à des voyageurs partant de France ; au-delà
 * de l'Europe de l'Ouest, le train n'est plus un mode de transport pertinent
 * pour ce que l'application propose.
 */
const PAYS = new Set(['FR', 'BE', 'CH', 'DE', 'ES', 'IT', 'GB', 'NL', 'LU', 'PT', 'AT']);

console.log('Téléchargement de la source…');
const reponse = await fetch(SOURCE);

if (!reponse.ok) {
  console.error(`Téléchargement impossible : HTTP ${reponse.status}`);
  process.exit(1);
}

const lignes = (await reponse.text()).split(/\r?\n/);
const entetes = lignes[0].split(';');
const indice = (nom) => entetes.indexOf(nom);

const colonnes = {
  nom: indice('name'),
  pays: indice('country'),
  estVille: indice('is_city'),
  estPrincipale: indice('is_main_station'),
  estProposable: indice('is_suggestable'),
  sncf: indice('sncf_id'),
};

const gares = [];

for (const ligne of lignes.slice(1)) {
  if (!ligne.trim()) continue;

  // Le fichier n'utilise pas de guillemets : un simple découpage suffit.
  const champs = ligne.split(';');
  const pays = champs[colonnes.pays]?.trim().toUpperCase();

  if (!PAYS.has(pays)) continue;
  if (champs[colonnes.estProposable]?.trim() !== 't') continue;

  const estVille = champs[colonnes.estVille]?.trim() === 't';
  const estPrincipale = champs[colonnes.estPrincipale]?.trim() === 't';

  // Une entrée « ville » regroupe toutes les gares de l'agglomération : c'est
  // elle qu'un voyageur vise en écrivant « Paris ». À défaut, la gare
  // principale. Les haltes secondaires ne servent pas ici.
  if (!estVille && !estPrincipale) continue;

  const nom = champs[colonnes.nom]?.trim();
  if (!nom) continue;

  gares.push({
    n: nom,
    p: pays,
    // Rang : 2 pour une ville, 1 pour une gare principale. Départage deux
    // entrées de même nom, comme « Paris » et « Paris Gare de Lyon ».
    r: estVille ? 2 : 1,
    ...(champs[colonnes.sncf]?.trim() ? { s: champs[colonnes.sncf].trim() } : {}),
  });
}

gares.sort((a, b) => b.r - a.r || a.n.localeCompare(b.n, 'fr'));

await fs.writeFile(
  SORTIE,
  `${JSON.stringify({
    source: 'trainline-eu/stations — ODbL',
    genereLe: new Date().toISOString().slice(0, 10),
    gares,
  })}\n`
);

const taille = (await fs.stat(SORTIE)).size;
const villes = gares.filter((gare) => gare.r === 2).length;
console.log(
  `${gares.length} gares écrites dans data/gares.json (${villes} villes, ${Math.round(taille / 1024)} Ko)`
);
