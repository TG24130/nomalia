/**
 * app.js — point d'entrée : démarrage, authentification, navigation.
 *
 * Étape 2 (auth + liste blanche) : connexion Google, vérification de
 * l'adresse dans la collection `autorises`, refus propre sinon.
 * L'objet voyage et les tiroirs arrivent à partir de l'étape 3.
 */

import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

import { chargerLangue, t, traduireDom, langue } from './i18n.js';
import {
  ENVIRONNEMENT,
  EST_LOCAL,
  configurationIncomplete,
  initialiserFirebase,
} from './firebase-config.js';

/** Élément principal dans lequel les tiroirs injectent leur contenu. */
const vue = document.getElementById('vue');

/** Zone de messages (erreurs, informations). */
const zoneMessage = document.getElementById('message');

/** Bouton de déconnexion de l'en-tête. */
const boutonDeconnexion = document.getElementById('deconnexion');

/** Services Firebase, renseignés au démarrage. */
let firebase = null;

/**
 * Échappe une chaîne avant insertion dans du HTML.
 * @param {string} texte
 * @returns {string}
 */
function echapper(texte) {
  return String(texte).replace(
    /[&<>"']/g,
    (caractere) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[caractere]
  );
}

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

/* — Écrans — */

/** Écran de connexion : seul point d'entrée non authentifié. */
function afficherEcranConnexion() {
  boutonDeconnexion.hidden = true;

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

/**
 * Écran d'accueil — liste des voyages.
 * Placeholder : remplacé à l'étape 3 par la vraie liste issue de voyage.js.
 * @param {object} utilisateur
 */
function afficherEcranAccueil(utilisateur) {
  boutonDeconnexion.hidden = false;

  vue.innerHTML = `
    <section class="carte">
      <h2>${echapper(t('accueil.titre'))}</h2>
      <p class="note">${echapper(t('auth.connecteEnTant', { email: utilisateur.email }))}</p>
      <p>${echapper(t('accueil.aucunVoyage'))}</p>
      <button class="bouton bouton--principal" type="button" disabled>
        ${echapper(t('accueil.nouveauVoyage'))}
      </button>
      <p class="note">${echapper(t('commun.etape', { courante: 2, total: 13 }))} — auth</p>
    </section>
  `;
}

/** Écran bloquant quand la configuration Firebase de production est absente. */
function afficherEcranConfiguration() {
  boutonDeconnexion.hidden = true;
  vue.innerHTML = `
    <section class="carte">
      <h2>${echapper(t('erreurs.configurationTitre'))}</h2>
      <p>${echapper(t('erreurs.configuration'))}</p>
    </section>
  `;
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

  vue.innerHTML = `<p class="chargement">${echapper(t('commun.chargement'))}</p>`;

  try {
    if (await estAutorise(utilisateur.email)) {
      masquerMessage();
      afficherEcranAccueil(utilisateur);
    } else {
      afficherEcranRefus(utilisateur.email);
    }
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

/** Enregistre le service worker (PWA). Ignoré en local et hors HTTPS. */
async function enregistrerServiceWorker() {
  if (!('serviceWorker' in navigator) || EST_LOCAL) return;
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
