/**
 * api.js — appels aux Cloud Functions.
 *
 * Aucune clé API ici : le front appelle les fonctions via httpsCallable,
 * les fonctions parlent à l'API Claude (CLAUDE.md §3.1).
 *
 * À implémenter à partir de l'étape 5 du plan V0.
 */

/** Noms des Cloud Functions appelables. */
export const FONCTIONS = {
  genererFiche: 'genererFiche',
  genererLieux: 'genererLieux',
  genererRandos: 'genererRandos',
};
