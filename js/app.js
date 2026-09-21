/**
 * app.js — point d'entrée de l'application.
 *
 * Étape 1 (socle) : charge les libellés, traduit la page et affiche un écran
 * de contrôle. L'authentification, l'objet voyage et la navigation entre
 * tiroirs arrivent aux étapes suivantes du plan V0 (voir CLAUDE.md §11).
 */

import { chargerLangue, t, traduireDom, langue } from './i18n.js';
import { ENVIRONNEMENT, EST_LOCAL, configurationIncomplete } from './firebase-config.js';

/** Élément principal dans lequel les tiroirs injectent leur contenu. */
const vue = document.getElementById('vue');

/** Zone de messages (erreurs, informations). */
const zoneMessage = document.getElementById('message');

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

/** Écran de contrôle du socle — remplacé à l'étape 3 par la liste des voyages. */
function afficherEcranSocle() {
  vue.innerHTML = `
    <section class="carte">
      <h2>${t('accueil.titre')}</h2>
      <p>${t('accueil.aucunVoyage')}</p>
      <button class="bouton bouton--principal" type="button" disabled>
        ${t('accueil.nouveauVoyage')}
      </button>
      <p class="note">${t('commun.etape', { courante: 1, total: 13 })} — socle</p>
    </section>
  `;
}

/** Enregistre le service worker (PWA). Ignoré en local et hors HTTPS. */
async function enregistrerServiceWorker() {
  if (!('serviceWorker' in navigator) || EST_LOCAL) return;
  try {
    await navigator.serviceWorker.register('sw.js');
  } catch (erreur) {
    console.warn('Service worker non enregistré', erreur);
  }
}

/** Démarrage. */
async function demarrer() {
  await chargerLangue('fr');
  traduireDom();

  document.getElementById('pied-env').textContent =
    `${ENVIRONNEMENT} · ${langue()}`;

  afficherEcranSocle();

  if (configurationIncomplete()) {
    console.info('Configuration Firebase à compléter (étape 2 du plan V0).');
  }

  enregistrerServiceWorker();
}

demarrer().catch((erreur) => {
  console.error(erreur);
  afficherMessage(t('erreurs.generique'), 'erreur');
});
