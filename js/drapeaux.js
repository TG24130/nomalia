/**
 * drapeaux.js — drapeaux des langues proposées, en SVG.
 *
 * Dessinés plutôt qu'en émoji : Windows affiche les émojis de drapeau comme
 * deux lettres, et leur rendu varie d'un téléphone à l'autre.
 */

const DESSINS = {
  fr: `
    <rect width="30" height="20" fill="#fff"/>
    <rect width="10" height="20" fill="#0055a4"/>
    <rect x="20" width="10" height="20" fill="#ef4135"/>`,

  es: `
    <rect width="30" height="20" fill="#aa151b"/>
    <rect y="5" width="30" height="10" fill="#f1bf00"/>`,

  // Union Jack simplifié : lisible à la taille d'un bouton.
  en: `
    <rect width="30" height="20" fill="#012169"/>
    <path d="M0 0l30 20M30 0L0 20" stroke="#fff" stroke-width="4"/>
    <path d="M0 0l30 20M30 0L0 20" stroke="#c8102e" stroke-width="1.6"/>
    <path d="M15 0v20M0 10h30" stroke="#fff" stroke-width="6"/>
    <path d="M15 0v20M0 10h30" stroke="#c8102e" stroke-width="3.4"/>`,
};

/**
 * SVG du drapeau d'une langue.
 * @param {string} langue code de langue (fr, en, es)
 * @param {number} [largeur]
 * @returns {string}
 */
export function drapeau(langue, largeur = 30) {
  const dessin = DESSINS[langue];
  if (!dessin) return '';

  return `<svg class="drapeau" viewBox="0 0 30 20" width="${largeur}" height="${(largeur * 2) / 3}"
               aria-hidden="true" focusable="false">${dessin}</svg>`;
}
