/**
 * gares.js — résolution d'un nom de lieu en gare ferroviaire.
 *
 * Pendant de js/aeroports.js pour le train. Même principe : retrouver
 * l'entité principale d'une ville plutôt qu'une halte homonyme.
 *
 * La table vient de data/gares.json, produite par scripts/generer-gares.mjs à
 * partir du référentiel ouvert trainline-eu/stations. Elle ne contient que les
 * entrées « ville » et les gares principales : c'est ce qu'un voyageur saisit.
 *
 * À ce jour, ni Trainline ni SNCF Connect ne publient de format d'URL de
 * recherche exploitable. La gare résolue sert donc à afficher au voyageur ce
 * qu'il devra saisir, et le jour où l'un des deux expose un format, tout est
 * prêt côté données.
 */

import {
  alias,
  chargeurTable,
  correspondance,
  motsSignificatifs,
  normaliser,
  proche,
} from './recherche-lieux.js';

const charger = chargeurTable('data/gares.json', (donnees) =>
  donnees.gares.map((gare) => {
    const nom = normaliser(gare.n);
    return { ...gare, _nom: nom, _mots: motsSignificatifs(nom) };
  })
);

/**
 * Poids d'une gare : une entrée « ville » regroupe toutes les gares de
 * l'agglomération et prime sur une gare particulière, qui prime elle-même sur
 * une halte. « Paris » doit l'emporter sur « Paris Gare du Nord ».
 *
 * @param {object} gare
 * @returns {number}
 */
function poids(gare) {
  return gare.r === 2 ? 30 : 10;
}

/**
 * Mesure la correspondance entre une requête et une gare.
 * @param {object} gare entrée préparée de la table
 * @param {string} requete requête normalisée
 * @returns {number} score, 0 si aucune correspondance
 */
function score(gare, requete) {
  const scores = [
    correspondance(gare._nom, requete, 80),
    ...gare._mots.map((mot) => (mot === requete ? 55 : 0)),
  ];

  const meilleur = Math.max(...scores);
  return meilleur > 0 ? meilleur + poids(gare) : 0;
}

/**
 * Cherche la gare correspondant à un lieu.
 *
 * @param {string} lieu nom de ville ou de gare
 * @returns {Promise<{ nom: string, pays: string, sncf: string|null, estVille: boolean }|null>}
 */
export async function chercherGare(lieu) {
  const requete = normaliser(lieu);
  if (requete.length < 2) return null;

  const gares = await charger();
  if (!gares.length) return null;

  // Forme française et forme locale, comme pour les aéroports.
  const requetes = [requete, alias(requete)].filter(Boolean);

  let meilleure = null;
  let meilleurScore = 0;

  for (const terme of requetes) {
    for (const gare of gares) {
      const valeur = score(gare, terme);
      if (valeur > meilleurScore) {
        meilleurScore = valeur;
        meilleure = gare;
      }
    }
  }

  if (!meilleure) {
    for (const terme of requetes) {
      for (const gare of gares) {
        for (const candidat of gare._mots) {
          if (!proche(candidat, terme)) continue;

          const valeur = 40 + poids(gare);
          if (valeur > meilleurScore) {
            meilleurScore = valeur;
            meilleure = gare;
          }
        }
      }
    }
  }

  if (!meilleure) return null;
  return {
    nom: meilleure.n,
    pays: meilleure.p,
    sncf: meilleure.s ?? null,
    estVille: meilleure.r === 2,
  };
}
