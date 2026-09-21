/**
 * budget.js — calcul du budget estimatif.
 *
 * Fonction pure, sans accès réseau ni DOM : testable isolément
 * (CLAUDE.md §6, tiroir 6). À implémenter à l'étape 11 du plan V0.
 */

/** Part d'un repas d'enfant par rapport à un adulte. */
export const COEFFICIENT_ENFANT = 0.6;

/** Part ajoutée au total au titre des imprévus. */
export const TAUX_IMPREVUS = 0.1;

/**
 * @param {object} voyage objet voyage (CLAUDE.md §4)
 * @param {object} fiche fiche destination générée (CLAUDE.md §6)
 * @returns {{ bas: number, moyen: number, haut: number, detail: object, hypotheses: string[] }}
 */
export function calculerBudget(voyage, fiche) {
  throw new Error('calculerBudget : à implémenter (étape 11 du plan V0)');
}
