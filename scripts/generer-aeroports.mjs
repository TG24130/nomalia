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

/**
 * Liaisons aériennes régulières, publiées par OpenFlights (licence ODbL).
 * Sert uniquement à classer les aéroports d'une même ville : le nombre de
 * destinations, et surtout de pays desservis, distingue l'aéroport principal
 * de l'aérodrome secondaire. Les données datent, mais la hiérarchie entre
 * Roissy et Orly, ou entre Fiumicino et Ciampino, n'a pas bougé.
 */
const SOURCE_ROUTES = 'https://raw.githubusercontent.com/jpatokal/openflights/master/data/routes.dat';

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

/* — Dessertes : combien de destinations, dans combien de pays — */

console.log('Téléchargement des liaisons aériennes…');
const reponseRoutes = await fetch(SOURCE_ROUTES);

if (reponseRoutes.ok) {
  const paysParCode = new Map(aeroports.map((aeroport) => [aeroport.c, aeroport.p]));

  /** @type {Map<string, { destinations: Set<string>, pays: Set<string> }>} */
  const dessertes = new Map();

  const noter = (depuis, vers) => {
    if (!paysParCode.has(depuis)) return;

    if (!dessertes.has(depuis)) {
      dessertes.set(depuis, { destinations: new Set(), pays: new Set() });
    }

    const entree = dessertes.get(depuis);
    entree.destinations.add(vers);

    const pays = paysParCode.get(vers);
    if (pays && pays !== paysParCode.get(depuis)) entree.pays.add(pays);
  };

  for (const ligne of (await reponseRoutes.text()).split(/\r?\n/)) {
    if (!ligne.trim()) continue;

    // airline,airlineID,source,sourceID,destination,destID,codeshare,stops,equipment
    const champs = ligne.split(',');
    const depuis = champs[2]?.trim().toUpperCase();
    const vers = champs[4]?.trim().toUpperCase();
    if (depuis?.length !== 3 || vers?.length !== 3) continue;

    noter(depuis, vers);
    noter(vers, depuis);
  }

  for (const aeroport of aeroports) {
    const entree = dessertes.get(aeroport.c);
    if (!entree) continue;

    // Un pays desservi pèse plus qu'une destination de plus dans le même
    // pays : c'est ce qui sépare un hub international d'un aéroport régional.
    aeroport.d = entree.destinations.size;
    aeroport.i = entree.pays.size;
  }

  console.log(`Dessertes relevées pour ${dessertes.size} aéroports.`);
} else {
  console.warn(`Liaisons indisponibles (HTTP ${reponseRoutes.status}) : classement par taille seule.`);
}

// Les mieux desservis d'abord : à égalité de nom, c'est celui qu'on veut.
aeroports.sort(
  (a, b) => (b.i ?? 0) - (a.i ?? 0) || (b.d ?? 0) - (a.d ?? 0) || b.t - a.t || a.c.localeCompare(b.c)
);

await fs.writeFile(
  SORTIE,
  `${JSON.stringify({ source: 'OurAirports — domaine public', genereLe: new Date().toISOString().slice(0, 10), aeroports })}\n`
);

const taille = (await fs.stat(SORTIE)).size;
console.log(`${aeroports.length} aéroports écrits dans data/aeroports.json (${Math.round(taille / 1024)} Ko)`);
