/**
 * prompts/lieux.js — prompts des listes de lieux.
 *
 * Aucun prompt dans le code métier (CLAUDE.md §9).
 *
 * Une liste par type de séjour choisi au tiroir 4 : incontournables,
 * business, étapes d'un trip liberté, safari ou séjour romantique.
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

Méthode, dans cet ordre :
1. Dresse d'abord la liste depuis ce que tu connais de la destination, sans rien chercher. Tes connaissances suffisent à nommer ce qui compte dans une région.
2. Utilise ensuite la recherche web pour ce qui a pu changer et que tu ignores : une fermeture, des travaux, un tarif que tu ne connais pas. Tu disposes de peu de recherches — ne les dépense pas à confirmer ce dont tu es déjà sûr, ni une par lieu.
3. Réponds avec la liste, corrigée de ce que tu as appris.

Règles absolues :
- Ne renvoie pas une liste vide si la destination a quelque chose à offrir sur ce thème.
- N'invente jamais une URL. N'indique un lien officiel que si tu l'as effectivement rencontré lors de ta recherche ; sinon, renvoie une chaîne vide. Ne lance pas de recherche dans le seul but d'en trouver un : ce champ peut rester vide.
- Les prix d'entrée sont des ordres de grandeur par adulte, **exprimés en euros**. Si la destination emploie une autre monnaie, cherche son taux une seule fois et convertis toute la liste avec — pas une recherche par tarif. Si l'accès est libre ou le tarif introuvable, mets null.
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

  // Une consigne par type de séjour. Les types partagent le même schéma : ce
  // qui leur est propre — nuits conseillées, altitude, permis — se dit dans la
  // description et les conseils, plutôt que dans des champs qui resteraient
  // vides pour tous les autres types.
  const CONSIGNES = {
    incontournables: `Sélectionne les ${nombre} lieux incontournables de cette destination : sites archéologiques, musées, villages, points de vue ou curiosités naturelles. Pour chacun, précise les horaires d'ouverture habituels, s'il faut réserver à l'avance, et le temps à prévoir sur place.`,

    safari: `Sélectionne les ${nombre} meilleurs endroits d'observation de la faune sauvage de cette destination : parcs nationaux, réserves, zones humides ou sites d'observation réputés. Pour chacun, dis quelles espèces on y voit vraiment et à quelle période de l'année elles sont les plus visibles. Dans les conseils, précise le mode d'observation (véhicule tout-terrain, à pied, en bateau), s'il faut passer par un guide ou un opérateur agréé, la durée habituelle d'une sortie et le meilleur moment de la journée. Le prix d'entrée est le droit d'entrée du parc par adulte, hors prestation de guide.`,

    etapes: `Construis un itinéraire de ${nombre} étapes pour parcourir cette destination de ville en ville, dans un ordre géographique cohérent, sans revenir deux fois au même endroit. Numérote les étapes dans l'ordre du parcours. Pour chacune, dis ce qui justifie de s'y arrêter et combien de nuits y passer. Dans les conseils, précise la distance et le temps de trajet depuis l'étape précédente ainsi que le moyen de transport le plus pratique entre les deux. Le prix d'entrée n'a pas de sens pour une étape : mets null.`,

    romantique: `Sélectionne les ${nombre} plus beaux endroits de cette destination pour un séjour à deux : points de vue au coucher du soleil, ruelles et jardins à parcourir sans hâte, tables réputées, bains thermaux, balades en bateau au crépuscule. Écarte ce qui se visite en groupe serré ou dans le bruit. Pour chacun, dis ce qui en fait un moment à deux plutôt qu'une visite de plus. Dans les conseils, précise le moment de la journée où y aller, s'il faut réserver et combien de temps à l'avance, et la tenue attendue quand l'endroit l'impose.`,

    business: `Prépare un séjour professionnel dans cette destination en ${nombre} adresses, dans cet ordre de priorité : le ou les quartiers d'affaires et le secteur où loger pour y être au plus près, deux ou trois restaurants adaptés à un déjeuner ou un dîner d'affaires (calmes, service efficace, réputés), puis un espace de coworking ou un lieu où travailler hors de l'hôtel. Pour chacun, dis en quoi il est pratique pour un voyageur d'affaires. Dans les conseils, précise comment le rejoindre depuis l'aéroport principal et avec quel transport (durée, coût approximatif), s'il faut réserver, et le niveau de prix. Le prix d'entrée est le prix d'une journée pour un coworking, et null pour un quartier ou un restaurant.`,
  };

  const consigneType = CONSIGNES[type] ?? CONSIGNES.incontournables;

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
