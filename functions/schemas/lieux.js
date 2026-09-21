/**
 * schemas/lieux.js — schéma des listes de lieux (plages ou incontournables).
 *
 * Même principe que schemas/fiche.js : le schéma contraint la sortie du
 * modèle, et validerLieux() revérifie côté serveur avant mise en cache
 * (CLAUDE.md §3.7).
 *
 * Les contraintes de valeur (minimum, maxLength…) ne sont pas acceptées par
 * la sortie structurée : elles sont portées par le validateur.
 */

/** Types de listes demandables. */
export const TYPES_LIEUX = ['plages', 'incontournables'];

/** Nombre de lieux attendus (CLAUDE.md §6, tiroir 4). */
export const NOMBRE_LIEUX = 5;

/** Schéma JSON strict d'une liste de lieux. */
export const SCHEMA_LIEUX = {
  type: 'object',
  properties: {
    destination: { type: 'string' },
    lieux: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          nom: { type: 'string' },
          description: { type: 'string' },
          conseils: {
            type: 'string',
            description:
              "Conseils pratiques : meilleur moment de la journée, accès, stationnement, adaptation aux enfants, réservation nécessaire ou non.",
          },
          prixEntree: {
            type: ['number', 'null'],
            description:
              "Prix d'entrée par adulte dans la devise locale. null si l'accès est libre ou si le prix est inconnu.",
          },
          devise: { type: ['string', 'null'] },
          lienOfficiel: {
            type: 'string',
            description:
              "Adresse du site officiel du lieu, uniquement si elle a été rencontrée pendant la recherche. Chaîne vide sinon.",
          },
        },
        required: ['nom', 'description', 'conseils', 'prixEntree', 'devise', 'lienOfficiel'],
        additionalProperties: false,
      },
    },
    sources: { type: 'array', items: { type: 'string' } },
  },
  required: ['destination', 'lieux', 'sources'],
  additionalProperties: false,
};

/**
 * Vérifie qu'une liste de lieux est exploitable par le front.
 *
 * Volontairement tolérante sur les champs décoratifs : une liste utilisable
 * ne doit pas être rejetée pour un prix manquant.
 *
 * @param {unknown} donnees
 * @returns {{ valide: boolean, erreurs: string[] }}
 */
export function validerLieux(donnees) {
  const erreurs = [];

  const estObjet = (valeur) =>
    valeur !== null && typeof valeur === 'object' && !Array.isArray(valeur);
  const texteRenseigne = (valeur) => typeof valeur === 'string' && valeur.trim().length > 0;

  if (!estObjet(donnees)) {
    return { valide: false, erreurs: ["La réponse n'est pas un objet JSON."] };
  }

  if (!texteRenseigne(donnees.destination)) erreurs.push('destination manquante');
  if (!Array.isArray(donnees.sources)) erreurs.push('sources doit être un tableau');

  if (!Array.isArray(donnees.lieux) || donnees.lieux.length === 0) {
    erreurs.push('aucun lieu renvoyé');
    return { valide: false, erreurs };
  }

  donnees.lieux.forEach((lieu, index) => {
    const position = index + 1;

    if (!estObjet(lieu)) {
      erreurs.push(`lieu ${position} invalide`);
      return;
    }

    if (!texteRenseigne(lieu.nom)) erreurs.push(`lieu ${position} : nom manquant`);
    if (!texteRenseigne(lieu.description)) erreurs.push(`lieu ${position} : description manquante`);
    if (!texteRenseigne(lieu.conseils)) erreurs.push(`lieu ${position} : conseils manquants`);

    if (lieu.prixEntree !== null && typeof lieu.prixEntree !== 'number') {
      erreurs.push(`lieu ${position} : prix d'entrée invalide`);
    }
  });

  return { valide: erreurs.length === 0, erreurs };
}
