/**
 * saisie.js — tiroir 0 « Saisie ».
 *
 * Deux usages :
 *  - création : aucun voyage n'existe encore, les valeurs restent locales
 *    jusqu'à la validation, qui crée le document (CLAUDE.md §6, tiroir 0) ;
 *  - reprise : le voyage existe, chaque modification est enregistrée aussitôt
 *    via js/voyage.js.
 *
 * La nationalité est fixée à FR en V0 : présente dans les données, absente de
 * l'écran.
 */

import { echapper, t, traduireDom } from '../i18n.js';
import { TYPES_SEJOUR } from '../sejours.js';
import { modifierVoyage } from '../voyage.js';

/** La saisie ne peut pas être passée : elle crée le voyage. */
export const PEUT_ETRE_PASSE = false;

/** Bornes des champs numériques. */
const BORNES = {
  jours: { min: 1, max: 365 },
  adultes: { min: 1, max: 20 },
  enfants: { min: 0, max: 20 },
};

/** Construit les options du sélecteur de mois. */
function optionsMois(moisChoisi) {
  const options = [`<option value="">${echapper(t('saisie.choisirMois'))}</option>`];

  for (let mois = 1; mois <= 12; mois += 1) {
    const selectionne = mois === Number(moisChoisi) ? ' selected' : '';
    options.push(`<option value="${mois}"${selectionne}>${echapper(t(`mois.${mois}`))}</option>`);
  }

  return options.join('');
}

/**
 * Premier jour possible du voyage, pour le mois choisi.
 *
 * Sans cette borne, le calendrier s'ouvre sur le mois courant : choisir
 * juillet obligeait à faire défiler dix mois pour le retrouver. La poser en
 * `min` ouvre le calendrier au bon endroit, le jour même étant alors hors
 * bornes.
 *
 * L'année est celle de la prochaine occurrence du mois : un voyage se prépare
 * pour un mois à venir, pas pour celui de l'an dernier. Rien n'empêche
 * ensuite d'aller chercher une année plus lointaine — `max` reste libre.
 *
 * @param {number|null} mois de 1 à 12
 * @returns {string} date AAAA-MM-JJ, ou chaîne vide sans mois choisi
 */
function premierJourPossible(mois) {
  if (!Number.isInteger(mois) || mois < 1 || mois > 12) return '';

  const aujourdhui = new Date();
  const moisCourant = aujourdhui.getMonth() + 1;
  const annee = mois >= moisCourant ? aujourdhui.getFullYear() : aujourdhui.getFullYear() + 1;

  return `${annee}-${String(mois).padStart(2, '0')}-01`;
}

/**
 * Construit les options du sélecteur de type de séjour.
 *
 * Le type est demandé ici, et non seulement au tiroir Séjour, pour que la
 * recherche de lieux puisse démarrer dès la fiche — elle dure une à deux
 * minutes, que l'on passe de toute façon sur les tiroirs suivants.
 *
 * Une liste déroulante plutôt que les cartes du tiroir Séjour : au milieu
 * d'un formulaire, sept cartes ajouteraient quatre cents pixels avant le
 * bouton de validation.
 */
function optionsSejour(typeChoisi) {
  const options = [`<option value="">${echapper(t('saisie.choisirSejour'))}</option>`];

  for (const type of TYPES_SEJOUR) {
    const selectionne = type === typeChoisi ? ' selected' : '';
    options.push(
      `<option value="${echapper(type)}"${selectionne}>${echapper(t(`tourisme.type.${type}`))}</option>`
    );
  }

  return options.join('');
}

/**
 * Affiche le tiroir.
 *
 * @param {HTMLElement} conteneur
 * @param {object|null} voyage voyage ouvert, ou null en création
 * @param {{ valider: (valeurs: object) => void }} actions
 */
export function afficher(conteneur, voyage, actions) {
  const enCreation = voyage === null;

  /** Valeurs de travail : le document n'existe pas encore en création. */
  const valeurs = {
    destination: voyage?.destination ?? '',
    jours: voyage?.jours ?? null,
    mois: voyage?.mois ?? null,
    dateDepart: voyage?.dateDepart ?? null,
    depart: voyage?.depart ?? '',
    voyageurs: {
      adultes: voyage?.voyageurs?.adultes ?? 2,
      enfants: voyage?.voyageurs?.enfants ?? 0,
    },
    tourisme: { type: voyage?.tourisme?.type ?? null },
  };

  conteneur.innerHTML = `
    <section class="carte">
      <h2>${echapper(t('saisie.titre'))}</h2>

      <div class="champ">
        <label for="saisie-destination">${echapper(t('saisie.destination'))}</label>
        <input type="text" id="saisie-destination" autocomplete="off"
               value="${echapper(valeurs.destination)}"
               data-i18n-placeholder="saisie.destinationAide">
        <p class="champ__aide">${echapper(t('saisie.destinationAide'))}</p>
        <p class="champ__erreur" id="erreur-destination" hidden></p>
      </div>

      <div class="champ">
        <label for="saisie-jours">${echapper(t('saisie.jours'))}</label>
        <input type="number" id="saisie-jours"
               min="${BORNES.jours.min}" max="${BORNES.jours.max}"
               value="${valeurs.jours ?? ''}">
        <p class="champ__erreur" id="erreur-jours" hidden></p>
      </div>

      <div class="champ">
        <label for="saisie-mois">${echapper(t('saisie.mois'))}</label>
        <select id="saisie-mois">${optionsMois(valeurs.mois)}</select>
        <p class="champ__erreur" id="erreur-mois" hidden></p>
      </div>

      <div class="champ">
        <label for="saisie-date">${echapper(t('saisie.dateDepart'))}</label>
        <input type="date" id="saisie-date" value="${echapper(valeurs.dateDepart ?? '')}"
               min="${echapper(premierJourPossible(valeurs.mois))}">
        <p class="champ__aide">${echapper(t('saisie.dateDepartAide'))}</p>
      </div>

      <div class="champs-cote-a-cote">
        <div class="champ">
          <label for="saisie-adultes">${echapper(t('saisie.adultes'))}</label>
          <input type="number" id="saisie-adultes"
                 min="${BORNES.adultes.min}" max="${BORNES.adultes.max}"
                 value="${valeurs.voyageurs.adultes}">
        </div>
        <div class="champ">
          <label for="saisie-enfants">${echapper(t('saisie.enfants'))}</label>
          <input type="number" id="saisie-enfants"
                 min="${BORNES.enfants.min}" max="${BORNES.enfants.max}"
                 value="${valeurs.voyageurs.enfants}">
        </div>
      </div>

      <div class="champ">
        <label for="saisie-depart">${echapper(t('saisie.depart'))}</label>
        <input type="text" id="saisie-depart" autocomplete="off"
               value="${echapper(valeurs.depart)}">
        <p class="champ__aide">${echapper(t('saisie.departAide'))}</p>
      </div>

      <div class="champ">
        <label for="saisie-sejour">${echapper(t('saisie.sejour'))}</label>
        <select id="saisie-sejour">${optionsSejour(valeurs.tourisme.type)}</select>
        <p class="champ__aide">${echapper(t('saisie.sejourAide'))}</p>
      </div>

      <button class="bouton bouton--principal" type="button" id="saisie-valider">
        ${echapper(enCreation ? t('saisie.valider') : t('commun.suivant'))}
      </button>
    </section>
  `;

  traduireDom(conteneur);

  /**
   * Enregistre une valeur : en mémoire toujours, dans Firestore si le
   * voyage existe déjà.
   */
  const retenir = (modifications) => {
    Object.assign(valeurs, modifications);
    if (!enCreation) modifierVoyage(modifications);
  };

  /** Lit un champ numérique en respectant ses bornes. */
  const lireNombre = (element, bornes) => {
    const nombre = Number.parseInt(element.value, 10);
    if (Number.isNaN(nombre)) return null;
    return Math.min(Math.max(nombre, bornes.min), bornes.max);
  };

  conteneur.querySelector('#saisie-destination').addEventListener('input', (evenement) => {
    retenir({ destination: evenement.target.value });
  });

  conteneur.querySelector('#saisie-jours').addEventListener('input', (evenement) => {
    retenir({ jours: lireNombre(evenement.target, BORNES.jours) });
  });

  const champMois = conteneur.querySelector('#saisie-mois');
  const champDate = conteneur.querySelector('#saisie-date');

  champMois.addEventListener('change', (evenement) => {
    const mois = Number.parseInt(evenement.target.value, 10);
    retenir({ mois: Number.isNaN(mois) ? null : mois });

    // Le calendrier suit le mois choisi, au lieu de s'ouvrir sur le mois
    // courant et d'obliger à le faire défiler.
    champDate.min = premierJourPossible(valeurs.mois);

    // Une date déjà saisie dans un autre mois deviendrait contradictoire.
    if (valeurs.dateDepart && Number(valeurs.dateDepart.slice(5, 7)) !== valeurs.mois) {
      champDate.value = '';
      retenir({ dateDepart: null });
    }
  });

  // Chrome sur Android ignore `min` et ouvre le calendrier sur le mois
  // courant ; il s'ouvre en revanche toujours sur la valeur du champ. On la
  // pose donc juste avant l'ouverture, et on la retire si rien n'est choisi.
  let valeurProvisoire = null;

  const preparerCalendrier = () => {
    if (champDate.value || !valeurs.mois) return;
    valeurProvisoire = premierJourPossible(valeurs.mois);
    champDate.value = valeurProvisoire;
  };

  champDate.addEventListener('pointerdown', preparerCalendrier);
  champDate.addEventListener('focus', preparerCalendrier);

  champDate.addEventListener('blur', () => {
    if (valeurProvisoire && champDate.value === valeurProvisoire) champDate.value = '';
    valeurProvisoire = null;
  });

  champDate.addEventListener('change', (evenement) => {
    valeurProvisoire = null;
    const date = evenement.target.value;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      retenir({ dateDepart: null });
      return;
    }

    // La date fait foi : le mois s'aligne sur elle.
    const mois = Number(date.slice(5, 7));
    retenir({ dateDepart: date, mois });
    champMois.value = String(mois);
    champDate.min = premierJourPossible(mois);
  });

  conteneur.querySelector('#saisie-adultes').addEventListener('input', (evenement) => {
    const adultes = lireNombre(evenement.target, BORNES.adultes) ?? BORNES.adultes.min;
    valeurs.voyageurs.adultes = adultes;
    if (!enCreation) modifierVoyage({ voyageurs: { adultes } });
  });

  conteneur.querySelector('#saisie-enfants').addEventListener('input', (evenement) => {
    const enfants = lireNombre(evenement.target, BORNES.enfants) ?? BORNES.enfants.min;
    valeurs.voyageurs.enfants = enfants;
    if (!enCreation) modifierVoyage({ voyageurs: { enfants } });
  });

  conteneur.querySelector('#saisie-depart').addEventListener('input', (evenement) => {
    retenir({ depart: evenement.target.value });
  });

  conteneur.querySelector('#saisie-sejour').addEventListener('change', (evenement) => {
    const type = evenement.target.value || null;
    // Object.assign remplacerait tourisme en entier ; en reprise, la fusion
    // profonde de modifierVoyage préserve les lieux déjà retenus.
    valeurs.tourisme = { ...valeurs.tourisme, type };
    if (!enCreation) modifierVoyage({ tourisme: { type } });
  });

  conteneur.querySelector('#saisie-valider').addEventListener('click', () => {
    if (!validerChamps(conteneur, valeurs)) return;
    actions.valider({ ...valeurs, destination: valeurs.destination.trim() });
  });
}

/**
 * Vérifie les champs obligatoires et affiche les erreurs sous chacun.
 * @param {HTMLElement} conteneur
 * @param {object} valeurs
 * @returns {boolean} vrai si la saisie est complète
 */
function validerChamps(conteneur, valeurs) {
  const controles = [
    {
      identifiant: 'erreur-destination',
      valide: valeurs.destination.trim().length > 0,
      message: 'saisie.erreurDestination',
    },
    {
      identifiant: 'erreur-jours',
      valide: Number.isInteger(valeurs.jours) && valeurs.jours >= BORNES.jours.min,
      message: 'saisie.erreurJours',
    },
    {
      identifiant: 'erreur-mois',
      valide: Number.isInteger(valeurs.mois),
      message: 'saisie.erreurMois',
    },
  ];

  let tousValides = true;

  for (const controle of controles) {
    const element = conteneur.querySelector(`#${controle.identifiant}`);
    element.hidden = controle.valide;
    element.textContent = controle.valide ? '' : t(controle.message);
    if (!controle.valide) tousValides = false;
  }

  return tousValides;
}
