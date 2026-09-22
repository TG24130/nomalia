/**
 * prompts/randos.js — prompt des listes de randonnées.
 *
 * Aucun prompt dans le code métier (CLAUDE.md §9).
 */

/** Noms des mois, pour situer la demande dans la saison. */
const MOIS = {
  fr: [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
  ],
};

/** Consigne permanente, indépendante de la destination : reste en cache. */
export const SYSTEME_RANDOS = `Tu es un assistant de préparation de voyage, spécialisé dans la randonnée. Tu proposes des itinéraires existants et documentés, décrits avec les chiffres dont un marcheur a besoin pour choisir.

Méthode, dans cet ordre :
1. Dresse d'abord la liste des itinéraires que tu connais à cette destination. Tes connaissances suffisent à nommer les grands classiques d'une région : commence par là, sans rien chercher.
2. Utilise ensuite la recherche web pour corriger les chiffres dont tu doutes et repérer une fermeture ou une difficulté d'accès récente. Tu disposes de peu de recherches : consacre-les aux itinéraires dont tu es le moins sûr, pas à confirmer ce que tu sais déjà.
3. Réponds avec la liste, corrigée de ce que tu as appris.

Règles absolues :
- Ne renvoie pas une liste vide si la destination compte des sentiers connus. Une liste vide ne se justifie que là où il n'y a réellement rien à marcher.
- N'invente jamais un itinéraire. Un itinéraire non vérifié se propose quand même : dis alors dans les conseils que ses chiffres sont à confirmer avant de partir.
- N'invente jamais une URL.
- La distance, la durée et le dénivelé doivent être cohérents entre eux et avec le niveau annoncé. La durée est un temps de marche effectif, sans les pauses.
- Le point de départ doit être un lieu précis et repérable : parking, village, refuge ou col nommé.
- Signale dans les conseils ce qui peut rendre la sortie difficile ou dangereuse : chaleur, absence d'ombre ou d'eau, terrain exposé, nécessité d'une navette ou d'un billet.
- Les descriptions font deux à trois phrases. Pas de listes à puces, pas de mise en forme, pas d'emoji.
- Réponds uniquement par l'objet JSON demandé, sans texte autour.`;

/**
 * Construit la demande propre à une destination et à des critères.
 *
 * @param {{ destination: string, mois: number, langue: string, nombre: number,
 *           niveau: string|null, dureeMax: number|null, deniveleMax: number|null,
 *           boucleUniquement: boolean, adapteeEnfants: boolean }} parametres
 * @returns {string}
 */
export function promptRandos({
  destination,
  mois,
  langue,
  nombre,
  niveau,
  dureeMax,
  deniveleMax,
  boucle,
  adapteeEnfants,
}) {
  const nomMois = (MOIS[langue] ?? MOIS.fr)[mois - 1];

  /** Formulation attendue pour chaque niveau, l'intitulé seul étant ambigu. */
  const DESCRIPTION_NIVEAU = {
    facile: 'facile : terrain roulant, faible dénivelé, accessible à tous',
    moyen: 'moyen : quelques montées soutenues, bonne condition physique souhaitable',
    difficile: 'difficile : longue, dénivelé important, terrain parfois technique',
    'tres-difficile':
      'très difficile : course engagée, terrain technique ou exposé, expérience de la montagne nécessaire',
  };

  const criteres = [];
  if (niveau) criteres.push(`- niveau de difficulté ${DESCRIPTION_NIVEAU[niveau] ?? niveau}`);
  if (dureeMax) criteres.push(`- durée de marche maximale : ${dureeMax} heures`);
  if (deniveleMax) criteres.push(`- dénivelé positif maximal : ${deniveleMax} mètres`);
  if (boucle === 'oui') criteres.push('- uniquement des boucles revenant au point de départ');
  if (boucle === 'non') {
    criteres.push("- uniquement des aller-retours ou des traversées, pas de boucle");
  }
  if (adapteeEnfants) {
    criteres.push('- adaptées à des enfants : sans passage exposé ni difficulté technique');
  }

  // Les critères sont présentés comme des préférences, non comme un filtre.
  // Formulés en « à respecter », ils servaient de tamis : une demande un peu
  // serrée — difficile avec un dénivelé modéré — ne laissait rien passer, et
  // le tiroir affichait une liste vide au bout de deux minutes.
  const listeCriteres = criteres.length
    ? `
Ce que cherche le voyageur :
${criteres.join('\n')}

Classe tes propositions de la plus proche de ces souhaits à la plus éloignée. Si aucune ne leur correspond exactement, propose quand même les plus approchantes et dis dans leurs conseils en quoi elles s'en écartent — un voyageur préfère une randonnée un peu plus longue que prévu à une page vide.
`
    : '';

  return `Sélectionne jusqu'à ${nombre} randonnées à faire à cette destination.

Destination : ${destination}
Mois du voyage : ${nomMois}
Langue de rédaction : ${langue}
${listeCriteres}
Varie les paysages et les secteurs plutôt que de proposer plusieurs itinéraires voisins.

Tiens compte de la saison : indique dans les conseils ce qui change en ${nomMois}, notamment la chaleur, l'enneigement, une fermeture saisonnière ou une affluence importante. Une randonnée impraticable ce mois-là n'a pas sa place dans la liste ; une randonnée simplement moins agréable y reste, avec l'avertissement qui convient.

Renseigne « sources » avec les adresses des pages effectivement consultées. Si tu n'en as consulté aucune, renvoie un tableau vide.`;
}
