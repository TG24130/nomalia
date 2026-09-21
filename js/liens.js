/**
 * liens.js — TOUS les liens de réservation de l'application.
 *
 * Aucun autre fichier ne construit d'URL de réservation (CLAUDE.md §3.4).
 *
 * Deux niveaux de lien, distingués par `preremplissage` :
 *  - `true`  : le format d'URL est documenté par le partenaire, la recherche
 *              arrive préremplie ;
 *  - `false` : le partenaire n'expose pas de format d'URL de recherche public,
 *              ou celui-ci repose sur des identifiants internes (codes IATA,
 *              identifiants de gare). Le lien ouvre alors la page de recherche
 *              du site, et l'interface rappelle les critères à saisir.
 *
 * Aucune URL n'est devinée : mieux vaut une page de recherche vide qu'un lien
 * fabriqué qui tombe en erreur (CLAUDE.md §3.6).
 *
 * `affiliateId` est à null partout : la monétisation n'est pas au programme de
 * la V0, mais le paramètre sera ajouté ici, sans toucher aux appelants.
 */

/**
 * @typedef {object} ParamsLien
 * @property {string} [destination] destination du voyage
 * @property {string} [origine] point de départ, pour les itinéraires
 * @property {string} [dateDebut] date ISO (AAAA-MM-JJ), si connue
 * @property {string} [dateFin] date ISO (AAAA-MM-JJ), si connue
 * @property {number} [adultes]
 * @property {number} [enfants]
 * @property {string} [requete] texte libre, pour une recherche par nom
 */

/** Encode une valeur pour une chaîne de requête. */
function encoder(valeur) {
  return encodeURIComponent(String(valeur ?? '').trim());
}

const PARTENAIRES = {
  /* — Transport aérien — */

  googleflights: {
    nom: 'Google Flights',
    affiliateId: null,
    preremplissage: false,
    // Google Flights n'a pas de format d'URL de recherche documenté : le
    // paramètre de requête en langage naturel n'est pas un contrat public.
    construire: () => 'https://www.google.com/travel/flights?hl=fr&curr=EUR',
  },

  skyscanner: {
    nom: 'Skyscanner',
    affiliateId: null,
    preremplissage: false,
    // Le format /transport/vols/{origine}/{destination}/ attend des codes
    // d'aéroport, que l'application ne connaît pas (hors périmètre V0).
    construire: () => 'https://www.skyscanner.fr/',
  },

  /* — Train — */

  trainline: {
    nom: 'Trainline',
    affiliateId: null,
    preremplissage: false,
    construire: () => 'https://www.thetrainline.com/fr',
  },

  sncfconnect: {
    nom: 'SNCF Connect',
    affiliateId: null,
    preremplissage: false,
    construire: () => 'https://www.sncf-connect.com/',
  },

  /* — Bateau — */

  ferryhopper: {
    nom: 'Ferryhopper',
    affiliateId: null,
    preremplissage: false,
    construire: () => 'https://www.ferryhopper.com/fr/',
  },

  directferries: {
    nom: 'Direct Ferries',
    affiliateId: null,
    preremplissage: false,
    construire: () => 'https://www.directferries.fr/',
  },

  /* — Location de voiture — */

  discovercars: {
    nom: 'DiscoverCars',
    affiliateId: null,
    preremplissage: false,
    construire: () => 'https://www.discovercars.com/fr',
  },

  rentalcars: {
    nom: 'Rentalcars',
    affiliateId: null,
    preremplissage: false,
    construire: () => 'https://www.rentalcars.com/fr/',
  },

  /* — Itinéraire en voiture personnelle — */

  googlemaps: {
    nom: 'Google Maps',
    affiliateId: null,
    preremplissage: true,
    // Format documenté : Google Maps URLs, paramètre api=1.
    construire: ({ origine, destination }) => {
      const parametres = ['api=1', `destination=${encoder(destination)}`, 'travelmode=driving'];
      if (origine) parametres.splice(1, 0, `origin=${encoder(origine)}`);
      return `https://www.google.com/maps/dir/?${parametres.join('&')}`;
    },
  },

  viamichelin: {
    nom: 'ViaMichelin',
    affiliateId: null,
    preremplissage: false,
    construire: () => 'https://www.viamichelin.fr/itineraires',
  },

  /* — Hébergement (tiroir 3) — */

  booking: { nom: 'Booking.com', affiliateId: null, preremplissage: false, construire: () => 'https://www.booking.com/index.fr.html' },
  hotels: { nom: 'Hotels.com', affiliateId: null, preremplissage: false, construire: () => 'https://fr.hotels.com/' },
  abritel: { nom: 'Abritel', affiliateId: null, preremplissage: false, construire: () => 'https://www.abritel.fr/' },
  gitesdefrance: { nom: 'Gîtes de France', affiliateId: null, preremplissage: false, construire: () => 'https://www.gites-de-france.com/fr' },
  airbnb: { nom: 'Airbnb', affiliateId: null, preremplissage: false, construire: () => 'https://www.airbnb.fr/' },
  pitchup: { nom: 'Pitchup', affiliateId: null, preremplissage: false, construire: () => 'https://www.pitchup.com/fr/' },

  /* — Activités (tiroir 4) — */

  getyourguide: { nom: 'GetYourGuide', affiliateId: null, preremplissage: false, construire: () => 'https://www.getyourguide.fr/' },
  viator: { nom: 'Viator', affiliateId: null, preremplissage: false, construire: () => 'https://www.viator.com/fr-FR/' },

  /* — Randonnées (tiroir 5) — */

  visorando: { nom: 'Visorando', affiliateId: null, preremplissage: false, construire: () => 'https://www.visorando.com/' },
  komoot: { nom: 'Komoot', affiliateId: null, preremplissage: false, construire: () => 'https://www.komoot.fr/' },
  alltrails: { nom: 'AllTrails', affiliateId: null, preremplissage: false, construire: () => 'https://www.alltrails.com/fr' },

  /* — Repérage d'un lieu sur une carte — */

  googlemapslieu: {
    nom: 'Google Maps',
    affiliateId: null,
    preremplissage: true,
    // Format documenté : Google Maps URLs, recherche par requête.
    construire: ({ requete, destination }) =>
      `https://www.google.com/maps/search/?api=1&query=${encoder([requete, destination].filter(Boolean).join(' '))}`,
  },
};

/**
 * Nom affichable d'un partenaire.
 * @param {string} cle
 * @returns {string}
 */
export function nomPartenaire(cle) {
  return PARTENAIRES[cle]?.nom ?? cle;
}

/**
 * Indique si le lien arrive prérempli chez le partenaire.
 * @param {string} cle
 * @returns {boolean}
 */
export function estPrerempli(cle) {
  return PARTENAIRES[cle]?.preremplissage === true;
}

/**
 * Construit l'URL de recherche chez un partenaire.
 *
 * @param {string} partenaire clé dans PARTENAIRES
 * @param {ParamsLien} [params]
 * @returns {string}
 * @throws {Error} si le partenaire est inconnu
 */
export function lienReservation(partenaire, params = {}) {
  const entree = PARTENAIRES[partenaire];

  if (!entree) {
    throw new Error(`Partenaire inconnu : ${partenaire}`);
  }

  const url = entree.construire(params, entree.affiliateId);

  // Quand la monétisation sera en place, l'identifiant d'affiliation sera
  // ajouté ici pour tous les partenaires d'un coup.
  if (!entree.affiliateId) return url;

  const separateur = url.includes('?') ? '&' : '?';
  return `${url}${separateur}aid=${encoder(entree.affiliateId)}`;
}
