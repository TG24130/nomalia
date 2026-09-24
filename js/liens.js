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

import { langue } from './i18n.js';

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

/**
 * Valeur propre à la langue de l'interface, le français à défaut : chaque
 * partenaire a sa version de site par langue (domaine, chemin ou paramètre).
 * @param {{ fr: string, en?: string, es?: string }} valeurs
 * @returns {string}
 */
function selonLangue(valeurs) {
  return valeurs[langue()] ?? valeurs.fr;
}

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

/** Pays couverts par SafariBookings, qui ne propose que l'Afrique. */
const PAYS_SAFARIBOOKINGS = new Set([
  'KE', 'TZ', 'UG', 'RW', 'ZA', 'BW', 'NA', 'ZM', 'ZW', 'MW', 'MZ', 'ET', 'MG', 'CD', 'CG', 'GA',
]);

/**
 * Nom anglais d'un pays, en minuscules et tirets : « south-africa ».
 * @param {string} code ISO 3166-1 alpha-2
 * @returns {string}
 */
function slugPaysAnglais(code) {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' })
      .of(code)
      .toLowerCase()
      .replace(/[^a-z]+/g, '-')
      .replace(/^-+|-+$/g, '');
  } catch {
    return '';
  }
}

/**
 * Critères d'hébergement que Booking sait recevoir dans son lien (`nflt`).
 * Chaque code a été vérifié un à un sur téléphone le 24/09/2026 (4 étoiles
 * pour les étoiles, 3 et 5 suivent le même format). Les autres critères
 * restent à cocher sur le site : l'interface les rappelle.
 */
const FILTRES_BOOKING = {
  piscine: 'hotelfacility=433',
  'petit-dejeuner': 'mealplan=1',
  'annulation-gratuite': 'fc=2',
  parking: 'hotelfacility=2',
  animaux: 'hotelfacility=4',
  'etoiles-3': 'class=3',
  'etoiles-4': 'class=4',
  'etoiles-5': 'class=5',
};

const PARTENAIRES = {
  /* — Transport aérien — */

  googleflights: {
    nom: 'Google Flights',
    affiliateId: null,
    preremplissage: false,
    // Google Flights n'a pas de format d'URL de recherche documenté : le
    // paramètre de requête en langage naturel n'est pas un contrat public.
    construire: () => `https://www.google.com/travel/flights?hl=${langue()}&curr=EUR`,
  },

  skyscanner: {
    nom: 'Skyscanner',
    affiliateId: null,
    preremplissage: 'observe',
    // Format produit par le site lui-même :
    // /transport/vols/{origine}/{destination}/{AAMMJJ}/{AAMMJJ}/
    // Vérifié le 21/09/2026 : la recherche arrive bien préremplie.
    // Les codes d'aéroport viennent de js/aeroports.js ; sans eux, ou sans
    // date, on ouvre la page de recherche.
    construire: ({ iataOrigine, iataDestination, dateDebut, dateFin, adultes, enfants }) => {
      const site = selonLangue({
        fr: 'https://www.skyscanner.fr/transport/vols',
        en: 'https://www.skyscanner.net/transport/flights',
        es: 'https://www.skyscanner.es/transporte/vuelos',
      });
      const accueil = site.replace(/\/transport.*$/, '/');

      if (!iataOrigine || !iataDestination) return accueil;

      const aller = enAaMmJj(dateDebut);
      const retour = enAaMmJj(dateFin);
      if (!aller) return accueil;

      // Le site termine toujours le chemin par une barre oblique ; un aller
      // simple se note en omettant la date de retour.
      const trajet = [iataOrigine, iataDestination, aller, retour]
        .filter(Boolean)
        .join('/')
        .toLowerCase();

      return `${site}/${trajet}/${requete([
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
    construire: () =>
      selonLangue({ fr: 'https://www.thetrainline.com/fr', en: 'https://www.thetrainline.com/', es: 'https://www.thetrainline.com/es' }),
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
    construire: () =>
      selonLangue({ fr: 'https://www.ferryhopper.com/fr/', en: 'https://www.ferryhopper.com/en/', es: 'https://www.ferryhopper.com/es/' }),
  },

  directferries: {
    nom: 'Direct Ferries',
    affiliateId: null,
    preremplissage: false,
    construire: () =>
      selonLangue({ fr: 'https://www.directferries.fr/', en: 'https://www.directferries.co.uk/', es: 'https://www.directferries.es/' }),
  },

  /* — Location de voiture — */

  discovercars: {
    nom: 'DiscoverCars',
    affiliateId: null,
    preremplissage: false,
    construire: () =>
      selonLangue({ fr: 'https://www.discovercars.com/fr', en: 'https://www.discovercars.com/', es: 'https://www.discovercars.com/es' }),
  },

  rentalcars: {
    nom: 'Rentalcars',
    affiliateId: null,
    preremplissage: false,
    construire: () =>
      selonLangue({ fr: 'https://www.rentalcars.com/fr/', en: 'https://www.rentalcars.com/', es: 'https://www.rentalcars.com/es/' }),
  },

  /* — Itinéraire en voiture personnelle — */

  googlemaps: {
    nom: 'Google Maps',
    affiliateId: null,
    preremplissage: 'documente',
    // Format documenté : Google Maps URLs, paramètre api=1.
    construire: ({ origine, destination }) => {
      const parametres = ['api=1', `destination=${encoder(destination)}`, 'travelmode=driving', `hl=${langue()}`];
      if (origine) parametres.splice(1, 0, `origin=${encoder(origine)}`);
      return `https://www.google.com/maps/dir/?${parametres.join('&')}`;
    },
  },

  viamichelin: {
    nom: 'ViaMichelin',
    affiliateId: null,
    preremplissage: false,
    construire: () =>
      selonLangue({ fr: 'https://www.viamichelin.fr/itineraires', en: 'https://www.viamichelin.com/', es: 'https://www.viamichelin.es/' }),
  },

  /* — Vans et camping-cars (tiroir 2) — */

  // Ces loueurs cherchent par agence ou par coordonnées GPS, pas par nom de
  // lieu : aucun format de lien prérempli n'a pu être établi. La recherche
  // web, elle, est préremplie et trouve aussi les loueurs locaux.
  yescapa: {
    nom: 'Yescapa',
    affiliateId: null,
    preremplissage: false,
    construire: () => selonLangue({ fr: 'https://www.yescapa.fr/', en: 'https://www.yescapa.com/', es: 'https://www.yescapa.es/' }),
  },
  indiecampers: { nom: 'Indie Campers', affiliateId: null, preremplissage: false, construire: () => 'https://indiecampers.com/' },
  roadsurfer: { nom: 'Roadsurfer', affiliateId: null, preremplissage: false, construire: () => 'https://roadsurfer.com/' },
  outdoorsy: { nom: 'Outdoorsy', affiliateId: null, preremplissage: false, construire: () => 'https://www.outdoorsy.com/' },
  jucy: { nom: 'Jucy', affiliateId: null, preremplissage: false, construire: () => 'https://www.jucy.com/' },
  motorhomerepublic: {
    nom: 'Motorhome Republic',
    affiliateId: null,
    preremplissage: false,
    construire: () => 'https://www.motorhomerepublic.com/',
  },
  recherchevan: {
    nom: 'Loueurs locaux (Google)',
    noms: { en: 'Local rentals (Google)', es: 'Alquiler local (Google)' },
    affiliateId: null,
    preremplissage: 'documente',
    construire: ({ destination }) =>
      destination
        ? `https://www.google.com/search?hl=${langue()}&q=${encoder(
            `${selonLangue({
              fr: 'location van aménagé camping-car',
              en: 'campervan motorhome rental',
              es: 'alquiler furgoneta camper autocaravana',
            })} ${destination}`
          )}`
        : 'https://www.google.com/',
  },

  /* — Hébergement (tiroir 3) — */

  booking: {
    nom: 'Booking.com',
    affiliateId: null,
    // Format produit par le site : searchresults.fr.html?ss=…&checkin=…
    // Vérifié le 24/09/2026 sur un vrai téléphone : destination, dates et
    // voyageurs arrivent préremplis. Le test du 21/09, qui concluait
    // l'inverse, avait été fait dans un navigateur que Booking bloque.
    preremplissage: 'observe',
    construire: ({ destination, dateDebut, dateFin, adultes, enfants, filtres }) => {
      const suffixe = selonLangue({ fr: 'fr', en: 'en-gb', es: 'es' });
      if (!destination) return `https://www.booking.com/index.${suffixe}.html`;

      const nflt = (filtres ?? [])
        .map((filtre) => FILTRES_BOOKING[filtre])
        .filter(Boolean)
        .join(';');

      return `https://www.booking.com/searchresults.${suffixe}.html${requete([
        ['ss', destination],
        ['checkin', dateDebut],
        ['checkout', dateFin],
        ['group_adults', adultes],
        ['no_rooms', 1],
        ['group_children', enfants],
        ['nflt', nflt],
        // Sans ce paramètre, Booking garde la langue du compte ou du téléphone,
        // quel que soit le suffixe de la page. Avec, l'anglais et l'espagnol
        // s'affichent bien (vérifié sur téléphone le 24/09/2026).
        ['lang', suffixe],
      ])}`;
    },
  },
  hotels: {
    nom: 'Hotels.com',
    affiliateId: null,
    preremplissage: false,
    construire: () => selonLangue({ fr: 'https://fr.hotels.com/', en: 'https://uk.hotels.com/', es: 'https://es.hotels.com/' }),
  },
  // Abritel est la marque française de Vrbo.
  abritel: {
    nom: 'Abritel',
    noms: { en: 'Vrbo', es: 'Vrbo' },
    affiliateId: null,
    preremplissage: false,
    construire: () => selonLangue({ fr: 'https://www.abritel.fr/', en: 'https://www.vrbo.com/', es: 'https://www.vrbo.com/es-es/' }),
  },
  gitesdefrance: {
    nom: 'Gîtes de France',
    affiliateId: null,
    preremplissage: false,
    construire: () =>
      selonLangue({ fr: 'https://www.gites-de-france.com/fr', en: 'https://www.gites-de-france.com/en', es: 'https://www.gites-de-france.com/en' }),
  },
  airbnb: {
    nom: 'Airbnb',
    affiliateId: null,
    preremplissage: 'observe',
    // Format produit par le site : /s/{lieu}/homes?checkin=…&checkout=…
    // Vérifié le 21/09/2026 : la page renvoyée porte bien la destination et
    // les dates demandées, y compris avec un nom accentué.
    construire: ({ destination, dateDebut, dateFin, adultes, enfants }) => {
      const site = selonLangue({ fr: 'https://www.airbnb.fr', en: 'https://www.airbnb.com', es: 'https://www.airbnb.es' });
      if (!destination || !dateDebut) return `${site}/`;

      return `${site}/s/${encoder(destination)}/homes${requete([
        ['checkin', dateDebut],
        ['checkout', dateFin],
        ['adults', adultes],
        ['children', enfants],
      ])}`;
    },
  },

  kayakhotels: {
    nom: 'Kayak',
    affiliateId: null,
    preremplissage: 'observe',
    // Format produit par le site : /hotels/{lieu}/{début}/{fin}/{n}adults
    // Vérifié le 21/09/2026, même méthode qu'Airbnb.
    construire: ({ destination, dateDebut, dateFin, adultes, enfants }) => {
      const site = selonLangue({ fr: 'https://www.kayak.fr', en: 'https://www.kayak.co.uk', es: 'https://www.kayak.es' });
      if (!destination || !dateDebut || !dateFin) return `${site}/hotels`;

      const voyageurs = [`${adultes ?? 1}adults`];
      if (enfants) voyageurs.push(`${enfants}children`);

      return `${site}/hotels/${encoder(destination)}/${dateDebut}/${dateFin}/${voyageurs.join('/')}`;
    },
  },
  pitchup: {
    nom: 'Pitchup',
    affiliateId: null,
    preremplissage: false,
    construire: () => selonLangue({ fr: 'https://www.pitchup.com/fr/', en: 'https://www.pitchup.com/', es: 'https://www.pitchup.com/es/' }),
  },

  /* — Activités (tiroir 4) — */

  getyourguide: {
    nom: 'GetYourGuide',
    affiliateId: null,
    preremplissage: 'observe',
    // Recherche par nom de lieu (CLAUDE.md §6, tiroir 4). Plus proposé dans
    // l'app : sur téléphone, l'app GetYourGuide intercepte le lien et ouvre
    // son accueil (24/09/2026). Gardé pour l'affiliation prévue.
    construire: ({ requete, destination }) => {
      const termes = [requete, destination].filter(Boolean).join(' ');
      const site = selonLangue({ fr: 'https://www.getyourguide.fr', en: 'https://www.getyourguide.com', es: 'https://www.getyourguide.es' });
      if (!termes) return `${site}/`;
      return `${site}/s/?q=${encoder(termes)}`;
    },
  },

  viator: {
    nom: 'Viator',
    affiliateId: null,
    preremplissage: 'observe',
    construire: ({ requete, destination }) => {
      const termes = [requete, destination].filter(Boolean).join(' ');
      const locale = selonLangue({ fr: 'fr-FR', en: 'en-GB', es: 'es-ES' });
      if (!termes) return `https://www.viator.com/${locale}/`;
      return `https://www.viator.com/${locale}/searchResults/all?text=${encoder(termes)}`;
    },
  },

  /* — Safaris organisés (tiroir 4) — */

  // Comparateur des opérateurs locaux, pour l'Afrique seulement. Page par
  // pays : /tours/{pays en anglais}. Les pages par durée n'existent que pour
  // quelques durées (« 5-day-kenya » renvoie une 404, vérifié le 24/09/2026) ;
  // la durée se filtre donc sur la page.
  safaribookings: {
    nom: 'SafariBookings',
    affiliateId: null,
    preremplissage: 'observe',
    construire: ({ pays }) =>
      PAYS_SAFARIBOOKINGS.has(pays)
        ? `https://www.safaribookings.com/tours/${slugPaysAnglais(pays)}`
        : 'https://www.safaribookings.com/',
  },

  // Circuits de plusieurs jours : /i/{pays}-safari. Vérifiés sur téléphone le
  // 24/09/2026 (Kenya, Afrique du Sud, Inde), comme SafariBookings : les deux
  // sites n'existent qu'en anglais.
  tourradar: {
    nom: 'TourRadar',
    affiliateId: null,
    preremplissage: 'observe',
    construire: ({ pays }) =>
      pays ? `https://www.tourradar.com/i/${slugPaysAnglais(pays)}-safari` : 'https://www.tourradar.com/',
  },

  /* — Randonnées (tiroir 5) — */

  // Visorando n'expose aucun format de recherche exploitable : quatre formats
  // testés, aucun ne reflète le terme demandé.
  visorando: {
    nom: 'Visorando',
    affiliateId: null,
    preremplissage: false,
    construire: () => 'https://www.visorando.com/',
  },

  // Recherche web du tracé, plutôt qu'un lien Komoot : sur téléphone, l'app
  // Komoot intercepte le lien et ouvre son accueil sans reprendre la
  // recherche (constaté le 24/09/2026). Les résultats pointent vers la page
  // précise de l'itinéraire chez Komoot, AllTrails ou Visorando, que les
  // applications, elles, savent ouvrir.
  recherchetrace: {
    nom: 'Google',
    affiliateId: null,
    preremplissage: 'documente',
    construire: ({ requete, destination }) => {
      const termes = [requete, destination].filter(Boolean).join(' ');
      if (!termes) return 'https://www.google.com/';
      const mot = selonLangue({ fr: 'randonnée', en: 'hike', es: 'ruta senderismo' });
      return `https://www.google.com/search?hl=${langue()}&q=${encoder(`${termes} ${mot}`)}`;
    },
  },

  alltrails: {
    nom: 'AllTrails',
    affiliateId: null,
    preremplissage: false,
    construire: () =>
      selonLangue({ fr: 'https://www.alltrails.com/fr', en: 'https://www.alltrails.com/', es: 'https://www.alltrails.com/es' }),
  },

  /* — Repérage d'un lieu sur une carte — */

  googlemapslieu: {
    nom: 'Google Maps',
    affiliateId: null,
    preremplissage: 'documente',
    // Format documenté : Google Maps URLs, recherche par requête.
    construire: ({ requete, destination }) =>
      `https://www.google.com/maps/search/?api=1&hl=${langue()}&query=${encoder([requete, destination].filter(Boolean).join(' '))}`,
  },
};

/**
 * Nom affichable d'un partenaire.
 * @param {string} cle
 * @returns {string}
 */
export function nomPartenaire(cle) {
  const entree = PARTENAIRES[cle];
  return entree?.noms?.[langue()] ?? entree?.nom ?? cle;
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

  // Chaque constructeur retombe sur la même page de recherche quand il lui
  // manque un élément : si le lien produit en diffère, c'est qu'il porte
  // réellement la recherche.
  return (
    entree.construire(params, entree.affiliateId) !== entree.construire({}, entree.affiliateId)
  );
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
