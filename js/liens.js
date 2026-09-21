/**
 * liens.js — TOUS les liens de réservation de l'application.
 *
 * Aucun autre fichier ne construit d'URL de réservation (CLAUDE.md §3.4).
 *
 * Trois niveaux de lien, distingués par `preremplissage` :
 *  - `'documente'` : le partenaire publie le format de ses URL de recherche ;
 *  - `'observe'`   : le format est celui que le site produit lui-même dans la
 *                    barre d'adresse lors d'une recherche. Il fonctionne, mais
 *                    rien n'engage le partenaire à le maintenir : si un jour il
 *                    change, le lien retombera sur la page d'accueil du site ;
 *  - `false`       : aucun format exploitable, ou identifiants internes hors de
 *                    portée (identifiants de gare). Le lien ouvre la page de
 *                    recherche et l'interface rappelle les critères à saisir.
 *
 * Aucune URL n'est devinée : mieux vaut une page de recherche vide qu'un lien
 * fabriqué qui tombe en erreur (CLAUDE.md §3.6).
 *
 * Le préremplissage n'est possible que si la date de départ est renseignée et,
 * pour les vols, si les codes d'aéroport ont pu être résolus. Sinon chaque
 * constructeur se rabat de lui-même sur la page de recherche.
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

/**
 * Convertit une date ISO en AAMMJJ, format attendu par certains comparateurs.
 * @param {string} date AAAA-MM-JJ
 * @returns {string|null}
 */
function enAaMmJj(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) return null;
  return date.slice(2).replace(/-/g, '');
}

/**
 * Construit une chaîne de requête à partir des paires renseignées.
 * @param {Array<[string, string|number|undefined|null]>} paires
 * @returns {string}
 */
function requete(paires) {
  const retenues = paires
    .filter(([, valeur]) => valeur !== undefined && valeur !== null && valeur !== '')
    .map(([cle, valeur]) => `${cle}=${encoder(valeur)}`);

  return retenues.length ? `?${retenues.join('&')}` : '';
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
    preremplissage: 'observe',
    // Format produit par le site lui-même :
    // /transport/vols/{origine}/{destination}/{AAMMJJ}/{AAMMJJ}/
    // Les codes d'aéroport viennent de js/aeroports.js ; sans eux, ou sans
    // date, on ouvre la page de recherche.
    construire: ({ iataOrigine, iataDestination, dateDebut, dateFin, adultes, enfants }) => {
      if (!iataOrigine || !iataDestination) return 'https://www.skyscanner.fr/';

      const aller = enAaMmJj(dateDebut);
      const retour = enAaMmJj(dateFin);
      if (!aller) return 'https://www.skyscanner.fr/';

      // Le site termine toujours le chemin par une barre oblique ; un aller
      // simple se note en omettant la date de retour.
      const trajet = [iataOrigine, iataDestination, aller, retour]
        .filter(Boolean)
        .join('/')
        .toLowerCase();

      return `https://www.skyscanner.fr/transport/vols/${trajet}/${requete([
        ['adults', adultes],
        ['children', enfants],
      ])}`;
    },
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
    preremplissage: 'documente',
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

  booking: {
    nom: 'Booking.com',
    affiliateId: null,
    preremplissage: 'observe',
    // Format produit par le site : searchresults.fr.html?ss=…&checkin=…
    construire: ({ destination, dateDebut, dateFin, adultes, enfants }) => {
      if (!destination || !dateDebut) return 'https://www.booking.com/index.fr.html';

      return `https://www.booking.com/searchresults.fr.html${requete([
        ['ss', destination],
        ['checkin', dateDebut],
        ['checkout', dateFin],
        ['group_adults', adultes],
        ['group_children', enfants],
        ['no_rooms', 1],
      ])}`;
    },
  },
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
    preremplissage: 'documente',
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
 * Indique si le lien peut arriver prérempli chez le partenaire.
 *
 * Répond sur la capacité du partenaire, pas sur le lien construit : un
 * partenaire capable de préremplissage ouvrira quand même sa page de recherche
 * si la date de départ manque. Passer `params` permet de trancher sur le lien
 * réellement produit.
 *
 * @param {string} cle
 * @param {ParamsLien} [params]
 * @returns {boolean}
 */
export function estPrerempli(cle, params) {
  const entree = PARTENAIRES[cle];
  if (!entree || entree.preremplissage === false) return false;
  if (!params) return true;

  // Un lien prérempli porte toujours des paramètres ou un chemin de recherche.
  const url = entree.construire(params, entree.affiliateId);
  return url.includes('?') || /\/\w{3}\/\w{3}\//.test(url);
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
