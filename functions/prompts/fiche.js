/**
 * prompts/fiche.js — prompt de la fiche destination en 10 points.
 *
 * Aucun prompt ne doit vivre dans le code métier (CLAUDE.md §9).
 *
 * Trois exigences sont rappelées au modèle à chaque appel :
 *  - répondre dans la langue demandée ;
 *  - rester prudent sur les données réglementaires et sanitaires ;
 *  - ne jamais inventer d'URL (CLAUDE.md §3.6).
 */

import { MOIS, consigneLangue, nomPays } from './langues.js';

/** Consigne permanente, indépendante de la destination : reste en cache. */
export const SYSTEME_FICHE = `Tu es un assistant de préparation de voyage. Tu rédiges des fiches pratiques factuelles et concises pour des voyageurs.

Règles absolues :
- Utilise la recherche web pour toute donnée susceptible d'avoir changé : formalités d'entrée, vaccins, prix moyens, monnaie.
- N'invente jamais une URL. N'indique un lien que si tu l'as effectivement rencontré lors de ta recherche. En cas de doute, renvoie une chaîne vide.
- Sur les formalités d'entrée et les vaccins, reste prudent et générique : ces informations changent souvent et engagent la sécurité du voyageur. Indique la règle générale, jamais une certitude administrative.
- Les prix sont des ordres de grandeur par personne et par nuit ou par jour, **exprimés en euros**. Si la destination utilise une autre monnaie, convertis au taux courant, que tu vérifies par la recherche web. Ne renvoie jamais de montant dans la monnaie locale : l'application additionne ces prix avec d'autres postes déjà libellés en euros.
- Les résumés font une à trois phrases. Pas de listes à puces, pas de mise en forme, pas d'emoji.
- Réponds uniquement par l'objet JSON demandé, sans texte autour.`;

/**
 * Construit la demande propre à une destination.
 *
 * @param {{ destination: string, mois: number, langue: string, nationalite: string }} parametres
 * @returns {string}
 */
export function promptFiche({ destination, mois, langue, nationalite }) {
  const nomMois = MOIS[mois - 1];
  const pays = nomPays(nationalite);

  return `Rédige la fiche pratique de la destination suivante.

Destination : ${destination}
Mois du voyage : ${nomMois}
Nationalité du voyageur : ${pays} (passeport ${nationalite})
${consigneLangue(langue)}

Contenu attendu, en dix points :
1. visa — formalités d'entrée pour un titulaire d'un passeport de ce pays (${pays}). Dans « lienOfficiel », cite la page des conseils officiels aux voyageurs que le gouvernement de ce pays consacre à la destination (pour la France, France Diplomatie) si tu l'as trouvée ; sinon laisse la chaîne vide.
2. climat — climat général de la destination et ce qu'il faut en attendre en ${nomMois}.
3. meilleuresPeriodes — numéros des mois les plus favorables, et pourquoi.
4. decalageHoraire — écart en heures par rapport à la capitale du pays du voyageur (${pays}) en ${nomMois} (négatif si la destination est en retard).
5. monnaie — code ISO, nom, et usage pratique (carte acceptée ou non, espèces, pourboire).
6. langue — langue officielle et facilité à se débrouiller en anglais ou dans la langue du voyageur.
7. prises — types de prises (lettres), tension, et si un adaptateur est nécessaire pour les appareils achetés dans le pays du voyageur (${pays}).
8. vaccins — obligatoires et recommandés, avec la mention que cela doit être confirmé par un médecin.
9. budgetMoyen — prix indicatifs en trois niveaux (eco, moyen, confort) : « hotelNuit » une chambre double d'hôtel par nuit ; « locationNuit » un appartement ou un gîte entier pour une famille, par nuit ; « campingNuit » un emplacement de camping pour une tente ou un van, par nuit ; « repasJour » les repas d'une journée pour une personne.
10. temperatureMer — « moisChoisi » est la température de la mer en degrés Celsius pendant le mois du voyage, jamais le numéro du mois ; « parMois » contient les douze moyennes mensuelles en degrés, de janvier à décembre, et la valeur de « moisChoisi » doit être celle de ${nomMois} dans ce tableau. Si la destination n'a pas de littoral, mets null pour les deux et explique-le en une phrase dans « resume ».

Renseigne « sources » avec les adresses des pages effectivement consultées. Si tu n'en as consulté aucune, renvoie un tableau vide.`;
}
