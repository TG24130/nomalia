/**
 * budget-vue.js — tiroir 6 « Budget ».
 *
 * N'effectue aucun calcul : il lit le résultat de js/budget.js et l'affiche
 * (CLAUDE.md §3.3). Les hypothèses retenues sont toujours montrées, et le
 * caractère indicatif de l'estimation est rappelé.
 */

import { echapper, langue, t } from '../i18n.js';
import { POSTES, calculerBudget } from '../budget.js';
import { genererFiche } from '../api.js';
import { modifierVoyage } from '../voyage.js';

/** Dernier tiroir du parcours : il ne se passe pas, il se conclut. */
export const PEUT_ETRE_PASSE = false;

/** Niveaux affichés, du plus économique au plus confortable. */
const NIVEAUX = ['bas', 'moyen', 'haut'];

/**
 * Met en forme un montant.
 * @param {number} montant
 * @param {string} devise
 * @returns {string}
 */
function formaterMontant(montant, devise) {
  try {
    return new Intl.NumberFormat(langue(), {
      style: 'currency',
      currency: devise,
      maximumFractionDigits: 0,
    }).format(montant);
  } catch {
    return `${Math.round(montant)} ${devise}`;
  }
}

/**
 * Met en forme un nombre selon la langue courante.
 * @param {number} valeur
 * @returns {string}
 */
function formaterNombre(valeur) {
  try {
    return new Intl.NumberFormat(langue(), { maximumFractionDigits: 1 }).format(valeur);
  } catch {
    return String(valeur);
  }
}

/**
 * Affiche le tiroir.
 *
 * @param {HTMLElement} conteneur
 * @param {object} voyage
 * @param {object} actions navigation fournie par app.js
 */
export async function afficher(conteneur, voyage, actions) {
  conteneur.innerHTML = `<p class="chargement">${echapper(t('commun.chargement'))}</p>`;

  // La fiche fournit les prix moyens sur place. Elle est en cache si le
  // tiroir 1 a déjà été vu : l'appel est alors instantané et gratuit.
  let fiche = null;

  if (voyage?.destination && voyage?.mois) {
    try {
      const resultat = await genererFiche({
        destination: voyage.destination,
        mois: voyage.mois,
        langue: voyage.langue ?? 'fr',
        nationalite: voyage.nationalite ?? 'FR',
      });
      fiche = resultat.fiche;
    } catch (erreur) {
      // Sans fiche, le calcul se fait quand même : les postes qui en
      // dépendent sont simplement annoncés comme non estimés.
      console.warn('Fiche indisponible pour le budget', erreur);
    }
  }

  const budget = calculerBudget(voyage, fiche);

  // Le budget est enregistré pour être relu depuis l'écran d'accueil.
  modifierVoyage({ budget });

  const totaux = NIVEAUX.map(
    (niveau) => `
      <div class="total total--${niveau}">
        <span class="total__libelle">${echapper(t(`budget.${niveau}`))}</span>
        <span class="total__montant">${echapper(formaterMontant(budget[niveau], budget.devise))}</span>
      </div>
    `
  ).join('');

  const lignes = POSTES.filter((poste) =>
    NIVEAUX.some((niveau) => budget.detail[poste][niveau] > 0)
  )
    .map(
      (poste) => `
        <tr>
          <th scope="row">${echapper(t(`budget.detail.${poste}`))}</th>
          ${NIVEAUX.map(
            (niveau) =>
              `<td>${echapper(formaterMontant(budget.detail[poste][niveau], budget.devise))}</td>`
          ).join('')}
        </tr>
      `
    )
    .join('');

  const hypotheses = budget.hypotheses
    .map((hypothese) => {
      // budget.js renvoie des nombres bruts : la mise en forme décimale
      // dépend de la langue et se fait donc ici.
      const valeurs = Object.fromEntries(
        Object.entries(hypothese.valeurs ?? {}).map(([cle, valeur]) => [
          cle,
          typeof valeur === 'number' ? formaterNombre(valeur) : valeur,
        ])
      );

      return `<li>${echapper(t(`budget.hypothese.${hypothese.cle}`, valeurs))}</li>`;
    })
    .join('');

  const parPersonne =
    (voyage?.voyageurs?.adultes ?? 0) + (voyage?.voyageurs?.enfants ?? 0) > 1
      ? `<p class="note">${echapper(
          t('budget.parPersonne', {
            montant: formaterMontant(
              Math.round(
                budget.moyen / ((voyage.voyageurs.adultes ?? 0) + (voyage.voyageurs.enfants ?? 0))
              ),
              budget.devise
            ),
          })
        )}</p>`
      : '';

  conteneur.innerHTML = `
    <section class="carte">
      <h2>${echapper(t('budget.titre'))}</h2>
      <div class="totaux">${totaux}</div>
      ${parPersonne}
      <p class="note">${echapper(t('budget.mention'))}</p>
    </section>

    <section class="carte">
      <h3>${echapper(t('budget.detailTitre'))}</h3>
      <table class="tableau">
        <thead>
          <tr>
            <td></td>
            ${NIVEAUX.map((niveau) => `<th scope="col">${echapper(t(`budget.${niveau}`))}</th>`).join('')}
          </tr>
        </thead>
        <tbody>${lignes}</tbody>
      </table>
    </section>

    <details class="carte carte--sources">
      <summary>${echapper(t('budget.hypotheses'))}</summary>
      <ul>${hypotheses}</ul>
    </details>

    <button class="bouton bouton--principal" type="button" id="budget-terminer">
      ${echapper(t('budget.terminer'))}
    </button>
  `;

  conteneur.querySelector('#budget-terminer').addEventListener('click', actions.accueil);
}
