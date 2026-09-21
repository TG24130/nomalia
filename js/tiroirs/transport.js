/**
 * transport.js — tiroir « Transport ».
 *
 * Lit et écrit l'objet voyage via js/voyage.js uniquement (CLAUDE.md §3.3).
 * Contenu réel à implémenter à l'étape 7 du plan V0 ; en attendant,
 * le tiroir s'affiche et la navigation fonctionne.
 */

import { echapper, t } from '../i18n.js';

/** Ce tiroir peut être passé (CLAUDE.md §7). */
export const PEUT_ETRE_PASSE = true;

/**
 * Affiche le tiroir.
 *
 * @param {HTMLElement} conteneur
 * @param {object} voyage
 * @param {object} actions navigation fournie par app.js
 */
export function afficher(conteneur, voyage, actions) {
  conteneur.innerHTML = `
    <section class="carte">
      <h2>${echapper(t('transport.titre'))}</h2>
      <p class="avertissement">${echapper(t('commun.tiroirAVenir'))}</p>
      <button class="bouton bouton--principal" type="button" id="tiroir-suivant">
        ${echapper(t('commun.suivant'))}
      </button>
    </section>
  `;

  conteneur.querySelector('#tiroir-suivant').addEventListener('click', actions.suivant);
}
