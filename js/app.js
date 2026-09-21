/**
 * app.js — point d'entrée : démarrage, authentification, navigation.
 *
 * Étape 3 (objet voyage) : écran d'accueil listant les voyages de
 * l'utilisateur, création, reprise, duplication et suppression.
 * Les tiroirs et la barre de progression arrivent à l'étape 4.
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
import {
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

/** Crée un voyage vide et l'ouvre. */
async function nouveauVoyage() {
  masquerMessage();
  afficherChargement();

  try {
    await creerVoyage();
    afficherEcranDetail();
  } catch (erreur) {
    console.error(erreur);
    await afficherEcranAccueil();
    afficherMessage(t('erreurs.generique'), 'erreur');
  }
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
      await ouvrirVoyage(id);
      afficherEcranDetail();
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
      erreur.message === 'voyage-introuvable' ? t('erreurs.voyageIntrouvable') : t('erreurs.generique'),
      'erreur'
    );
  }
}

/* — Écran de détail (provisoire) — */

/**
 * Écran provisoire du voyage ouvert.
 * Remplacé à l'étape 4 par le tiroir Saisie et la navigation entre tiroirs ;
 * il sert ici à vérifier la sauvegarde automatique.
 */
function afficherEcranDetail() {
  const voyage = voyageCourant();
  if (!voyage) {
    afficherEcranAccueil();
    return;
  }

  vue.innerHTML = `
    <section class="carte">
      <h2>${echapper(t('detail.titre'))}</h2>

      <div class="champ">
        <label for="champ-destination">${echapper(t('saisie.destination'))}</label>
        <input type="text" id="champ-destination"
               value="${echapper(voyage.destination ?? '')}"
               data-i18n-placeholder="saisie.destinationAide">
      </div>

      <div class="champ">
        <label for="champ-jours">${echapper(t('saisie.jours'))}</label>
        <input type="number" id="champ-jours" min="1" max="365"
               value="${voyage.jours ?? ''}">
      </div>

      <p class="note" id="etat-sauvegarde"></p>
      <p class="avertissement">${echapper(t('detail.provisoire'))}</p>

      <button class="bouton" type="button" id="bouton-retour">
        ${echapper(t('commun.precedent'))}
      </button>
    </section>
  `;

  traduireDom(vue);

  const etat = document.getElementById('etat-sauvegarde');

  /** Applique une modification et signale la sauvegarde. */
  const modifier = (modifications) => {
    modifierVoyage(modifications);
    etat.textContent = t('detail.enregistrement');
    sauvegarderMaintenant()
      .then(() => {
        etat.textContent = t('detail.enregistre');
      })
      .catch((erreur) => {
        console.error(erreur);
        etat.textContent = '';
        afficherMessage(t('erreurs.reseau'), 'erreur');
      });
  };

  document.getElementById('champ-destination').addEventListener('input', (evenement) => {
    modifier({ destination: evenement.target.value });
  });

  document.getElementById('champ-jours').addEventListener('input', (evenement) => {
    const valeur = Number.parseInt(evenement.target.value, 10);
    modifier({ jours: Number.isNaN(valeur) ? null : valeur });
  });

  document.getElementById('bouton-retour').addEventListener('click', async () => {
    afficherChargement();
    await fermerVoyage();
    await afficherEcranAccueil();
  });
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
    await sauvegarderMaintenant();
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
