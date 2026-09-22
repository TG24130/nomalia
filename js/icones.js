/**
 * icones.js — pictogrammes de l'interface.
 *
 * Dessins au trait, tracés à la main dans une grille de 24 pixels : ils
 * héritent de la couleur du texte et restent nets à toutes les tailles.
 *
 * Pas d'emoji en guise d'icône : leur rendu change d'un appareil à l'autre et
 * les lecteurs d'écran les annoncent par leur nom, souvent hors de propos.
 */

/** Tracés, sans l'enveloppe <svg>. */
const TRACES = {
  // Étape 0 — Saisie : une épingle sur une carte.
  saisie: '<path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/>',

  // Étape 1 — Fiche : un feuillet avec ses lignes.
  fiche: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 12h6M9 16h6"/>',

  // Étape 2 — Transport : un avion vu de dessus.
  transport: '<path d="M12 3c.9 0 1.4 1 1.4 2.2v3.3l6.6 3.9v2l-6.6-2v3.8l2.2 1.6v1.6L12 18.6l-3.6 1.8v-1.6l2.2-1.6v-3.8l-6.6 2v-2l6.6-3.9V5.2C10.6 4 11.1 3 12 3Z"/>',

  // Étape 3 — Hébergement : un lit.
  hebergement: '<path d="M3 18v-7h18v7"/><path d="M3 18v2M21 18v2"/><path d="M3 11V7h7v4"/><circle cx="16" cy="9" r="2"/>',

  // Étape 4 — Séjour : un soleil au-dessus de l'horizon.
  tourisme: '<circle cx="12" cy="11" r="4"/><path d="M12 3v2M12 17v0M4 11H2M22 11h-2M6.3 5.3 4.9 3.9M17.7 5.3l1.4-1.4"/><path d="M3 20h18"/>',

  // Étape 5 — Randonnées : deux sommets.
  randos: '<path d="M3 19h18L14 6l-3.2 6-2-3Z"/><path d="M12.4 10.4 14 8"/>',

  // Étape 6 — Budget : un portefeuille.
  budget: '<path d="M4 7h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4z"/><path d="M4 7V6a2 2 0 0 1 2-2h10"/><circle cx="16" cy="13" r="1.3"/>',

  // Validation d'une étape franchie.
  coche: '<path d="M5 12.5 10 17.5 19 7"/>',
};

/**
 * Renvoie le balisage SVG d'une icône.
 *
 * L'icône est décorative par défaut : elle accompagne un texte visible et
 * reste donc invisible aux lecteurs d'écran. Passer un titre la rend
 * annonçable, pour les rares cas sans texte à côté.
 *
 * @param {string} nom clé dans TRACES
 * @param {{ taille?: number, titre?: string, classe?: string }} [options]
 * @returns {string} balisage SVG, ou chaîne vide si l'icône n'existe pas
 */
export function icone(nom, options = {}) {
  const trace = TRACES[nom];
  if (!trace) {
    console.warn(`Icône inconnue : ${nom}`);
    return '';
  }

  const { taille = 24, titre = null, classe = '' } = options;

  const accessibilite = titre
    ? `role="img" aria-label="${titre.replace(/"/g, '&quot;')}"`
    : 'aria-hidden="true" focusable="false"';

  return `<svg class="icone ${classe}" width="${taille}" height="${taille}"
    viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
    stroke-linecap="round" stroke-linejoin="round" ${accessibilite}>${trace}</svg>`;
}
