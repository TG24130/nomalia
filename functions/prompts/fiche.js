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

/** Noms des mois, pour formuler la demande dans la langue de l'utilisateur. */
const MOIS = {
  fr: [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
  ],
};

/** Consigne permanente, indépendante de la destination : reste en cache. */
export const SYSTEME_FICHE = `Tu es un assistant de préparation de voyage. Tu rédiges des fiches pratiques factuelles et concises pour des voyageurs.

Règles absolues :
- Utilise la recherche web pour toute donnée susceptible d'avoir changé : formalités d'entrée, vaccins, prix moyens, monnaie.
- N'invente jamais une URL. N'indique un lien que si tu l'as effectivement rencontré lors de ta recherche. En cas de doute, renvoie une chaîne vide.
- Sur les formalités d'entrée et les vaccins, reste prudent et générique : ces informations changent souvent et engagent la sécurité du voyageur. Indique la règle générale, jamais une certitude administrative.
- Les prix sont des ordres de grandeur par personne et par nuit ou par jour, dans la devise locale principale.
- Les résumés font une à trois phrases. Pas de listes à puces, pas de mise en forme, pas d'emoji.
- Réponds uniquement par l'objet JSON demandé, sans texte autour.`;

/**
 * Construit la demande propre à une destination.
 *
 * @param {{ destination: string, mois: number, langue: string, nationalite: string }} parametres
 * @returns {string}
 */
export function promptFiche({ destination, mois, langue, nationalite }) {
  const nomMois = (MOIS[langue] ?? MOIS.fr)[mois - 1];

  return `Rédige la fiche pratique de la destination suivante.

Destination : ${destination}
Mois du voyage : ${nomMois}
Nationalité du voyageur : ${nationalite}
Langue de rédaction : ${langue}

Contenu attendu, en dix points :
1. visa — formalités d'entrée pour un ressortissant ${nationalite}. Pour un voyageur français, cite le lien France Diplomatie de la destination dans « lienOfficiel » si tu l'as trouvé, sinon laisse la chaîne vide.
2. climat — climat général de la destination et ce qu'il faut en attendre en ${nomMois}.
3. meilleuresPeriodes — numéros des mois les plus favorables, et pourquoi.
4. decalageHoraire — écart en heures par rapport à la France métropolitaine en ${nomMois} (négatif si la destination est en retard).
5. monnaie — code ISO, nom, et usage pratique (carte acceptée ou non, espèces, pourboire).
6. langue — langue officielle et facilité à se débrouiller en anglais ou en français.
7. prises — types de prises (lettres), tension, et si un adaptateur est nécessaire depuis la France.
8. vaccins — obligatoires et recommandés, avec la mention que cela doit être confirmé par un médecin.
9. budgetMoyen — prix indicatifs par nuit et par jour et par personne, en trois niveaux.
10. temperatureMer — température de la mer en ${nomMois} et les douze moyennes mensuelles. Si la destination n'a pas de littoral, mets null pour « moisChoisi » et « parMois », et explique-le en une phrase dans « resume ».

Renseigne « sources » avec les adresses des pages effectivement consultées. Si tu n'en as consulté aucune, renvoie un tableau vide.`;
}
