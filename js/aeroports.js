/**
 * aeroports.js — résolution d'un nom de lieu en code d'aéroport IATA.
 *
 * Sert à préremplir les liens des comparateurs de vols, qui attendent des
 * codes (« BOD », « HER ») et non des noms de ville.
 *
 * La table vient de data/aeroports.json, produite par
 * scripts/generer-aeroports.mjs à partir des données publiques OurAirports et
 * des liaisons OpenFlights. Elle est chargée à la demande : inutile de la lire
 * tant que l'utilisateur n'a pas atteint le tiroir Transport.
 *
 * Quand aucun aéroport ne correspond, la fonction renvoie null et l'appelant
 * se rabat sur un lien non prérempli : jamais de code inventé.
 */

import {
  alias,
  chargeurTable,
  correspondance,
  motsSignificatifs,
  normaliser,
  proche,
} from './recherche-lieux.js';
import { paysDepuisNom } from './pays.js';

const charger = chargeurTable('data/aeroports.json', (donnees) =>
  donnees.aeroports.map((aeroport) => {
    const ville = normaliser(aeroport.v);
    const nom = normaliser(aeroport.n);
    const motsCles = (aeroport.k ?? '').split(',').map(normaliser).filter(Boolean);

    // Le nom courant d'une ville se cache souvent dans le nom de l'aéroport
    // plutôt que dans la commune : Athènes est à « Spata-Artemida », Venise à
    // « Venezia (VE) ».
    return {
      ...aeroport,
      _ville: ville,
      _nom: nom,
      _motsCles: motsCles,
      _mots: motsSignificatifs(ville, nom, motsCles.join(' ')),
    };
  })
);

/**
 * Poids d'un aéroport, tiré de ses dessertes réelles.
 *
 * Le nombre de pays desservis sépare un hub d'un aérodrome : Roissy en
 * dessert 103, Orly 36, Sitia aucun. Un aéroport sans liaison internationale
 * est pénalisé, sans quoi « Crète » renverrait Sitia, dont la commune
 * s'appelle littéralement « Crete Island », plutôt qu'Héraklion.
 *
 * @param {object} aeroport
 * @returns {number}
 */
function poids(aeroport) {
  const pays = aeroport.i ?? 0;
  if (pays === 0) return -30;
  return Math.min(60, pays);
}

/**
 * Mesure la correspondance entre une requête et un aéroport.
 * @param {object} aeroport entrée préparée de la table
 * @param {string} requete requête normalisée
 * @returns {number} score, 0 si aucune correspondance
 */
function score(aeroport, requete) {
  const scores = [
    correspondance(aeroport._ville, requete, 80),
    correspondance(aeroport._nom, requete, 45),
    ...aeroport._motsCles.map((motCle) => correspondance(motCle, requete, 60)),
    // Un mot isolé du nom ou de la commune : « Athens » dans
    // « Athens Eleftherios Venizelos International Airport ».
    ...aeroport._mots.map((mot) => (mot === requete ? 55 : 0)),
  ];

  const meilleur = Math.max(...scores);
  return meilleur > 0 ? meilleur + poids(aeroport) : 0;
}

/**
 * Cherche le code IATA correspondant à un lieu.
 *
 * @param {string} lieu nom de ville, d'île ou de région, ou code IATA
 * @returns {Promise<{ code: string, ville: string, nom: string, pays: string }|null>}
 */
export async function chercherAeroport(lieu) {
  const requete = normaliser(lieu);
  if (requete.length < 2) return null;

  const aeroports = await charger();
  if (!aeroports.length) return null;

  // Une saisie de trois lettres correspondant à un code est prise telle quelle.
  if (/^[a-z]{3}$/.test(requete)) {
    const parCode = aeroports.find((aeroport) => aeroport.c.toLowerCase() === requete);
    if (parCode) {
      return { code: parCode.c, ville: parCode.v, nom: parCode.n, pays: parCode.p };
    }
  }

  // Un nom de pays (« Kenya », « Portugal ») ne désigne aucune ville : la
  // recherche approximative ci-dessous trouvait alors n'importe quoi (« Kenya »
  // donnait un aéroport canadien). On retient l'aéroport du pays qui dessert
  // le plus de pays, celui par lequel on y arrive le plus souvent.
  const pays = paysDepuisNom(lieu, normaliser);
  if (pays) {
    const principal = aeroports
      .filter((aeroport) => aeroport.p === pays)
      .reduce((meilleur, aeroport) => ((aeroport.i ?? 0) > (meilleur?.i ?? -1) ? aeroport : meilleur), null);
    if (principal) {
      return { code: principal.c, ville: principal.v, nom: principal.n, pays: principal.p };
    }
  }

  // La forme française et la forme locale sont toutes deux essayées : on
  // garde le meilleur des deux, « Rome » trouvant déjà son aéroport quand
  // « Londres » n'y arrive que par « London ».
  const requetes = [requete, alias(requete)].filter(Boolean);

  let meilleur = null;
  let meilleurScore = 0;

  for (const terme of requetes) {
    for (const aeroport of aeroports) {
      const valeur = score(aeroport, terme);
      if (valeur > meilleurScore) {
        meilleurScore = valeur;
        meilleur = aeroport;
      }
    }
  }

  // Second passage tolérant aux variantes d'orthographe : « Marrakech » en
  // français, « Marrakesh » dans les données. Réservé aux échecs du premier
  // passage, car il coûte un parcours complet de la table.
  if (!meilleur) {
    for (const terme of requetes) {
      for (const aeroport of aeroports) {
        for (const candidat of aeroport._mots) {
          if (!proche(candidat, terme)) continue;

          const valeur = 40 + poids(aeroport);
          if (valeur > meilleurScore) {
            meilleurScore = valeur;
            meilleur = aeroport;
          }
        }
      }
    }
  }

  if (!meilleur) return null;
  return { code: meilleur.c, ville: meilleur.v, nom: meilleur.n, pays: meilleur.p };
}
