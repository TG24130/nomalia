/**
 * sejours.js — les types de séjour.
 *
 * Partagés par deux tiroirs : la Saisie, où le type est demandé assez tôt
 * pour que la recherche de lieux puisse être lancée en avance, et le Séjour,
 * où il se choisit en cartes et où la liste s'affiche.
 */

/** Types proposés, dans l'ordre d'affichage. */
export const TYPES_SEJOUR = [
  'business',
  'trip-liberte',
  'safari',
  'romantique',
  'repos-total',
];

/**
 * Liste de lieux demandée à la Cloud Function pour chaque type.
 *
 * `repos-total` n'y figure pas : il ne se prépare pas dans une liste de
 * visites mais dans le choix de l'hébergement.
 */
export const LISTE_PAR_TYPE = {
  business: 'business',
  'trip-liberte': 'etapes',
  safari: 'safari',
  romantique: 'romantique',
};
