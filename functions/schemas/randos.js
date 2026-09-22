/**
 * schemas/randos.js — schéma des listes de randonnées.
 *
 * Même principe que schemas/lieux.js : le schéma contraint la sortie du
 * modèle, validerRandos() revérifie côté serveur avant mise en cache
 * (CLAUDE.md §3.7).
 */

/** Nombre de randonnées attendues (CLAUDE.md §6, tiroir 5). */
export const NOMBRE_RANDOS = 5;

/**
 * Niveaux de difficulté acceptés.
 *
 * Le plan V0 en prévoyait trois ; « très difficile » a été ajouté pour
 * distinguer une longue course engagée d'une randonnée simplement sportive.
 */
export const NIVEAUX = ['facile', 'moyen', 'difficile', 'tres-difficile'];

/** Durées maximales proposées, en heures. */
export const DUREES_MAX = [2, 3, 4, 6, 8];

/** Schéma JSON strict d'une liste de randonnées. */
export const SCHEMA_RANDOS = {
  type: 'object',
  properties: {
    destination: { type: 'string' },
    randos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          nom: { type: 'string' },
          description: { type: 'string' },
          niveau: {
            type: 'string',
            enum: NIVEAUX,
            description: 'Difficulté réelle du parcours.',
          },
          distanceKm: { type: 'number', description: 'Longueur du parcours en kilomètres.' },
          dureeHeures: {
            type: 'number',
            description: 'Durée de marche en heures, sans les pauses.',
          },
          deniveleM: {
            type: 'number',
            description: 'Dénivelé positif cumulé en mètres.',
          },
          boucle: {
            type: 'boolean',
            description: "Vrai si l'itinéraire revient à son point de départ.",
          },
          adapteeEnfants: { type: 'boolean' },
          pointDepart: {
            type: 'string',
            description: 'Lieu de départ précis, utilisable pour un itinéraire routier.',
          },
          meilleureSaison: { type: 'string' },
          conseils: {
            type: 'string',
            description:
              'Conseils pratiques : eau, ombre, chaussures, navette ou taxi éventuel, horaires à éviter.',
          },
        },
        required: [
          'nom',
          'description',
          'niveau',
          'distanceKm',
          'dureeHeures',
          'deniveleM',
          'boucle',
          'adapteeEnfants',
          'pointDepart',
          'meilleureSaison',
          'conseils',
        ],
        additionalProperties: false,
      },
    },
    sources: { type: 'array', items: { type: 'string' } },
  },
  required: ['destination', 'randos', 'sources'],
  additionalProperties: false,
};

/**
 * Vérifie qu'une liste de randonnées est exploitable par le front.
 *
 * @param {unknown} donnees
 * @returns {{ valide: boolean, erreurs: string[] }}
 */
export function validerRandos(donnees) {
  const erreurs = [];

  const estObjet = (valeur) =>
    valeur !== null && typeof valeur === 'object' && !Array.isArray(valeur);
  const texteRenseigne = (valeur) => typeof valeur === 'string' && valeur.trim().length > 0;

  if (!estObjet(donnees)) {
    return { valide: false, erreurs: ["La réponse n'est pas un objet JSON."] };
  }

  if (!texteRenseigne(donnees.destination)) erreurs.push('destination manquante');
  if (!Array.isArray(donnees.sources)) erreurs.push('sources doit être un tableau');

  if (!Array.isArray(donnees.randos) || donnees.randos.length === 0) {
    erreurs.push('aucune randonnée renvoyée');
    return { valide: false, erreurs };
  }

  donnees.randos.forEach((rando, index) => {
    const position = index + 1;

    if (!estObjet(rando)) {
      erreurs.push(`randonnée ${position} invalide`);
      return;
    }

    for (const champ of ['nom', 'description', 'pointDepart', 'conseils']) {
      if (!texteRenseigne(rando[champ])) {
        erreurs.push(`randonnée ${position} : ${champ} manquant`);
      }
    }

    if (!NIVEAUX.includes(rando.niveau)) {
      erreurs.push(`randonnée ${position} : niveau invalide`);
    }

    // Les chiffres servent à filtrer et à comparer : une valeur absurde rend
    // la liste inutilisable.
    for (const champ of ['distanceKm', 'dureeHeures', 'deniveleM']) {
      if (typeof rando[champ] !== 'number' || rando[champ] < 0) {
        erreurs.push(`randonnée ${position} : ${champ} invalide`);
      }
    }

    if (typeof rando.boucle !== 'boolean') {
      erreurs.push(`randonnée ${position} : boucle invalide`);
    }
  });

  return { valide: erreurs.length === 0, erreurs };
}
