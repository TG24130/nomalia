/**
 * schemas/fiche.js — schéma de la fiche destination en 10 points.
 *
 * Deux usages :
 *  - SCHEMA_FICHE contraint la sortie du modèle (output_config.format) ;
 *  - validerFiche() revérifie côté serveur avant d'écrire en cache et de
 *    renvoyer au front (CLAUDE.md §3.7). Ne jamais faire confiance à la seule
 *    contrainte du modèle.
 */

/** Un résumé textuel, présent dans presque tous les points. */
const resume = { type: 'string' };

/** Trio de prix économique / moyen / confort. */
const trioPrix = {
  type: 'object',
  properties: {
    eco: { type: 'number' },
    moyen: { type: 'number' },
    confort: { type: 'number' },
  },
  required: ['eco', 'moyen', 'confort'],
  additionalProperties: false,
};

/** Schéma JSON strict de la fiche (CLAUDE.md §6, tiroir 1). */
export const SCHEMA_FICHE = {
  type: 'object',
  properties: {
    destination: { type: 'string' },
    codePays: { type: 'string' },
    points: {
      type: 'object',
      properties: {
        visa: {
          type: 'object',
          properties: { resume, lienOfficiel: { type: 'string' } },
          required: ['resume', 'lienOfficiel'],
          additionalProperties: false,
        },
        climat: {
          type: 'object',
          properties: { resume },
          required: ['resume'],
          additionalProperties: false,
        },
        meilleuresPeriodes: {
          type: 'object',
          properties: {
            mois: { type: 'array', items: { type: 'integer' } },
            resume,
          },
          required: ['mois', 'resume'],
          additionalProperties: false,
        },
        decalageHoraire: {
          type: 'object',
          properties: { heures: { type: 'number' }, resume },
          required: ['heures', 'resume'],
          additionalProperties: false,
        },
        monnaie: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            nom: { type: 'string' },
            resume,
          },
          required: ['code', 'nom', 'resume'],
          additionalProperties: false,
        },
        langue: {
          type: 'object',
          properties: { resume },
          required: ['resume'],
          additionalProperties: false,
        },
        prises: {
          type: 'object',
          properties: {
            types: { type: 'array', items: { type: 'string' } },
            tension: { type: 'string' },
            adaptateur: { type: 'boolean' },
          },
          required: ['types', 'tension', 'adaptateur'],
          additionalProperties: false,
        },
        vaccins: {
          type: 'object',
          properties: {
            obligatoires: { type: 'array', items: { type: 'string' } },
            recommandes: { type: 'array', items: { type: 'string' } },
            resume,
          },
          required: ['obligatoires', 'recommandes', 'resume'],
          additionalProperties: false,
        },
        budgetMoyen: {
          type: 'object',
          properties: {
            hotelNuit: trioPrix,
            repasJour: trioPrix,
            // Contraint par le schéma plutôt que par la seule consigne : le
            // modèle ne peut alors pas renvoyer la monnaie locale, que
            // l'application additionnerait avec des euros.
            devise: { type: 'string', enum: ['EUR'] },
            resume,
          },
          required: ['hotelNuit', 'repasJour', 'devise', 'resume'],
          additionalProperties: false,
        },
        temperatureMer: {
          type: 'object',
          properties: {
            // Le nom du champ vient du modèle de données ; il désigne bien une
            // température, pas un numéro de mois. La description est là pour
            // lever cette ambiguïté auprès du modèle.
            moisChoisi: {
              type: ['number', 'null'],
              description:
                'Température de la mer en degrés Celsius pendant le mois du voyage. Jamais un numéro de mois. null si la destination n\'a pas de littoral.',
            },
            parMois: {
              type: ['array', 'null'],
              items: { type: 'number' },
              description:
                'Douze températures moyennes de la mer en degrés Celsius, de janvier à décembre. null si la destination n\'a pas de littoral.',
            },
            resume,
          },
          required: ['moisChoisi', 'parMois', 'resume'],
          additionalProperties: false,
        },
      },
      required: [
        'visa',
        'climat',
        'meilleuresPeriodes',
        'decalageHoraire',
        'monnaie',
        'langue',
        'prises',
        'vaccins',
        'budgetMoyen',
        'temperatureMer',
      ],
      additionalProperties: false,
    },
    sources: { type: 'array', items: { type: 'string' } },
  },
  required: ['destination', 'codePays', 'points', 'sources'],
  additionalProperties: false,
};

/** Les dix points attendus, dans l'ordre d'affichage. */
export const POINTS_ATTENDUS = SCHEMA_FICHE.properties.points.required;

/**
 * Vérifie qu'une fiche est exploitable par le front.
 *
 * Contrôle la présence et le type des champs dont l'affichage dépend ;
 * volontairement plus souple que le schéma sur les champs décoratifs, pour ne
 * pas rejeter une fiche utilisable à cause d'un détail.
 *
 * @param {unknown} fiche
 * @returns {{ valide: boolean, erreurs: string[] }}
 */
export function validerFiche(fiche) {
  const erreurs = [];

  const estObjet = (valeur) => valeur !== null && typeof valeur === 'object' && !Array.isArray(valeur);
  const texteRenseigne = (valeur) => typeof valeur === 'string' && valeur.trim().length > 0;

  if (!estObjet(fiche)) {
    return { valide: false, erreurs: ['La réponse n\'est pas un objet JSON.'] };
  }

  if (!texteRenseigne(fiche.destination)) erreurs.push('destination manquante');
  if (!texteRenseigne(fiche.codePays)) erreurs.push('codePays manquant');
  if (!Array.isArray(fiche.sources)) erreurs.push('sources doit être un tableau');

  if (!estObjet(fiche.points)) {
    erreurs.push('points manquant');
    return { valide: false, erreurs };
  }

  for (const point of POINTS_ATTENDUS) {
    if (!estObjet(fiche.points[point])) {
      erreurs.push(`point « ${point} » manquant`);
    }
  }

  // Contrôles ciblés sur les champs réellement consommés par l'affichage
  // et par le calcul du budget.
  const points = fiche.points;

  if (estObjet(points.meilleuresPeriodes) && !Array.isArray(points.meilleuresPeriodes.mois)) {
    erreurs.push('meilleuresPeriodes.mois doit être un tableau');
  }

  if (estObjet(points.prises) && !Array.isArray(points.prises.types)) {
    erreurs.push('prises.types doit être un tableau');
  }

  if (estObjet(points.vaccins)) {
    if (!Array.isArray(points.vaccins.obligatoires)) erreurs.push('vaccins.obligatoires doit être un tableau');
    if (!Array.isArray(points.vaccins.recommandes)) erreurs.push('vaccins.recommandes doit être un tableau');
  }

  if (estObjet(points.budgetMoyen)) {
    for (const poste of ['hotelNuit', 'repasJour']) {
      const valeurs = points.budgetMoyen[poste];
      if (!estObjet(valeurs)) {
        erreurs.push(`budgetMoyen.${poste} manquant`);
        continue;
      }
      for (const niveau of ['eco', 'moyen', 'confort']) {
        if (typeof valeurs[niveau] !== 'number') {
          erreurs.push(`budgetMoyen.${poste}.${niveau} doit être un nombre`);
        }
      }
    }
  }

  return { valide: erreurs.length === 0, erreurs };
}
