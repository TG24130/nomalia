/**
 * attente.js — état d'attente des générations par l'IA.
 *
 * Ces appels durent de trente secondes à deux minutes. Une ligne « Chargement… »
 * immobile pendant tout ce temps laisse croire que l'application est bloquée.
 * On montre donc à la place la forme de ce qui arrive, et ce qui est en train
 * d'être cherché.
 *
 * Tout est animé en CSS : aucun minuteur JavaScript à arrêter, donc rien à
 * fuir quand un tiroir se redessine.
 */

import { echapper } from './i18n.js';

/** Nombre de messages attendu par le cycle défini dans la feuille de style. */
const NOMBRE_MESSAGES = 4;

/**
 * Construit le balisage d'une attente.
 *
 * @param {string[]} messages quatre phrases décrivant ce qui est cherché,
 *   affichées à tour de rôle ; les suivantes sont ignorées, les manquantes
 *   complétées par répétition.
 * @param {number} [fantomes] nombre de cartes grisées annonçant le résultat
 * @returns {string} balisage HTML
 */
export function attente(messages, fantomes = 3) {
  const cycle = Array.from(
    { length: NOMBRE_MESSAGES },
    (_, index) => messages[index % messages.length] ?? ''
  );

  // Chaque message occupe un quart du cycle ; le décalage est porté par le
  // style en ligne, la feuille de style ne connaissant pas leur nombre.
  const defilement = cycle
    .map(
      (message, index) => `
        <span class="attente__message" style="animation-delay: ${index * 4}s">
          ${echapper(message)}
        </span>`
    )
    .join('');

  const cartes = Array.from(
    { length: fantomes },
    () => '<div class="attente__fantome" aria-hidden="true"></div>'
  ).join('');

  // Un seul message est lu à voix haute : les suivants ne sont qu'une
  // reformulation de la même attente.
  return `
    <div class="attente" role="status" aria-live="polite">
      <div class="attente__barre" aria-hidden="true"><span></span></div>
      <p class="attente__defilement">
        <span class="invisible">${echapper(cycle[0])}</span>
        <span aria-hidden="true">${defilement}</span>
      </p>
      ${cartes}
    </div>
  `;
}
