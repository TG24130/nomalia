/**
 * generer-aeroports.mjs — construit data/aeroports.json.
 *
 * Source : OurAirports (https://ourairports.com/data/), données publiées dans
 * le domaine public. Le fichier complet fait plus de douze mégaoctets : on n'en
 * garde que les aéroports commerciaux dotés d'un code IATA, soit une table
 * assez petite pour être embarquée dans la PWA.
 *
 * Usage : node scripts/generer-aeroports.mjs
 *
 * Script de maintenance, à relancer quand on veut rafraîchir la table.
 * Il n'est pas appelé par l'application.
 */

import fs from 'node:fs/promises';

const SOURCE = 'https://davidmegginson.github.io/ourairports-data/airports.csv';
const SORTIE = new URL('../data/aeroports.json', import.meta.url);

/** Types d'aéroports retenus, du plus grand au plus petit. */
const TAILLES = { large_airport: 2, medium_airport: 1 };

/**
 * Découpe une ligne CSV en respectant les guillemets doubles.
 * @param {string} ligne
 * @returns {string[]}
 */
function decouper(ligne) {
  const champs = [];
  let courant = '';
  let entreGuillemets = false;

  for (let index = 0; index < ligne.length; index += 1) {
    const caractere = ligne[index];

    if (caractere === '"') {
      // Deux guillemets consécutifs représentent un guillemet littéral.
      if (entreGuillemets && ligne[index + 1] === '"') {
        courant += '"';
        index += 1;
      } else {
        entreGuillemets = !entreGuillemets;
      }
      continue;
    }

    if (caractere === ',' && !entreGuillemets) {
      champs.push(courant);
      courant = '';
      continue;
    }

    courant += caractere;
  }

  champs.push(courant);
  return champs;
}

console.log('Téléchargement de la source…');
const reponse = await fetch(SOURCE);
if (!reponse.ok) {
  console.error(`Téléchargement impossible : HTTP ${reponse.status}`);
  process.exit(1);
}

const lignes = (await reponse.text()).split(/\r?\n/);
const entetes = decouper(lignes[0]);
const indice = (nom) => entetes.indexOf(nom);

const colonnes = {
  type: indice('type'),
  nom: indice('name'),
  pays: indice('iso_country'),
  ville: indice('municipality'),
  service: indice('scheduled_service'),
  iata: indice('iata_code'),
  motsCles: indice('keywords'),
  region: indice('iso_region'),
};

const aeroports = [];

for (const ligne of lignes.slice(1)) {
  if (!ligne.trim()) continue;

  const champs = decouper(ligne);
  const iata = champs[colonnes.iata]?.trim().toUpperCase();
  const taille = TAILLES[champs[colonnes.type]];

  // Un aéroport sans code IATA ou sans vol régulier n'aide pas à construire
  // un lien de recherche.
  if (!iata || iata.length !== 3 || !taille) continue;
  if (champs[colonnes.service]?.trim() !== 'yes') continue;

  // Les mots-clés d'OurAirports contiennent les variantes de nom utiles à la
  // recherche : « Crete » pour Héraklion, « Côte d'Azur » pour Nice. On ne
  // garde que ceux qui n'apparaissent pas déjà dans la ville ou le nom.
  const ville = champs[colonnes.ville]?.trim() ?? '';
  const nom = champs[colonnes.nom]?.trim() ?? '';
  const deja = `${ville} ${nom}`.toLowerCase();

  const motsCles = (champs[colonnes.motsCles] ?? '')
    .split(',')
    .map((mot) => mot.trim())
    .filter((mot) => mot.length > 2 && mot.length < 30 && !deja.includes(mot.toLowerCase()))
    .slice(0, 4)
    .join(',');

  aeroports.push({
    c: iata,
    v: ville,
    n: nom,
    p: champs[colonnes.pays]?.trim() ?? '',
    t: taille,
    ...(motsCles ? { k: motsCles } : {}),
  });
}

// Les grands aéroports d'abord : à égalité de nom, c'est celui qu'on veut.
aeroports.sort((a, b) => b.t - a.t || a.c.localeCompare(b.c));

await fs.writeFile(
  SORTIE,
  `${JSON.stringify({ source: 'OurAirports — domaine public', genereLe: new Date().toISOString().slice(0, 10), aeroports })}\n`
);

const taille = (await fs.stat(SORTIE)).size;
console.log(`${aeroports.length} aéroports écrits dans data/aeroports.json (${Math.round(taille / 1024)} Ko)`);
