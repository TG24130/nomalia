/**
 * voyage.js — seul point d'accès à l'objet voyage.
 *
 * Les tiroirs lisent et écrivent le voyage uniquement par ces fonctions
 * (CLAUDE.md §3.3). L'affichage ne fait que lire l'état.
 *
 * À implémenter à l'étape 3 du plan V0 : création, lecture, sauvegarde
 * automatique dans Firestore, liste des voyages de l'utilisateur.
 */

/** Modèle d'un voyage vide — référence du schéma (CLAUDE.md §4). */
export const VOYAGE_VIDE = {
  proprietaire: null,
  creeLe: null,
  modifieLe: null,
  langue: 'fr',
  nationalite: 'FR',
  destination: '',
  destinationNormalisee: '',
  jours: null,
  mois: null,
  voyageurs: { adultes: 2, enfants: 0 },
  depart: '',
  ficheId: null,
  transport: { mode: null, notes: '' },
  hebergement: { type: null, filtres: [] },
  tourisme: { type: null, lieuxRetenus: [] },
  randos: { niveau: null, dureeMax: null, retenues: [] },
  budget: null,
  etapeCourante: 'saisie',
};

/** Ordre des tiroirs, utilisé par la navigation et la barre de progression. */
export const ETAPES = [
  'saisie',
  'fiche',
  'transport',
  'hebergement',
  'tourisme',
  'randos',
  'budget',
];
