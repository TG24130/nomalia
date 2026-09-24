/**
 * traduction.js — passage d'une réponse française dans une autre langue.
 *
 * Les générations avec recherche web se font toujours en français, puis se
 * traduisent. Mesuré le 24/09/2026 : générées directement en espagnol, plus
 * d'une liste de lieux sur deux revenait vide, et les dénivelés des
 * randonnées sortaient faux (« 1.250 m » lu 1,25). En français, rien de tel.
 * La version française, mise en cache, sert en outre aux trois langues.
 */

import { demanderJson } from './claude.js';
import { SYSTEME_TRADUCTION, promptTraduction } from './prompts/traduction.js';

/** Langue dans laquelle se font les générations avec recherche web. */
export const LANGUE_GENERATION = 'fr';

/**
 * Reporte les textes traduits sur l'original, en ne gardant de la
 * traduction que ce qui doit changer.
 *
 * Tout ce qui n'est pas du texte libre reste celui de l'original : nombres,
 * booléens, valeurs d'énumération du schéma (niveaux, devises…) et adresses
 * web. Une traduction qui aurait perdu un élément ne fait pas perdre le
 * texte français correspondant.
 *
 * @param {unknown} original
 * @param {unknown} traduit
 * @param {object} [schema] nœud du schéma JSON correspondant
 * @returns {unknown}
 */
export function fusionnerTraduction(original, traduit, schema) {
  if (typeof original === 'string') {
    const aGarder =
      schema?.enum || /^https?:\/\//.test(original) || typeof traduit !== 'string' || !traduit.trim();
    return aGarder ? original : traduit;
  }

  if (Array.isArray(original)) {
    return original.map((element, index) =>
      fusionnerTraduction(element, Array.isArray(traduit) ? traduit[index] : undefined, schema?.items)
    );
  }

  if (original !== null && typeof original === 'object') {
    return Object.fromEntries(
      Object.entries(original).map(([cle, valeur]) => [
        cle,
        fusionnerTraduction(valeur, traduit?.[cle], schema?.properties?.[cle]),
      ])
    );
  }

  return original;
}

/**
 * Part des textes à traduire qui l'ont effectivement été.
 *
 * Il arrive que le modèle renvoie une structure aux valeurs vides : la fusion
 * reprendrait alors le français partout, sans que rien ne le signale. Un
 * texte identique à l'original compte aussi comme non traduit ; un nom
 * propre qui ne change pas ne suffit pas à faire tomber la moyenne.
 *
 * @param {unknown} original
 * @param {unknown} traduit
 * @param {object} [schema]
 * @returns {number} entre 0 et 1
 */
export function proportionTraduite(original, traduit, schema) {
  let aTraduire = 0;
  let traduits = 0;

  const parcourir = (source, cible, noeud) => {
    if (typeof source === 'string') {
      if (noeud?.enum || /^https?:\/\//.test(source) || source.trim().length < 12) return;
      aTraduire += 1;
      if (typeof cible === 'string' && cible.trim() && cible.trim() !== source.trim()) traduits += 1;
    } else if (Array.isArray(source)) {
      source.forEach((element, index) =>
        parcourir(element, Array.isArray(cible) ? cible[index] : undefined, noeud?.items)
      );
    } else if (source !== null && typeof source === 'object') {
      for (const [cle, valeur] of Object.entries(source)) {
        parcourir(valeur, cible?.[cle], noeud?.properties?.[cle]);
      }
    }
  };

  parcourir(original, traduit, schema);
  return aTraduire === 0 ? 1 : traduits / aTraduire;
}

/** En deçà, la traduction est rejetée et redemandée. */
const PROPORTION_MINIMALE = 0.8;

/**
 * Traduit une réponse générée en français.
 *
 * @param {object} options
 * @param {object} options.donnees réponse en français, déjà validée
 * @param {object} options.schema schéma JSON de cette réponse
 * @param {(donnees: object) => { valide: boolean, erreurs: string[] }} options.valider
 * @param {string} options.langue langue visée
 * @param {object} [options.journal] informations ajoutées aux traces
 * @returns {Promise<object>} la réponse traduite
 */
export async function traduire({ donnees, schema, valider, langue, journal = {} }) {
  const traduit = await demanderJson({
    systeme: SYSTEME_TRADUCTION,
    prompt: promptTraduction(donnees, langue),
    schema,
    // On valide ce qui sera réellement renvoyé, la fusion avec l'original,
    // et on vérifie que les textes ont bien changé de langue.
    valider: (reponse) => {
      const controle = valider(fusionnerTraduction(donnees, reponse, schema));
      const proportion = proportionTraduite(donnees, reponse, schema);
      if (proportion >= PROPORTION_MINIMALE) return controle;
      return {
        valide: false,
        erreurs: [...controle.erreurs, `traduction incomplète (${Math.round(proportion * 100)} %)`],
      };
    },
    effort: 'low',
    maxRecherches: 0,
    journal: { ...journal, traduction: langue },
  });

  return fusionnerTraduction(donnees, traduit, schema);
}
