/**
 * app.js — point d'entrée : démarrage, authentification, navigation.
 *
 * Étape 4 : enchaînement des tiroirs, barre de progression et retour arrière.
 * Chaque tiroir expose `afficher(conteneur, voyage, actions)` et reçoit sa
 * navigation par `actions` : aucun tiroir n'importe app.js, ce qui évite un
 * cycle entre les modules.
 */

import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

import { chargerLangue, echapper, t, traduireDom, langue } from './i18n.js';
import {
  ENVIRONNEMENT,
  EST_LOCAL,
  configurationIncomplete,
  initialiserFirebase,
} from './firebase-config.js';
import {
  ETAPES,
  configurerVoyages,
  creerVoyage,
  dupliquerVoyage,
  fermerVoyage,
  listerVoyages,
  modifierVoyage,
  ouvrirVoyage,
  sauvegarderMaintenant,
  supprimerVoyage,
  voyageCourant,
} from './voyage.js';

import { configurerApi } from './api.js';

import * as tiroirSaisie from './tiroirs/saisie.js';
import * as tiroirFiche from './tiroirs/fiche.js';
import * as tiroirTransport from './tiroirs/transport.js';
import * as tiroirHebergement from './tiroirs/hebergement.js';
import * as tiroirTourisme from './tiroirs/tourisme.js';
import * as tiroirRandos from './tiroirs/randos.js';
import * as tiroirBudget from './tiroirs/budget-vue.js';

/** Tiroirs, dans l'ordre défini par ETAPES. */
const TIROIRS = {
  saisie: tiroirSaisie,
  fiche: tiroirFiche,
  transport: tiroirTransport,
  hebergement: tiroirHebergement,
  tourisme: tiroirTourisme,
  randos: tiroirRandos,
  budget: tiroirBudget,
};

/** Élément principal dans lequel les écrans et les tiroirs s'affichent. */
const vue = document.getElementById('vue');

/** Zone de messages (erreurs, informations). */
const zoneMessage = document.getElementById('message');

/** Bouton de déconnexion de l'en-tête. */
const boutonDeconnexion = document.getElementById('deconnexion');

/** Barre de progression des tiroirs. */
const progression = document.getElementById('progression');
const barreProgression = document.getElementById('progression-barre');

/** Services Firebase, renseignés au démarrage. */
let firebase = null;

/**
 * Affiche un message à l'utilisateur.
 * @param {string} texte message déjà traduit
 * @param {'info'|'erreur'} [type='info']
 */
export function afficherMessage(texte, type = 'info') {
  zoneMessage.textContent = texte;
  zoneMessage.className = `message message--${type}`;
  zoneMessage.hidden = false;
}

/** Masque la zone de messages. */
export function masquerMessage() {
  zoneMessage.hidden = true;
  zoneMessage.textContent = '';
}

/** Affiche l'indicateur de chargement dans la vue principale. */
function afficherChargement() {
  vue.innerHTML = `<p class="chargement">${echapper(t('commun.chargement'))}</p>`;
}

/**
 * Met en forme une date Firestore selon la langue courante.
 * @param {object} horodatage Timestamp Firestore
 * @returns {string}
 */
function formaterDate(horodatage) {
  if (!horodatage || typeof horodatage.toDate !== 'function') return '';

  return new Intl.DateTimeFormat(langue(), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(horodatage.toDate());
}

/* — Écrans d'authentification — */

/** Écran de connexion : seul point d'entrée non authentifié. */
function afficherEcranConnexion() {
  boutonDeconnexion.hidden = true;
  masquerProgression();

  vue.innerHTML = `
    <section class="carte">
      <h2>${echapper(t('auth.titre'))}</h2>
      <p>${echapper(t('auth.invite'))}</p>
      <button class="bouton bouton--principal" type="button" id="bouton-connexion">
        ${echapper(t('auth.connexionGoogle'))}
      </button>
    </section>
  `;

  document.getElementById('bouton-connexion').addEventListener('click', connecter);
}

/**
 * Écran affiché quand l'adresse n'est pas dans la liste blanche.
 * @param {string} email
 */
function afficherEcranRefus(email) {
  boutonDeconnexion.hidden = true;
  masquerProgression();

  vue.innerHTML = `
    <section class="carte">
      <h2>${echapper(t('auth.refusTitre'))}</h2>
      <p>${echapper(t('erreurs.nonAutorise'))}</p>
      <p class="note">${echapper(t('auth.connecteEnTant', { email }))}</p>
      <button class="bouton" type="button" id="bouton-changer-compte">
        ${echapper(t('auth.essayerAutreCompte'))}
      </button>
    </section>
  `;

  document.getElementById('bouton-changer-compte').addEventListener('click', deconnecter);
}

/** Écran bloquant quand la configuration Firebase de production est absente. */
function afficherEcranConfiguration() {
  boutonDeconnexion.hidden = true;
  masquerProgression();
  vue.innerHTML = `
    <section class="carte">
      <h2>${echapper(t('erreurs.configurationTitre'))}</h2>
      <p>${echapper(t('erreurs.configuration'))}</p>
    </section>
  `;
}

/* — Écran d'accueil : liste des voyages — */

/**
 * Construit la carte d'un voyage dans la liste.
 * @param {object} voyage
 * @returns {string}
 */
function carteVoyage(voyage) {
  const titre = voyage.destination?.trim() || t('accueil.voyageSansTitre');

  const details = [];
  if (voyage.jours) details.push(t('accueil.duree', { jours: voyage.jours }));
  if (voyage.mois) details.push(t(`mois.${voyage.mois}`));
  const modifie = formaterDate(voyage.modifieLe);
  if (modifie) details.push(t('accueil.modifieLe', { date: modifie }));

  return `
    <article class="carte carte--voyage">
      <h3 class="carte__titre">${echapper(titre)}</h3>
      <p class="note">${echapper(details.join(' · '))}</p>

      <div class="actions" data-zone="actions">
        <button class="bouton bouton--principal" type="button"
                data-action="reprendre" data-id="${echapper(voyage.id)}">
          ${echapper(t('commun.reprendre'))}
        </button>
        <button class="bouton" type="button"
                data-action="dupliquer" data-id="${echapper(voyage.id)}">
          ${echapper(t('commun.dupliquer'))}
        </button>
        <button class="bouton bouton--danger" type="button"
                data-action="supprimer" data-id="${echapper(voyage.id)}">
          ${echapper(t('commun.supprimer'))}
        </button>
      </div>

      <div class="confirmation" data-zone="confirmation" hidden>
        <p class="avertissement">${echapper(t('accueil.confirmerSuppression', { titre }))}</p>
        <div class="actions">
          <button class="bouton bouton--danger" type="button"
                  data-action="confirmer-suppression" data-id="${echapper(voyage.id)}">
            ${echapper(t('commun.confirmerSupprimer'))}
          </button>
          <button class="bouton" type="button" data-action="annuler-suppression">
            ${echapper(t('commun.annuler'))}
          </button>
        </div>
      </div>
    </article>
  `;
}

/** Affiche la liste des voyages de l'utilisateur. */
async function afficherEcranAccueil() {
  boutonDeconnexion.hidden = false;
  masquerProgression();
  afficherChargement();

  let voyages;
  try {
    voyages = await listerVoyages();
  } catch (erreur) {
    console.error(erreur);
    vue.innerHTML = '';
    afficherMessage(t('erreurs.reseau'), 'erreur');
    return;
  }

  const liste = voyages.length
    ? voyages.map(carteVoyage).join('')
    : `<p class="note">${echapper(t('accueil.aucunVoyage'))}</p>`;

  vue.innerHTML = `
    <h2>${echapper(t('accueil.titre'))}</h2>
    ${liste}
    <button class="bouton bouton--principal" type="button" id="bouton-nouveau">
      ${echapper(t('accueil.nouveauVoyage'))}
    </button>
  `;

  document.getElementById('bouton-nouveau').addEventListener('click', nouveauVoyage);
  vue.querySelectorAll('[data-action]').forEach((bouton) => {
    bouton.addEventListener('click', gererActionVoyage);
  });
}

/**
 * Ouvre le tiroir Saisie sans créer de document : le voyage ne sera écrit
 * qu'à la validation (CLAUDE.md §6, tiroir 0).
 */
async function nouveauVoyage() {
  masquerMessage();
  await fermerVoyage();
  afficherTiroir('saisie');
}

/**
 * Traite un clic sur « Reprendre », « Dupliquer » ou « Supprimer ».
 * @param {Event} evenement
 */
async function gererActionVoyage(evenement) {
  const bouton = evenement.currentTarget;
  const { action, id } = bouton.dataset;
  const carte = bouton.closest('.carte--voyage');
  masquerMessage();

  // La suppression demande une confirmation dans la carte elle-même :
  // une boîte de dialogue native passe mal en application installée.
  if (action === 'supprimer' || action === 'annuler-suppression') {
    const demandeConfirmation = action === 'supprimer';
    carte.querySelector('[data-zone="actions"]').hidden = demandeConfirmation;
    carte.querySelector('[data-zone="confirmation"]').hidden = !demandeConfirmation;
    return;
  }

  try {
    if (action === 'reprendre') {
      afficherChargement();
      const voyage = await ouvrirVoyage(id);
      afficherTiroir(etapeValide(voyage.etapeCourante));
      return;
    }

    if (action === 'dupliquer') {
      afficherChargement();
      await dupliquerVoyage(id);
      await afficherEcranAccueil();
      return;
    }

    if (action === 'confirmer-suppression') {
      afficherChargement();
      await supprimerVoyage(id);
      await afficherEcranAccueil();
    }
  } catch (erreur) {
    console.error(erreur);
    await afficherEcranAccueil();
    afficherMessage(
      erreur.message === 'voyage-introuvable'
        ? t('erreurs.voyageIntrouvable')
        : t('erreurs.generique'),
      'erreur'
    );
  }
}

/* — Navigation entre tiroirs — */

/**
 * Renvoie une étape connue, ou la première par défaut.
 * @param {string} etape
 * @returns {string}
 */
function etapeValide(etape) {
  return ETAPES.includes(etape) ? etape : ETAPES[0];
}

/** Met à jour la barre de progression. */
function afficherProgression(etape) {
  const position = ETAPES.indexOf(etape) + 1;
  progression.hidden = false;
  barreProgression.style.width = `${(position / ETAPES.length) * 100}%`;
}

/** Masque la barre de progression (écrans hors parcours). */
function masquerProgression() {
  progression.hidden = true;
  barreProgression.style.width = '0';
}

/**
 * Affiche un tiroir et sa barre de navigation.
 * @param {string} etape
 */
function afficherTiroir(etape) {
  const nom = etapeValide(etape);
  const tiroir = TIROIRS[nom];
  const voyage = voyageCourant();
  const position = ETAPES.indexOf(nom);

  boutonDeconnexion.hidden = false;
  afficherProgression(nom);

  vue.innerHTML = `
    <p class="note note--etape">${echapper(
      t('commun.etape', { courante: position + 1, total: ETAPES.length })
    )}</p>
    <div id="tiroir"></div>
    <nav class="navigation" id="navigation"></nav>
  `;

  const actions = {
    suivant: () => allerA(position + 1),
    precedent: () => allerA(position - 1),
    accueil: retourAccueil,
    valider: validerSaisie,
    message: afficherMessage,
  };

  // Un tiroir peut être asynchrone (appel à une Cloud Function) : on attrape
  // aussi bien une erreur immédiate qu'une promesse rejetée.
  try {
    const rendu = tiroir.afficher(document.getElementById('tiroir'), voyage, actions);
    Promise.resolve(rendu).catch((erreur) => {
      console.error(erreur);
      afficherMessage(t('erreurs.generique'), 'erreur');
    });
  } catch (erreur) {
    console.error(erreur);
    afficherMessage(t('erreurs.generique'), 'erreur');
  }

  afficherNavigation(nom, position, tiroir, actions);
}

/**
 * Construit la barre de navigation commune à tous les tiroirs.
 * @param {string} nom
 * @param {number} position
 * @param {object} tiroir module du tiroir
 * @param {object} actions
 */
function afficherNavigation(nom, position, tiroir, actions) {
  const navigation = document.getElementById('navigation');
  const enCreation = voyageCourant() === null;

  // On ne peut ni passer ni reculer tant que le voyage n'existe pas.
  const peutPasser = tiroir.PEUT_ETRE_PASSE && !enCreation;
  const libellePrecedent = position === 0 ? t('commun.retourAccueil') : t('commun.precedent');

  navigation.innerHTML = `
    <button class="bouton" type="button" id="navigation-precedent">
      ${echapper(libellePrecedent)}
    </button>
    ${
      peutPasser
        ? `<button class="bouton" type="button" id="navigation-passer">
             ${echapper(t('commun.passer'))}
           </button>`
        : ''
    }
  `;

  document
    .getElementById('navigation-precedent')
    .addEventListener('click', position === 0 ? retourAccueil : actions.precedent);

  if (peutPasser) {
    document.getElementById('navigation-passer').addEventListener('click', actions.suivant);
  }
}

/**
 * Va à l'étape située à `position`. Sort vers l'accueil aux deux extrémités.
 * @param {number} position
 */
async function allerA(position) {
  masquerMessage();

  if (position < 0 || position >= ETAPES.length) {
    await retourAccueil();
    return;
  }

  const etape = ETAPES[position];
  if (voyageCourant()) modifierVoyage({ etapeCourante: etape });
  afficherTiroir(etape);
}

/** Enregistre puis revient à la liste des voyages. */
async function retourAccueil() {
  afficherChargement();
  await fermerVoyage();
  await afficherEcranAccueil();
}

/**
 * Crée le voyage à partir de la saisie, puis ouvre le tiroir suivant.
 * @param {object} valeurs champs du tiroir Saisie
 */
async function validerSaisie(valeurs) {
  masquerMessage();

  // En reprise, le voyage existe déjà : la saisie a été enregistrée au fil de
  // l'eau, il ne reste qu'à avancer.
  if (voyageCourant()) {
    await allerA(ETAPES.indexOf('saisie') + 1);
    return;
  }

  afficherChargement();

  try {
    await creerVoyage({ ...valeurs, etapeCourante: 'fiche' });
    afficherTiroir('fiche');
  } catch (erreur) {
    console.error(erreur);
    afficherTiroir('saisie');
    afficherMessage(t('erreurs.generique'), 'erreur');
  }
}

/* — Authentification — */

/** Lance la connexion Google (popup, avec repli sur redirection). */
async function connecter() {
  masquerMessage();

  const fournisseur = new GoogleAuthProvider();
  // Oblige le choix du compte : utile quand plusieurs comptes Google coexistent.
  fournisseur.setCustomParameters({ prompt: 'select_account' });

  try {
    await signInWithPopup(firebase.auth, fournisseur);
  } catch (erreur) {
    const replis = [
      'auth/popup-blocked',
      'auth/operation-not-supported-in-this-environment',
      'auth/cancelled-popup-request',
    ];

    if (replis.includes(erreur.code)) {
      // Cas des navigateurs mobiles et des PWA installées : la popup est
      // bloquée, on passe par une redirection complète.
      await signInWithRedirect(firebase.auth, fournisseur);
      return;
    }

    // L'utilisateur a fermé la fenêtre lui-même : rien à signaler.
    if (erreur.code === 'auth/popup-closed-by-user') return;

    console.error(erreur);
    afficherMessage(t('erreurs.connexion'), 'erreur');
  }
}

/** Déconnecte l'utilisateur courant. */
async function deconnecter() {
  masquerMessage();
  try {
    await fermerVoyage();
    await signOut(firebase.auth);
  } catch (erreur) {
    console.error(erreur);
    afficherMessage(t('erreurs.generique'), 'erreur');
  }
}

/**
 * Vérifie que l'adresse figure dans la collection `autorises`.
 * Les règles Firestore appliquent la même vérification côté serveur.
 *
 * @param {string} email
 * @returns {Promise<boolean>}
 */
async function estAutorise(email) {
  const entree = await getDoc(doc(firebase.db, 'autorises', email.toLowerCase()));
  return entree.exists();
}

/**
 * Réagit à chaque changement d'état d'authentification.
 * @param {object|null} utilisateur
 */
async function gererUtilisateur(utilisateur) {
  if (!utilisateur) {
    afficherEcranConnexion();
    return;
  }

  if (!utilisateur.email) {
    await deconnecter();
    afficherMessage(t('erreurs.connexion'), 'erreur');
    return;
  }

  afficherChargement();

  try {
    if (!(await estAutorise(utilisateur.email))) {
      afficherEcranRefus(utilisateur.email);
      return;
    }

    masquerMessage();
    configurerVoyages(firebase.db, utilisateur);
    configurerApi(firebase.fonctions);
    await afficherEcranAccueil();
  } catch (erreur) {
    // Un refus des règles Firestore se traite comme une absence d'autorisation.
    if (erreur.code === 'permission-denied') {
      afficherEcranRefus(utilisateur.email);
      return;
    }
    console.error(erreur);
    afficherEcranConnexion();
    afficherMessage(t('erreurs.reseau'), 'erreur');
  }
}

/* — Démarrage — */

/**
 * Enregistre le service worker (PWA).
 *
 * Désactivé en local, où son cache masquerait les modifications en cours ;
 * `?sw=1` permet de le tester quand même, l'installation d'une PWA n'étant
 * possible que sur une origine sûre — ce que localhost est aussi.
 */
async function enregistrerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  const demandeExplicite = new URLSearchParams(location.search).has('sw');
  if (EST_LOCAL && !demandeExplicite) return;
  try {
    await navigator.serviceWorker.register('sw.js');
  } catch (erreur) {
    console.warn('Service worker non enregistré', erreur);
  }
}

async function demarrer() {
  await chargerLangue('fr');
  traduireDom();

  document.getElementById('pied-env').textContent = `${ENVIRONNEMENT} · ${langue()}`;
  boutonDeconnexion.addEventListener('click', deconnecter);

  // Dernière chance d'écrire une modification avant la fermeture de l'onglet.
  window.addEventListener('pagehide', () => {
    sauvegarderMaintenant();
  });

  if (configurationIncomplete()) {
    afficherEcranConfiguration();
    return;
  }

  firebase = initialiserFirebase();
  onAuthStateChanged(firebase.auth, gererUtilisateur);

  enregistrerServiceWorker();
}

demarrer().catch((erreur) => {
  console.error(erreur);
  afficherMessage(t('erreurs.generique'), 'erreur');
});
