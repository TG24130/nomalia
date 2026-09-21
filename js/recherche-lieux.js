/**
 * recherche-lieux.js — primitives de rapprochement d'un nom de lieu.
 *
 * Partagées par js/aeroports.js et js/gares.js, qui résolvent le même genre de
 * problème : retrouver une entité à partir d'un nom saisi librement, en
 * français, alors que les référentiels sont en langue locale ou en anglais.
 */

/** Longueur minimale d'un terme pour autoriser une correspondance partielle. */
export const LONGUEUR_MINIMALE = 4;

/**
 * Mots trop courants pour identifier un lieu.
 *
 * Sans eux, « International » ou « Gare » rapprocherait n'importe quoi.
 */
const MOTS_VIDES = new Set([
  'airport', 'international', 'aeroport', 'aeropuerto', 'flughafen', 'aeroporto',
  'regional', 'municipal', 'national', 'field', 'island', 'islands', 'city',
  'north', 'south', 'east', 'west', 'saint', 'sainte', 'base', 'force',
  'gare', 'station', 'bahnhof', 'estacion', 'stazione', 'centrale', 'central',
  'ville', 'centre', 'center', 'terminal',
]);

/**
 * Noms français de villes trop éloignés de leur forme locale pour être
 * rapprochés automatiquement.
 *
 * « Barcelone » et « Barcelona » ne diffèrent que d'une lettre et se
 * retrouvent seuls ; « Londres » et « London » en diffèrent de trois, et
 * aucun seuil raisonnable ne les rapprocherait sans rapprocher aussi des
 * villes sans rapport. Une table les traite sans risque.
 *
 * Les clés sont normalisées : sans accent ni ponctuation.
 */
const ALIAS = new Map(
  Object.entries({
    londres: 'london',
    edimbourg: 'edinburgh',
    douvres: 'dover',
    copenhague: 'copenhagen',
    munich: 'munchen',
    cologne: 'koln',
    francfort: 'frankfurt',
    mayence: 'mainz',
    'aix la chapelle': 'aachen',
    seville: 'sevilla',
    'saint jacques de compostelle': 'santiago de compostela',
    genes: 'genova',
    naples: 'napoli',
    florence: 'firenze',
    turin: 'torino',
    venise: 'venezia',
    milan: 'milano',
    rome: 'roma',
    geneve: 'geneva',
    bale: 'basel',
    berne: 'bern',
    anvers: 'antwerpen',
    gand: 'gent',
    bruges: 'brugge',
    'la haye': 'den haag',
    vienne: 'wien',
    prague: 'praha',
    varsovie: 'warszawa',
    bucarest: 'bucuresti',
    belgrade: 'beograd',
    moscou: 'moscow',
    lisbonne: 'lisboa',
  })
);

/**
 * Renvoie la forme locale d'un nom de ville français, si elle est connue.
 * @param {string} requete requête normalisée
 * @returns {string|null}
 */
export function alias(requete) {
  return ALIAS.get(requete) ?? null;
}

/**
 * Normalise un libellé pour la comparaison : sans accent, sans ponctuation.
 * @param {string} texte
 * @returns {string}
 */
export function normaliser(texte) {
  return String(texte ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Extrait les mots porteurs de sens d'un ou plusieurs libellés.
 * @param {...string} libelles libellés déjà normalisés
 * @returns {string[]}
 */
export function motsSignificatifs(...libelles) {
  const mots = new Set(
    libelles
      .join(' ')
      .split(' ')
      .filter((mot) => mot.length >= LONGUEUR_MINIMALE && !MOTS_VIDES.has(mot))
  );

  return [...mots];
}

/**
 * Mesure la correspondance entre une requête et un libellé.
 *
 * Les deux sens d'inclusion sont traités : « Lisbonne » doit trouver
 * « Lisbon », et « Crète » doit trouver « Crete Island ». L'inclusion simple
 * est refusée, sans quoi « Bali » retrouverait « Balikpapan ».
 *
 * @param {string} valeur libellé normalisé
 * @param {string} requete requête normalisée
 * @param {number} points score d'une correspondance exacte
 * @returns {number}
 */
export function correspondance(valeur, requete, points) {
  if (!valeur) return 0;
  if (valeur === requete) return points;
  if (requete.length < LONGUEUR_MINIMALE || valeur.length < LONGUEUR_MINIMALE) return 0;

  // La requête doit former un mot entier du libellé.
  if (valeur.split(' ').includes(requete)) return points - 10;

  // Sens inverse, pour les noms francisés. Le libellé doit rester proche de la
  // requête, sinon tout finit par correspondre à tout.
  if (requete.includes(valeur) && valeur.length >= requete.length * 0.75) {
    return points - 20;
  }

  return 0;
}

/**
 * Dit si deux libellés ne diffèrent que par une ou deux lettres.
 *
 * Distance de Levenshtein bornée à 2, avec début commun obligatoire :
 * rattrape « Marrakech » / « Marrakesh » sans rapprocher « Athènes » et
 * « Andenes », qui ne partagent que leur première lettre.
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
export function proche(a, b) {
  if (!a || !b) return false;
  if (a.length < 5 || b.length < 5) return false;
  if (Math.abs(a.length - b.length) > 2) return false;

  let commun = 0;
  while (commun < a.length && commun < b.length && a[commun] === b[commun]) commun += 1;
  if (commun < 4) return false;

  let precedente = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let i = 1; i <= a.length; i += 1) {
    const courante = [i];
    let minimum = i;

    for (let j = 1; j <= b.length; j += 1) {
      const cout = a[i - 1] === b[j - 1] ? 0 : 1;
      const valeur = Math.min(precedente[j] + 1, courante[j - 1] + 1, precedente[j - 1] + cout);
      courante.push(valeur);
      if (valeur < minimum) minimum = valeur;
    }

    // Toute la ligne dépasse déjà le seuil : inutile de continuer.
    if (minimum > 2) return false;
    precedente = courante;
  }

  return precedente[b.length] <= 2;
}

/**
 * Charge un fichier de données une seule fois, sans faire échouer l'appelant.
 *
 * @param {string} chemin chemin relatif du fichier
 * @param {(donnees: object) => Array<object>} preparer transforme le contenu
 * @returns {() => Promise<Array<object>>} accesseur à la table
 */
export function chargeurTable(chemin, preparer) {
  let table = null;
  let chargement = null;

  return function charger() {
    if (table) return Promise.resolve(table);

    if (!chargement) {
      chargement = fetch(chemin)
        .then((reponse) => {
          if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
          return reponse.json();
        })
        .then((donnees) => {
          table = preparer(donnees);
          return table;
        })
        .catch((erreur) => {
          // Une table absente prive du préremplissage, jamais de l'application.
          console.warn(`Table ${chemin} indisponible`, erreur);
          table = [];
          return table;
        });
    }

    return chargement;
  };
}
