/**
 * aeroports.js — résolution d'un nom de lieu en code d'aéroport IATA.
 *
 * Sert à préremplir les liens des comparateurs de vols, qui attendent des
 * codes (« BOD », « HER ») et non des noms de ville.
 *
 * La table vient de data/aeroports.json, produite par
 * scripts/generer-aeroports.mjs à partir des données publiques OurAirports.
 * Elle est chargée à la demande : inutile de la lire tant que l'utilisateur
 * n'a pas atteint le tiroir Transport.
 *
 * Quand aucun aéroport ne correspond, la fonction renvoie null et l'appelant
 * se rabat sur un lien non prérempli : jamais de code inventé.
 */

/** Longueur minimale d'un terme pour autoriser une correspondance partielle. */
const LONGUEUR_MINIMALE = 4;

/**
 * Mots trop courants pour identifier un lieu.
 *
 * Sans eux, « International » rapprocherait n'importe quels aéroports.
 */
const MOTS_VIDES = new Set([
  'airport', 'international', 'aeroport', 'aeropuerto', 'flughafen', 'aeroporto',
  'regional', 'municipal', 'national', 'field', 'island', 'islands', 'city',
  'north', 'south', 'east', 'west', 'saint', 'sainte', 'base', 'force',
]);

let table = null;
let chargement = null;

/**
 * Normalise un libellé pour la comparaison : sans accent, sans ponctuation.
 * @param {string} texte
 * @returns {string}
 */
function normaliser(texte) {
  return String(texte ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Charge la table une seule fois.
 * @returns {Promise<Array<object>>}
 */
async function charger() {
  if (table) return table;

  if (!chargement) {
    chargement = fetch('data/aeroports.json')
      .then((reponse) => {
        if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
        return reponse.json();
      })
      .then((donnees) => {
        table = donnees.aeroports.map((aeroport) => {
          const ville = normaliser(aeroport.v);
          const nom = normaliser(aeroport.n);
          const motsCles = (aeroport.k ?? '').split(',').map(normaliser).filter(Boolean);

          // Le nom courant d'une ville se cache souvent dans le nom de
          // l'aéroport plutôt que dans la commune : Athènes est à
          // « Spata-Artemida », Venise à « Venezia (VE) ».
          const mots = new Set(
            `${ville} ${nom} ${motsCles.join(' ')}`
              .split(' ')
              .filter((mot) => mot.length >= LONGUEUR_MINIMALE && !MOTS_VIDES.has(mot))
          );

          return { ...aeroport, _ville: ville, _nom: nom, _motsCles: motsCles, _mots: [...mots] };
        });
        return table;
      })
      .catch((erreur) => {
        console.warn('Table des aéroports indisponible', erreur);
        table = [];
        return table;
      });
  }

  return chargement;
}

/**
 * Mesure la correspondance entre une requête et un aéroport.
 *
 * Les deux sens d'inclusion sont testés : « Lisbonne » doit trouver « Lisbon »,
 * et « Crète » doit trouver le mot-clé « Crete Island ».
 *
 * @param {object} aeroport entrée normalisée de la table
 * @param {string} requete requête normalisée
 * @returns {number} score, 0 si aucune correspondance
 */
function score(aeroport, requete) {
  // Le bonus est volontairement élevé : « Crète » correspond exactement à la
  // « ville » du petit aéroport de Sitia, alors que le voyageur attend
  // Héraklion, qui ne porte ce nom que dans ses mots-clés.
  const bonusTaille = aeroport.t === 2 ? 25 : 0;

  const correspond = (valeur, points) => {
    if (!valeur) return 0;
    if (valeur === requete) return points;
    if (requete.length < LONGUEUR_MINIMALE || valeur.length < LONGUEUR_MINIMALE) return 0;

    // La requête doit former un mot entier de la valeur : « Crète » retrouve
    // « Crete Island », mais « Bali » ne doit pas retrouver « Balikpapan ».
    if (valeur.split(' ').includes(requete)) return points - 10;

    // Sens inverse, pour les noms francisés : « Lisbonne » retrouve « Lisbon ».
    // La valeur doit rester proche de la requête, sinon tout finit par
    // correspondre à tout.
    if (requete.includes(valeur) && valeur.length >= requete.length * 0.75) {
      return points - 20;
    }

    return 0;
  };

  const scores = [
    correspond(aeroport._ville, 80),
    correspond(aeroport._nom, 45),
    ...aeroport._motsCles.map((motCle) => correspond(motCle, 60)),
    // Un mot isolé du nom ou de la commune : « Athens » dans
    // « Athens Eleftherios Venizelos International Airport ».
    ...aeroport._mots.map((mot) => (mot === requete ? 55 : 0)),
  ];

  const meilleur = Math.max(...scores);
  if (meilleur <= 0) return 0;

  // Départage deux aéroports d'une même ville en faveur du principal : celui
  // qui porte le nom de la ville dans le sien (Rome–Fiumicino plutôt que
  // Ciampino, qui dessert Rome sans la nommer).
  const bonusNom = aeroport._nom.includes(requete) ? 3 : 0;
  const bonusInternational = aeroport._nom.includes('international') ? 2 : 0;
  return meilleur + bonusTaille + bonusNom + bonusInternational;
}

/**
 * Dit si deux libellés ne diffèrent que par une ou deux lettres.
 *
 * Distance de Levenshtein bornée à 2, arrêtée dès que l'écart de longueur la
 * dépasse : suffisant pour rattraper « Marrakech » / « Marrakesh » sans
 * rapprocher des villes réellement différentes.
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function proche(a, b) {
  if (!a || !b) return false;
  if (a.length < 5 || b.length < 5) return false;
  if (Math.abs(a.length - b.length) > 2) return false;

  // Sans début commun, deux mots à deux lettres d'écart n'ont rien à voir :
  // « Athènes » et « Andenes » ne doivent pas se rapprocher, contrairement à
  // « Marrakech » et « Marrakesh ».
  let commun = 0;
  while (commun < a.length && commun < b.length && a[commun] === b[commun]) commun += 1;
  if (commun < 4) return false;

  let precedente = Array.from({ length: b.length + 1 }, (_, index) => index);

  for (let i = 1; i <= a.length; i += 1) {
    const courante = [i];
    let minimum = i;

    for (let j = 1; j <= b.length; j += 1) {
      const cout = a[i - 1] === b[j - 1] ? 0 : 1;
      const valeur = Math.min(
        precedente[j] + 1,
        courante[j - 1] + 1,
        precedente[j - 1] + cout
      );
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

  let meilleur = null;
  let meilleurScore = 0;

  for (const aeroport of aeroports) {
    const valeur = score(aeroport, requete);
    if (valeur > meilleurScore) {
      meilleurScore = valeur;
      meilleur = aeroport;
    }
  }

  // Second passage tolérant aux variantes d'orthographe : « Marrakech » en
  // français, « Marrakesh » dans les données. Réservé aux échecs du premier
  // passage, car il coûte un parcours complet de la table.
  if (!meilleur) {
    for (const aeroport of aeroports) {
      for (const candidat of aeroport._mots) {
        if (!proche(candidat, requete)) continue;

        const valeur = 40 + (aeroport.t === 2 ? 25 : 0);
        if (valeur > meilleurScore) {
          meilleurScore = valeur;
          meilleur = aeroport;
        }
      }
    }
  }

  if (!meilleur) return null;
  return { code: meilleur.c, ville: meilleur.v, nom: meilleur.n, pays: meilleur.p };
}
