/**
 * liens.js — TOUS les liens de réservation de l'application.
 *
 * Aucun autre fichier ne construit d'URL de réservation (CLAUDE.md §3.4).
 * Chaque partenaire porte un champ `affiliateId` à null, prévu pour la
 * monétisation ultérieure : quand il sera renseigné, le paramètre sera
 * ajouté automatiquement, sans toucher aux appelants.
 *
 * À implémenter à l'étape 7 du plan V0 — vérifier d'abord le format réel
 * des URL de recherche de chaque site.
 */

/** @typedef {{ destination: string, dateDebut?: string, dateFin?: string,
 *              adultes?: number, enfants?: number, requete?: string }} ParamsLien */

const PARTENAIRES = {
  // transport
  googleflights: { nom: 'Google Flights', affiliateId: null, construire: null },
  skyscanner: { nom: 'Skyscanner', affiliateId: null, construire: null },
  trainline: { nom: 'Trainline', affiliateId: null, construire: null },
  sncfconnect: { nom: 'SNCF Connect', affiliateId: null, construire: null },
  ferryhopper: { nom: 'Ferryhopper', affiliateId: null, construire: null },
  directferries: { nom: 'Direct Ferries', affiliateId: null, construire: null },
  discovercars: { nom: 'DiscoverCars', affiliateId: null, construire: null },
  rentalcars: { nom: 'Rentalcars', affiliateId: null, construire: null },
  googlemaps: { nom: 'Google Maps', affiliateId: null, construire: null },
  viamichelin: { nom: 'ViaMichelin', affiliateId: null, construire: null },

  // hébergement
  booking: { nom: 'Booking.com', affiliateId: null, construire: null },
  hotels: { nom: 'Hotels.com', affiliateId: null, construire: null },
  abritel: { nom: 'Abritel', affiliateId: null, construire: null },
  gitesdefrance: { nom: 'Gîtes de France', affiliateId: null, construire: null },
  airbnb: { nom: 'Airbnb', affiliateId: null, construire: null },
  pitchup: { nom: 'Pitchup', affiliateId: null, construire: null },

  // activités
  getyourguide: { nom: 'GetYourGuide', affiliateId: null, construire: null },
  viator: { nom: 'Viator', affiliateId: null, construire: null },

  // randonnées
  visorando: { nom: 'Visorando', affiliateId: null, construire: null },
  komoot: { nom: 'Komoot', affiliateId: null, construire: null },
  alltrails: { nom: 'AllTrails', affiliateId: null, construire: null },
};

/** Nom affichable d'un partenaire. */
export function nomPartenaire(cle) {
  return PARTENAIRES[cle]?.nom ?? cle;
}

/**
 * Construit une URL de recherche chez un partenaire.
 * @param {keyof PARTENAIRES} partenaire
 * @param {ParamsLien} params
 * @returns {string}
 */
export function lienReservation(partenaire, params) {
  const entree = PARTENAIRES[partenaire];
  if (!entree || typeof entree.construire !== 'function') {
    throw new Error(`Partenaire non implémenté : ${partenaire}`);
  }
  return entree.construire(params, entree.affiliateId);
}
