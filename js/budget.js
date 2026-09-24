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
 * Coût journalier d'un van aménagé ou d'un camping-car de location. Retenu
 * par Thierry : plutôt camping-car familial en haute saison.
 */
const LOCATION_VAN_JOUR = { bas: 100, moyen: 150, haut: 220 };

/**
 * Nuitée en aire de camping-car ou en camping, quand on dort dans le van :
 * elle remplace le prix d'une chambre.
 */
const NUIT_VAN = { bas: 15, moyen: 25, haut: 40 };

/**
 * Safari organisé tout compris (hébergement, repas, véhicule, guide, droits
 * d'entrée des parcs), par personne et par jour. Retenu par Thierry : camp
 * simple, lodge, camp de luxe — ordres de grandeur d'Afrique de l'Est.
 */
const SAFARI_JOUR = { bas: 200, moyen: 350, haut: 600 };

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
  'safari',
  'transportLocal',
  'annexes',
  'imprevus',
];

/** Prix de la fiche à retenir selon le type de logement choisi. */
const PRIX_PAR_LOGEMENT = {
  hotel: 'hotelNuit',
  appartement: 'locationNuit',
  gite: 'locationNuit',
  'chez-habitant': 'locationNuit',
  camping: 'campingNuit',
  'camping-materiel-loue': 'campingNuit',
};

/**
 * Prix par nuit de la fiche pour le logement choisi ; l'hôtel à défaut.
 * @param {object} budgetMoyen point budgetMoyen de la fiche
 * @param {string|null} type type de logement du voyage
 * @returns {{ eco: number, moyen: number, confort: number }|null}
 */
function prixNuitFiche(budgetMoyen, type) {
  return budgetMoyen?.[PRIX_PAR_LOGEMENT[type]] ?? budgetMoyen?.hotelNuit ?? null;
}

/**
 * Coût d'une journée sur place pour tout le groupe : une nuit du logement
 * choisi et les repas de chacun. Sert d'ordre de grandeur dans la fiche.
 *
 * @param {object} voyage
 * @param {object} budgetMoyen point budgetMoyen de la fiche
 * @returns {{ eco: number, moyen: number, confort: number }|null}
 */
export function coutJournalier(voyage, budgetMoyen) {
  const nuit = prixNuitFiche(budgetMoyen, voyage?.hebergement?.type);
  const repas = budgetMoyen?.repasJour;
  if (!nuit || !repas) return null;

  const adultes = nombrePositif(voyage?.voyageurs?.adultes) ?? 1;
  const enfants = Number(voyage?.voyageurs?.enfants) || 0;
  const parts = adultes + enfants * COEFFICIENT_ENFANT;

  return Object.fromEntries(
    ['eco', 'moyen', 'confort'].map((niveau) => [
      niveau,
      arrondir((nombrePositif(nuit[niveau]) ?? 0) + (nombrePositif(repas[niveau]) ?? 0) * parts),
    ])
  );
}

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

  // Un safari organisé loge et nourrit le voyageur pendant sa durée : ces
  // jours-là sortent de l'hébergement et des repas, sauf s'il ne comprend
  // ni l'un ni l'autre.
  const safari = voyage?.tourisme?.type === 'safari' ? voyage.tourisme.safari ?? null : null;
  const joursSafari = Math.min(jours, nombrePositif(safari?.jours) ?? 0);
  const safariToutCompris = joursSafari > 0 && safari?.toutCompris !== false;
  const nuitsLogement = safariToutCompris ? nuits - joursSafari : nuits;
  const joursRepas = safariToutCompris ? jours - joursSafari : jours;

  // Un enfant mange et paie moins qu'un adulte : on compte des « parts ».
  const parts = adultes + enfants * COEFFICIENT_ENFANT;

  const budgetMoyen = fiche?.points?.budgetMoyen ?? null;

  // Le total est toujours en euros, et rien d'autre n'est additionnable ici :
  // la location de voiture et les frais annexes sont des forfaits en euros, et
  // le prix du transport est saisi en euros. Les fiches et les listes de lieux
  // renvoient donc elles aussi des euros, convertis au taux courant côté
  // Cloud Function (voir functions/prompts/fiche.js). Une ancienne entrée de
  // cache libellée dans la monnaie locale est régénérée grâce à VERSION_CACHE.
  const devise = 'EUR';

  /** Détail par poste, chaque poste portant ses trois niveaux. */
  const detail = Object.fromEntries(POSTES.map((poste) => [poste, { bas: 0, moyen: 0, haut: 0 }]));

  /* — Hébergement — */

  // Prix total du séjour, tel qu'affiché par les sites de réservation.
  const prixTotalSaisi = nombrePositif(voyage?.hebergement?.prixTotal);
  const enVan = voyage?.transport?.mode === 'van';

  if (prixTotalSaisi) {
    for (const { cle } of NIVEAUX) detail.hebergement[cle] = arrondir(prixTotalSaisi);
    hypotheses.push({
      cle: 'hebergementSaisi',
      valeurs: { prix: prixTotalSaisi, nuits },
    });
  } else if (enVan) {
    for (const { cle } of NIVEAUX) detail.hebergement[cle] = arrondir(NUIT_VAN[cle] * nuitsLogement);
    hypotheses.push({
      cle: 'hebergementVan',
      valeurs: { nuits: nuitsLogement, bas: NUIT_VAN.bas, haut: NUIT_VAN.haut },
    });
  } else if (prixNuitFiche(budgetMoyen, voyage?.hebergement?.type)) {
    const prixNuit = prixNuitFiche(budgetMoyen, voyage?.hebergement?.type);
    for (const { cle, prix } of NIVEAUX) {
      const parNuit = nombrePositif(prixNuit[prix]) ?? 0;
      detail.hebergement[cle] = arrondir(parNuit * nuitsLogement);
    }
    hypotheses.push({ cle: 'hebergementFiche', valeurs: { nuits: nuitsLogement } });
  } else {
    hypotheses.push({ cle: 'hebergementInconnu' });
  }

  /* — Repas — */

  if (budgetMoyen?.repasJour) {
    for (const { cle, prix } of NIVEAUX) {
      const parJour = nombrePositif(budgetMoyen.repasJour[prix]) ?? 0;
      detail.repas[cle] = arrondir(parJour * parts * joursRepas);
    }

    // Les nombres sont renvoyés bruts : leur mise en forme relève de
    // l'affichage, qui seul connaît la langue de l'utilisateur.
    hypotheses.push({
      cle: 'repas',
      valeurs: { jours: joursRepas, parts, coefficient: COEFFICIENT_ENFANT },
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

  // Seuls les combinés « +voiture » louent une voiture sur place : le mode
  // « voiture » seul désigne la voiture personnelle.
  const avecLocation = String(voyage?.transport?.mode ?? '').endsWith('+voiture');
  const tarif = enVan ? LOCATION_VAN_JOUR : avecLocation ? LOCATION_VOITURE_JOUR : null;

  if (tarif) {
    for (const { cle } of NIVEAUX) {
      detail.transportLocal[cle] = arrondir(tarif[cle] * jours);
    }
    hypotheses.push({
      cle: enVan ? 'van' : 'voiture',
      valeurs: { jours, bas: tarif.bas, haut: tarif.haut },
    });
  }

  /* — Activités — */

  const lieux = Array.isArray(voyage?.tourisme?.lieuxRetenus) ? voyage.tourisme.lieuxRetenus : [];
  const entrees = lieux.reduce((somme, lieu) => somme + (nombrePositif(lieu?.prixEntree) ?? 0), 0);

  // Les droits d'entrée des parcs sont compris dans un safari organisé.
  if (entrees > 0 && joursSafari === 0) {
    const total = arrondir(entrees * personnes);
    for (const { cle } of NIVEAUX) detail.activites[cle] = total;
    hypotheses.push({
      cle: 'activites',
      valeurs: { nombre: lieux.length, personnes, parPersonne: arrondir(entrees) },
    });
  }

  /* — Safari organisé — */

  if (joursSafari > 0) {
    const prixSafariSaisi = nombrePositif(safari?.prixTotal);

    if (prixSafariSaisi) {
      for (const { cle } of NIVEAUX) detail.safari[cle] = arrondir(prixSafariSaisi);
      hypotheses.push({ cle: 'safariSaisi', valeurs: { prix: prixSafariSaisi, jours: joursSafari } });
    } else {
      for (const { cle } of NIVEAUX) {
        detail.safari[cle] = arrondir(SAFARI_JOUR[cle] * joursSafari * parts);
      }
      hypotheses.push({
        cle: 'safari',
        valeurs: { jours: joursSafari, bas: SAFARI_JOUR.bas, haut: SAFARI_JOUR.haut, parts },
      });
    }

    if (safariToutCompris) hypotheses.push({ cle: 'safariInclus', valeurs: { jours: joursSafari } });
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
