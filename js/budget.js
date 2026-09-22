/**
 * budget.js — calcul du budget estimatif.
 *
 * Fonction pure, sans accès réseau ni DOM : testable isolément
 * (CLAUDE.md §6, tiroir 6). Elle ne lit que le voyage et la fiche
 * destination, et renvoie trois niveaux de budget avec le détail par poste
 * et la liste des hypothèses retenues.
 *
 * Aucun chiffre n'est inventé silencieusement : tout montant qui ne vient
 * pas d'une saisie de l'utilisateur ou de la fiche est produit par une
 * constante déclarée ici et annoncé dans les hypothèses.
 */

/** Part d'un repas d'enfant par rapport à un adulte (CLAUDE.md §6). */
export const COEFFICIENT_ENFANT = 0.6;

/** Part ajoutée au total au titre des imprévus. */
export const TAUX_IMPREVUS = 0.1;

/**
 * Coût journalier d'une voiture de location, par niveau de budget.
 * Ordre de grandeur européen hors haute saison, à ajuster si besoin.
 */
const LOCATION_VOITURE_JOUR = { bas: 35, moyen: 55, haut: 90 };

/**
 * Dépenses annexes par jour et par personne : transports urbains, café,
 * souvenirs, menus imprévus du quotidien. Volontairement modeste.
 */
const ANNEXES_JOUR_PERSONNE = { bas: 5, moyen: 12, haut: 25 };

/** Les trois niveaux de budget, et le niveau de prix correspondant. */
const NIVEAUX = [
  { cle: 'bas', prix: 'eco' },
  { cle: 'moyen', prix: 'moyen' },
  { cle: 'haut', prix: 'confort' },
];

/** Postes du détail, dans l'ordre d'affichage. */
export const POSTES = [
  'transport',
  'hebergement',
  'repas',
  'activites',
  'transportLocal',
  'annexes',
  'imprevus',
];

/**
 * Arrondit un montant à l'euro.
 * @param {number} valeur
 * @returns {number}
 */
function arrondir(valeur) {
  return Math.round(valeur) || 0;
}

/**
 * Lit un nombre positif, ou null.
 * @param {unknown} valeur
 * @returns {number|null}
 */
function nombrePositif(valeur) {
  const nombre = Number(valeur);
  return Number.isFinite(nombre) && nombre > 0 ? nombre : null;
}

/**
 * Calcule le budget estimatif d'un voyage.
 *
 * @param {object} voyage objet voyage (CLAUDE.md §4)
 * @param {object|null} fiche fiche destination, pour les prix moyens sur place
 * @returns {{ bas: number, moyen: number, haut: number,
 *             detail: Record<string, { bas: number, moyen: number, haut: number }>,
 *             devise: string, hypotheses: string[] }}
 */
export function calculerBudget(voyage, fiche = null) {
  const hypotheses = [];

  const jours = nombrePositif(voyage?.jours) ?? 1;
  const adultes = nombrePositif(voyage?.voyageurs?.adultes) ?? 1;
  const enfants = Number(voyage?.voyageurs?.enfants) || 0;
  const personnes = adultes + enfants;

  // Une nuit par jour de voyage : le modèle ne distingue pas le jour du
  // départ de celui du retour.
  const nuits = jours;

  const budgetMoyen = fiche?.points?.budgetMoyen ?? null;
  const devise = budgetMoyen?.devise ?? 'EUR';

  /** Détail par poste, chaque poste portant ses trois niveaux. */
  const detail = Object.fromEntries(POSTES.map((poste) => [poste, { bas: 0, moyen: 0, haut: 0 }]));

  /* — Hébergement — */

  const prixNuitSaisi = nombrePositif(voyage?.hebergement?.prixNuit);

  if (prixNuitSaisi) {
    for (const { cle } of NIVEAUX) detail.hebergement[cle] = arrondir(prixNuitSaisi * nuits);
    hypotheses.push({
      cle: 'hebergementSaisi',
      valeurs: { prix: prixNuitSaisi, nuits },
    });
  } else if (budgetMoyen?.hotelNuit) {
    for (const { cle, prix } of NIVEAUX) {
      const parNuit = nombrePositif(budgetMoyen.hotelNuit[prix]) ?? 0;
      detail.hebergement[cle] = arrondir(parNuit * nuits);
    }
    hypotheses.push({ cle: 'hebergementFiche', valeurs: { nuits } });
  } else {
    hypotheses.push({ cle: 'hebergementInconnu' });
  }

  /* — Repas — */

  if (budgetMoyen?.repasJour) {
    // Un enfant mange moins qu'un adulte : on compte des « parts » plutôt que
    // des personnes.
    const parts = adultes + enfants * COEFFICIENT_ENFANT;

    for (const { cle, prix } of NIVEAUX) {
      const parJour = nombrePositif(budgetMoyen.repasJour[prix]) ?? 0;
      detail.repas[cle] = arrondir(parJour * parts * jours);
    }

    // Les nombres sont renvoyés bruts : leur mise en forme relève de
    // l'affichage, qui seul connaît la langue de l'utilisateur.
    hypotheses.push({
      cle: 'repas',
      valeurs: { jours, parts, coefficient: COEFFICIENT_ENFANT },
    });
  } else {
    hypotheses.push({ cle: 'repasInconnu' });
  }

  /* — Transport — */

  const transportSaisi = nombrePositif(voyage?.transport?.prixEstime);

  if (transportSaisi) {
    for (const { cle } of NIVEAUX) detail.transport[cle] = arrondir(transportSaisi);
    hypotheses.push({ cle: 'transportSaisi', valeurs: { prix: transportSaisi } });
  } else {
    // La fiche ne contient pas d'estimation du trajet aller-retour : plutôt
    // que d'inventer un prix de billet, on laisse le poste à zéro et on le dit.
    hypotheses.push({ cle: 'transportInconnu' });
  }

  /* — Transport sur place — */

  const avecVoiture = String(voyage?.transport?.mode ?? '').includes('voiture');

  if (avecVoiture) {
    for (const { cle } of NIVEAUX) {
      detail.transportLocal[cle] = arrondir(LOCATION_VOITURE_JOUR[cle] * jours);
    }
    hypotheses.push({
      cle: 'voiture',
      valeurs: { jours, bas: LOCATION_VOITURE_JOUR.bas, haut: LOCATION_VOITURE_JOUR.haut },
    });
  }

  /* — Activités — */

  const lieux = Array.isArray(voyage?.tourisme?.lieuxRetenus) ? voyage.tourisme.lieuxRetenus : [];
  const entrees = lieux.reduce((somme, lieu) => somme + (nombrePositif(lieu?.prixEntree) ?? 0), 0);

  if (entrees > 0) {
    const total = arrondir(entrees * personnes);
    for (const { cle } of NIVEAUX) detail.activites[cle] = total;
    hypotheses.push({
      cle: 'activites',
      valeurs: { nombre: lieux.length, personnes, parPersonne: arrondir(entrees) },
    });
  }

  /* — Dépenses annexes — */

  for (const { cle } of NIVEAUX) {
    detail.annexes[cle] = arrondir(ANNEXES_JOUR_PERSONNE[cle] * personnes * jours);
  }

  hypotheses.push({
    cle: 'annexes',
    valeurs: { bas: ANNEXES_JOUR_PERSONNE.bas, haut: ANNEXES_JOUR_PERSONNE.haut },
  });

  /* — Imprévus et totaux — */

  const totaux = {};

  for (const { cle } of NIVEAUX) {
    const sousTotal = POSTES.filter((poste) => poste !== 'imprevus').reduce(
      (somme, poste) => somme + detail[poste][cle],
      0
    );

    detail.imprevus[cle] = arrondir(sousTotal * TAUX_IMPREVUS);
    totaux[cle] = sousTotal + detail.imprevus[cle];
  }

  hypotheses.push({ cle: 'imprevus', valeurs: { taux: Math.round(TAUX_IMPREVUS * 100) } });

  return { ...totaux, detail, devise, hypotheses };
}
