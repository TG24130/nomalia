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

  /* — Modes de transport (tiroir 2) — */

  // L'avion du fil des étapes sert aussi de choix de mode.
  avion: '<path d="M12 3c.9 0 1.4 1 1.4 2.2v3.3l6.6 3.9v2l-6.6-2v3.8l2.2 1.6v1.6L12 18.6l-3.6 1.8v-1.6l2.2-1.6v-3.8l-6.6 2v-2l6.6-3.9V5.2C10.6 4 11.1 3 12 3Z"/>',

  // Une motrice vue de face, sur ses rails.
  train: '<path d="M9 3h6a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Z"/><path d="M6 9h12"/><circle cx="9.7" cy="12.6" r="1"/><circle cx="14.3" cy="12.6" r="1"/><path d="M9 16l-2 5M15 16l2 5"/><path d="M5 19h14"/>',

  // Un voilier : coque, mât et voile.
  bateau: '<path d="M4 16h16l-2.2 4H6.2Z"/><path d="M12 16V3"/><path d="M12 5.5l5.5 8.5H12"/>',

  // Une voiture de profil.
  voiture: '<path d="M5.2 12l1.6-3.8A2 2 0 0 1 8.6 7h6.8a2 2 0 0 1 1.8 1.2L18.8 12"/><path d="M3 12h18v4H3z"/><circle cx="7.4" cy="17" r="1.7"/><circle cx="16.6" cy="17" r="1.7"/>',

  /* — Types d'hébergement (tiroir 3) — */

  // Un immeuble à fenêtres régulières, avec son porche.
  hotel: '<path d="M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16"/><path d="M2 21h20"/><path d="M8 7h2M14 7h2M8 11h2M14 11h2"/><path d="M10 21v-5h4v5"/>',

  // Une maison à cheminée.
  gite: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/><path d="M16.5 6.8V4h2v4.4"/>',

  // Un immeuble d'habitation accolé à un bâtiment plus bas.
  appartement: '<path d="M3 21V9h7v12"/><path d="M10 21V3h11v18"/><path d="M2 21h20"/><path d="M13.5 7h1.5M17.5 7h1.5M13.5 11h1.5M17.5 11h1.5M13.5 15h1.5M17.5 15h1.5"/><path d="M6 13h2"/>',

  // Une maison habitée : l'hôte est dedans.
  'chez-habitant': '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><circle cx="12" cy="13.6" r="1.8"/><path d="M8.8 20a3.2 3.2 0 0 1 6.4 0"/>',

  // Une tente canadienne : le pan de toile est dessiné en diagonale, et non
  // par un trait vertical au centre, qui donnait un panneau d'avertissement.
  camping: '<path d="M12 5 3 20h18Z"/><path d="M12 5 7.5 20"/><path d="M12 2.8V5"/>',

  // La même tente, accompagnée du sac de matériel loué.
  'camping-materiel-loue': '<path d="M9 4 1.5 17h15Z"/><path d="M9 4 5.2 17"/><path d="M14 13.5h7.5V21H14z"/><path d="M15.8 13.5v-1.3a1.9 1.9 0 0 1 3.8 0v1.3"/>',

  /* — Types de séjour (tiroir 4) — */

  // Un parasol au bord de l'eau.
  'plage-repos': '<path d="M12 4v10"/><path d="M4.5 11a7.5 7.5 0 0 1 15 0Z"/><path d="M3 19.5q2-2 4 0t4 0 4 0 4 0"/>',

  // Un croissant de lune et deux étoiles. Le hamac et les feuilles de spa
  // essayés avant se réduisaient tous deux à un trait illisible à 30 pixels ;
  // la lune reste reconnaissable à n'importe quelle taille.
  'repos-total': '<path d="M20 15.2A8.6 8.6 0 1 1 9.4 4.5a6.7 6.7 0 0 0 10.6 10.7Z"/><path d="M17 3.2v2.6M15.7 4.5h2.6"/><path d="M20.5 7.8v1.8M19.6 8.7h1.8"/>',

  // Un cœur. Convenu, mais c'est justement ce qui le rend lisible d'un coup
  // d'œil à trente pixels, là où deux coupes qui trinquent se brouillent.
  romantique: '<path d="M12 20.8 5 13.9C3.5 12.4 2 10.7 2 8.4A5.4 5.4 0 0 1 7.4 3c1.7 0 2.9.5 4.6 2 1.7-1.5 2.9-2 4.6-2A5.4 5.4 0 0 1 22 8.4c0 2.3-1.5 4-3 5.5Z"/>',

  // Une empreinte de patte : l'observation animalière, sans choisir un animal
  // plutôt qu'un autre.
  safari: '<path d="M12 12.8c2.4 0 4.3 1.5 4.3 3.4S14.4 19.8 12 19.8s-4.3-1.7-4.3-3.6 1.9-3.4 4.3-3.4Z"/><circle cx="6.6" cy="11.3" r="1.6"/><circle cx="10.1" cy="8.2" r="1.7"/><circle cx="13.9" cy="8.2" r="1.7"/><circle cx="17.4" cy="11.3" r="1.6"/>',

  // Deux épingles de carte reliées par un trajet pointillé : on va de ville
  // en ville. Deux simples cercles se lisaient comme un graphe.
  'trip-liberte': '<path d="M6.5 11.6S9.6 8.9 9.6 6.8a3.1 3.1 0 1 0-6.2 0c0 2.1 3.1 4.8 3.1 4.8Z"/><circle cx="6.5" cy="6.7" r="1.1"/><path d="M17.5 21.2s3.1-2.7 3.1-4.8a3.1 3.1 0 1 0-6.2 0c0 2.1 3.1 4.8 3.1 4.8Z"/><circle cx="17.5" cy="16.3" r="1.1"/><path stroke-dasharray="1.8 2.4" d="M8.6 12.6c2.8 1.2 4.4 2.7 5.4 4.6"/>',

  // Un sac à dos, bretelles comprises : le trek se distingue ainsi des
  // sommets de la randonnée à la journée. Sans les bretelles, le corps et son
  // anse se lisaient comme un cadenas.
  trekking: '<path d="M7.6 8.6h8.8a2.6 2.6 0 0 1 2.6 2.6V20a1.2 1.2 0 0 1-1.2 1.2H6.2A1.2 1.2 0 0 1 5 20v-8.8a2.6 2.6 0 0 1 2.6-2.6Z"/><path d="M10 8.6V7.2a2 2 0 0 1 4 0v1.4"/><path d="M8.4 8.8C7.4 10.2 7 11.8 7 13.6M15.6 8.8c1 1.4 1.4 3 1.4 4.8"/><path d="M9.4 21.2v-4.4h5.2v4.4"/>',

  // Un monument à colonnes : le lieu qu'on ne manque pas.
  incontournables: '<path d="M3 9l9-5 9 5"/><path d="M5.5 9v9M9.8 9v9M14.2 9v9M18.5 9v9"/><path d="M4 18h16"/><path d="M2 21h20"/>',

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
