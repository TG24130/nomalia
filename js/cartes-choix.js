/**
 * cartes-choix.js — présentation commune des choix à option unique.
 *
 * Les tiroirs Transport, Hébergement et Séjour posent tous la même question :
 * « laquelle de ces options ? ». Ils partagent donc le même rendu — une grille
 * de cartes portant un pictogramme et un libellé — plutôt qu'une rangée de
 * boutons de texte où toutes les options se ressemblent.
 *
 * Ce module ne fabrique que du balisage : la sélection et l'enregistrement
 * restent l'affaire du tiroir, qui écoute `data-choix`.
 */

import { echapper } from './i18n.js';
import { icone } from './icones.js';

/**
 * Construit une carte de choix.
 *
 * @param {object} option
 * @param {string} option.valeur valeur écrite dans le voyage
 * @param {string} option.libelle texte affiché
 * @param {string[]} [option.icones] une icône, ou deux pour un mode combiné
 * @param {boolean} option.choisie
 * @returns {string} balisage HTML
 */
function carte({ valeur, libelle, icones = [], choisie }) {
  // Deux pictogrammes reliés par un signe pour les modes combinés
  // (avion + voiture) : la carte dit alors le trajet complet.
  const pictogrammes = icones
    .map((nom) => icone(nom, { taille: 30 }))
    .join('<span class="carte-choix__plus" aria-hidden="true">+</span>');

  const coche = choisie
    ? `<span class="carte-choix__coche">${icone('coche', { taille: 13 })}</span>`
    : '';

  return `
    <button class="carte-choix${choisie ? ' carte-choix--choisie' : ''}"
            type="button" data-choix="${echapper(valeur)}"
            aria-pressed="${choisie}">
      ${coche}
      <span class="carte-choix__icone">${pictogrammes}</span>
      <span>${echapper(libelle)}</span>
    </button>
  `;
}

/**
 * Construit une grille de cartes à choix unique.
 *
 * @param {Array<{ valeur: string, libelle: string, icones?: string[] }>} options
 * @param {string|null} valeurChoisie
 * @returns {string} balisage HTML
 */
export function grilleChoix(options, valeurChoisie) {
  const cartes = options
    .map((option) => carte({ ...option, choisie: option.valeur === valeurChoisie }))
    .join('');

  return `<div class="choix choix--cartes">${cartes}</div>`;
}

/**
 * Branche la sélection sur une grille déjà insérée dans le document.
 *
 * Un second clic sur l'option déjà retenue l'annule : les tiroirs peuvent être
 * passés, et rien n'oblige à garder un choix fait par erreur.
 *
 * @param {HTMLElement} conteneur élément contenant la grille
 * @param {string|null} valeurChoisie valeur actuellement retenue
 * @param {(valeur: string|null) => void} auChangement
 */
export function brancherChoix(conteneur, valeurChoisie, auChangement) {
  conteneur.querySelectorAll('[data-choix]').forEach((bouton) => {
    bouton.addEventListener('click', () => {
      const clique = bouton.dataset.choix;
      auChangement(clique === valeurChoisie ? null : clique);
    });
  });
}
