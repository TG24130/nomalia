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
    depart: voyage?.depart ?? '',
    voyageurs: {
      adultes: voyage?.voyageurs?.adultes ?? 2,
      enfants: voyage?.voyageurs?.enfants ?? 0,
    },
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

  conteneur.querySelector('#saisie-mois').addEventListener('change', (evenement) => {
    const mois = Number.parseInt(evenement.target.value, 10);
    retenir({ mois: Number.isNaN(mois) ? null : mois });
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
