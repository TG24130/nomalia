/**
 * prompts/lieux.js — prompts des listes de lieux.
 *
 * Aucun prompt dans le code métier (CLAUDE.md §9).
 *
 * Deux listes possibles selon le type de séjour choisi au tiroir 4 :
 * les plages, ou les incontournables de la destination.
 */

/** Noms des mois, pour situer la demande dans la saison. */
const MOIS = {
  fr: [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
  ],
};

/** Consigne permanente, indépendante de la destination : reste en cache. */
export const SYSTEME_LIEUX = `Tu es un assistant de préparation de voyage. Tu proposes des lieux à visiter, décrits de façon concrète et utile à quelqu'un qui prépare son séjour.

Règles absolues :
- Utilise la recherche web pour vérifier qu'un lieu existe toujours, ses horaires et ses tarifs.
- N'invente jamais une URL. N'indique un lien officiel que si tu l'as effectivement rencontré lors de ta recherche. En cas de doute, renvoie une chaîne vide.
- Les prix d'entrée sont des ordres de grandeur par adulte, dans la devise locale. Si l'accès est libre ou le tarif introuvable, mets null.
- Choisis des lieux réellement distincts les uns des autres, et répartis sur la destination plutôt que tous au même endroit.
- Les descriptions font deux à trois phrases et disent ce qu'on y voit et pourquoi y aller. Les conseils sont pratiques : meilleur moment de la journée, accès et stationnement, réservation nécessaire ou non, adaptation aux enfants.
- Pas de listes à puces, pas de mise en forme, pas d'emoji.
- Réponds uniquement par l'objet JSON demandé, sans texte autour.`;

/**
 * Construit la demande propre à une destination et à un type de liste.
 *
 * @param {{ destination: string, type: string, mois: number, langue: string,
 *           nombre: number, voyageurs: { adultes: number, enfants: number } }} parametres
 * @returns {string}
 */
export function promptLieux({ destination, type, mois, langue, nombre, voyageurs }) {
  const nomMois = (MOIS[langue] ?? MOIS.fr)[mois - 1];
  const avecEnfants = (voyageurs?.enfants ?? 0) > 0;

  const consigneType =
    type === 'plages'
      ? `Sélectionne les ${nombre} plus belles plages de cette destination. Varie les ambiances : plages familiales abritées, criques plus sauvages, plages réputées. Pour chacune, précise la nature du sable ou des galets, la présence d'ombre et de services, et la facilité d'accès.`
      : `Sélectionne les ${nombre} lieux incontournables de cette destination : sites archéologiques, musées, villages, points de vue ou curiosités naturelles. Pour chacun, précise les horaires d'ouverture habituels, s'il faut réserver à l'avance, et le temps à prévoir sur place.`;

  const consigneEnfants = avecEnfants
    ? `\nLe voyage se fait avec ${voyageurs.enfants} enfant(s) : indique pour chaque lieu s'il leur convient, et ce qu'il faut prévoir.`
    : '';

  return `${consigneType}

Destination : ${destination}
Mois du voyage : ${nomMois}
Langue de rédaction : ${langue}${consigneEnfants}

Tiens compte de la saison : signale dans les conseils ce qui change en ${nomMois}, notamment l'affluence, la chaleur ou une fermeture saisonnière.

Renseigne « sources » avec les adresses des pages effectivement consultées. Si tu n'en as consulté aucune, renvoie un tableau vide.`;
}
