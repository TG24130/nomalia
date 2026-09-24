/**
 * schemas/mois.js — schéma du conseil de mois de départ.
 *
 * Même principe que les autres schémas : la sortie structurée contraint la
 * forme, validerConseilMois() revérifie les valeurs avant mise en cache.
 */

/** Un mois conseillé et sa justification. */
const conseil = {
  type: 'object',
  properties: {
    mois: { type: 'integer', description: 'Numéro du mois, de 1 (janvier) à 12 (décembre).' },
    raison: { type: 'string', description: 'Une phrase courte qui justifie ce choix.' },
  },
  required: ['mois', 'raison'],
  additionalProperties: false,
};

/** Schéma JSON strict de la réponse. */
export const SCHEMA_CONSEIL_MOIS = {
  type: 'object',
  properties: {
    destination: { type: 'string' },
    moinsCher: conseil,
    meilleurClimat: conseil,
  },
  required: ['destination', 'moinsCher', 'meilleurClimat'],
  additionalProperties: false,
};

/**
 * Vérifie qu'un conseil est exploitable par le front.
 * @param {unknown} donnees
 * @returns {{ valide: boolean, erreurs: string[] }}
 */
export function validerConseilMois(donnees) {
  const erreurs = [];

  for (const cle of ['moinsCher', 'meilleurClimat']) {
    const valeur = donnees?.[cle];
    if (!Number.isInteger(valeur?.mois) || valeur.mois < 1 || valeur.mois > 12) {
      erreurs.push(`${cle}.mois doit être un entier de 1 à 12`);
    }
    if (typeof valeur?.raison !== 'string' || !valeur.raison.trim()) {
      erreurs.push(`${cle}.raison manquante`);
    }
  }

  return { valide: erreurs.length === 0, erreurs };
}
