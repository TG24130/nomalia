/**
 * test-budget.mjs — vérifie calculerBudget sur quelques cas.
 *
 * Usage : node scripts/test-budget.mjs
 *
 * budget.js ne dépend ni du réseau ni du DOM : il se teste sans navigateur ni
 * émulateur (CLAUDE.md §6, tiroir 6).
 */

import { COEFFICIENT_ENFANT, TAUX_IMPREVUS, calculerBudget } from '../js/budget.js';

let echecs = 0;

/**
 * Compare une valeur à ce qui est attendu.
 * @param {string} intitule
 * @param {unknown} obtenu
 * @param {unknown} attendu
 */
function verifier(intitule, obtenu, attendu) {
  const ok = obtenu === attendu;
  if (!ok) echecs += 1;
  console.log(`${ok ? 'ok  ' : 'ÉCHEC'} ${intitule}${ok ? '' : ` — obtenu ${obtenu}, attendu ${attendu}`}`);
}

/** Fiche minimale, avec les seuls champs que le calcul consomme. */
const fiche = {
  points: {
    budgetMoyen: {
      hotelNuit: { eco: 50, moyen: 90, confort: 180 },
      repasJour: { eco: 25, moyen: 45, confort: 80 },
      devise: 'EUR',
    },
  },
};

console.log('\n— Cas 1 : deux adultes, deux enfants, dix jours, prix de la fiche —');

const voyage1 = {
  jours: 10,
  voyageurs: { adultes: 2, enfants: 2 },
  transport: { mode: 'avion+voiture' },
  hebergement: {},
  tourisme: { lieuxRetenus: [] },
};

const budget1 = calculerBudget(voyage1, fiche);

// Hébergement : 90 € × 10 nuits au niveau moyen.
verifier('hébergement moyen', budget1.detail.hebergement.moyen, 900);

// Repas : 45 € × (2 + 2 × 0,6) parts × 10 jours = 45 × 3,2 × 10.
verifier('repas moyen', budget1.detail.repas.moyen, Math.round(45 * (2 + 2 * COEFFICIENT_ENFANT) * 10));

// Le mode « avion+voiture » déclenche la location sur place.
verifier('transport sur place présent', budget1.detail.transportLocal.moyen > 0, true);

// Aucun prix de transport saisi : le poste reste à zéro plutôt qu'inventé.
verifier('transport non estimé', budget1.detail.transport.moyen, 0);

const sousTotal1 = Object.entries(budget1.detail)
  .filter(([poste]) => poste !== 'imprevus')
  .reduce((somme, [, valeurs]) => somme + valeurs.moyen, 0);

verifier('imprévus = 10 % du sous-total', budget1.detail.imprevus.moyen, Math.round(sousTotal1 * TAUX_IMPREVUS));
verifier('total = sous-total + imprévus', budget1.moyen, sousTotal1 + budget1.detail.imprevus.moyen);
verifier('bas < moyen < haut', budget1.bas < budget1.moyen && budget1.moyen < budget1.haut, true);

console.log('\n— Cas 2 : saisies de l’utilisateur et lieux retenus —');

const voyage2 = {
  jours: 7,
  voyageurs: { adultes: 2, enfants: 0 },
  transport: { mode: 'train', prixEstime: 480 },
  hebergement: { prixNuit: 120 },
  tourisme: {
    lieuxRetenus: [
      { nom: 'Knossos', prixEntree: 15 },
      { nom: 'Musée', prixEntree: 12 },
      { nom: 'Vieille ville', prixEntree: null },
    ],
  },
};

const budget2 = calculerBudget(voyage2, fiche);

// Le prix saisi l'emporte sur celui de la fiche, et vaut pour les trois niveaux.
verifier('hébergement saisi', budget2.detail.hebergement.moyen, 120 * 7);
verifier('hébergement identique aux trois niveaux', budget2.detail.hebergement.bas, budget2.detail.hebergement.haut);
verifier('transport saisi', budget2.detail.transport.moyen, 480);

// Activités : (15 + 12) × 2 personnes ; le lieu sans prix ne compte pas.
verifier('activités', budget2.detail.activites.moyen, 27 * 2);

// Le mode « train » seul n'implique pas de voiture de location.
verifier('pas de voiture sans « +voiture »', budget2.detail.transportLocal.moyen, 0);

console.log('\n— Cas 3 : voyage vide, sans fiche —');

const budget3 = calculerBudget({}, null);

verifier('total défini', Number.isFinite(budget3.moyen), true);
verifier('aucun montant négatif', Object.values(budget3.detail).every((v) => v.moyen >= 0), true);
verifier('hébergement inconnu signalé', budget3.hypotheses.some((h) => h.cle === 'hebergementInconnu'), true);
verifier('devise par défaut', budget3.devise, 'EUR');

console.log('\n— Cas 4 : les enfants comptent moins que les adultes pour les repas —');

const solo = calculerBudget({ jours: 5, voyageurs: { adultes: 1, enfants: 0 } }, fiche);
const avecEnfant = calculerBudget({ jours: 5, voyageurs: { adultes: 1, enfants: 1 } }, fiche);

verifier(
  'un enfant ajoute 0,6 part',
  avecEnfant.detail.repas.moyen - solo.detail.repas.moyen,
  Math.round(45 * COEFFICIENT_ENFANT * 5)
);

console.log(echecs === 0 ? '\nTous les cas passent.\n' : `\n${echecs} vérification(s) en échec.\n`);
process.exit(echecs === 0 ? 0 : 1);
