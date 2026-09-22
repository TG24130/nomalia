/**
 * index.js — point d'entrée des Cloud Functions NOMADIA (Node 20, 2nd gen).
 *
 * Ce fichier ne contient que les exports : le socle partagé (modèle, secret,
 * vérification d'accès, cache) vit dans commun.js, et chaque fonction métier
 * dans son propre module. Les modules métier importent commun.js et non
 * index.js, ce qui évite un cycle d'import.
 */

export {
  CLE_ANTHROPIC,
  DUREE_CACHE_MS,
  MODELE_CLAUDE,
  cleFiche,
  db,
  normaliser,
  verifierAcces,
} from './commun.js';

export { genererFiche } from './fiche.js';
export { genererLieux } from './lieux.js';
export { genererRandos } from './randos.js';
