/**
 * recapitulatif.js — écran de fin de parcours.
 *
 * Une fois le budget calculé, l'application renvoyait l'utilisateur à la liste
 * de ses voyages sans rien lui montrer de ce qu'il venait de construire. Cet
 * écran ferme le parcours : il rassemble les choix faits, donne le budget, et
 * permet de revenir sur n'importe quelle étape.
 *
 * Il ne lit que l'objet voyage et ne l'écrit jamais.
 */

import { echapper, langue, t } from './i18n.js';
import { icone } from './icones.js';
import { ETAPES, datesVoyage } from './voyage.js';

/**
 * Accorde un libellé en nombre.
 *
 * Le français met au pluriel à partir de deux ; d'autres langues comptent
 * autrement, d'où le choix de deux clés distinctes plutôt qu'un « s » ajouté
 * par le code. La clé de base porte le singulier, suffixée « _pluriel » le
 * reste.
 *
 * @param {string} cle
 * @param {number} nombre
 * @returns {string}
 */
function accorder(cle, nombre) {
  return t(nombre >= 2 ? `${cle}_pluriel` : cle, { nombre });
}

/**
 * Met en forme une date ISO.
 * @param {string} date AAAA-MM-JJ
 * @returns {string}
 */
function formaterDate(date) {
  try {
    return new Intl.DateTimeFormat(langue(), { dateStyle: 'long' }).format(
      new Date(`${date}T12:00:00Z`)
    );
  } catch {
    return date;
  }
}

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
      currency: devise || 'EUR',
      maximumFractionDigits: 0,
    }).format(montant);
  } catch {
    return `${Math.round(montant)} ${devise ?? ''}`.trim();
  }
}

/**
 * Résume chaque étape en une ligne : son libellé, et ce qui y a été choisi.
 *
 * Une étape laissée de côté n'est pas masquée — elle est marquée à compléter,
 * pour que le retour en arrière reste proposé plutôt que caché.
 *
 * @param {object} voyage
 * @returns {Array<{ etape: string, valeur: string|null }>}
 */
function lignes(voyage) {
  const mode = voyage.transport?.mode;
  const type = voyage.hebergement?.type;
  const sejour = voyage.tourisme?.type;

  const filtres = voyage.hebergement?.filtres?.length ?? 0;
  const lieux = voyage.tourisme?.lieuxRetenus?.length ?? 0;
  const retenues = voyage.randos?.retenues?.length ?? 0;
  const niveau = voyage.randos?.niveau;

  return [
    {
      etape: 'transport',
      valeur: mode ? t(`transport.mode.${mode}`) : null,
    },
    {
      etape: 'hebergement',
      valeur: type
        ? [
            t(`hebergement.type.${type}`),
            filtres ? accorder('fin.criteres', filtres) : null,
          ]
            .filter(Boolean)
            .join(' · ')
        : null,
    },
    {
      etape: 'tourisme',
      valeur: sejour
        ? [
            t(`tourisme.type.${sejour}`),
            lieux ? accorder('fin.lieux', lieux) : null,
          ]
            .filter(Boolean)
            .join(' · ')
        : null,
    },
    {
      etape: 'randos',
      valeur: niveau
        ? [
            t(`randos.niveaux.${niveau}`),
            retenues ? accorder('fin.randos', retenues) : null,
          ]
            .filter(Boolean)
            .join(' · ')
        : null,
    },
  ];
}

/**
 * Affiche l'écran de fin.
 *
 * @param {HTMLElement} conteneur
 * @param {object} voyage
 * @param {{ allerA: (position: number) => void, accueil: () => void }} actions
 */
export function afficherRecapitulatif(conteneur, voyage, actions) {
  const { dateDebut } = datesVoyage(voyage);
  const voyageurs = (voyage.voyageurs?.adultes ?? 0) + (voyage.voyageurs?.enfants ?? 0);

  // Le mois seul suffit quand la date de départ n'a pas été renseignée.
  const quand = dateDebut
    ? formaterDate(dateDebut)
    : voyage.mois
      ? t(`mois.${voyage.mois}`)
      : null;

  const resume = [
    quand,
    voyage.jours ? accorder('fin.jours', voyage.jours) : null,
    voyageurs ? accorder('fin.voyageurs', voyageurs) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const budget = voyage.budget;

  const blocBudget = budget
    ? `
      <section class="carte fin__budget">
        <p class="fin__budget-libelle">${echapper(t('fin.budget'))}</p>
        <p class="fin__budget-montant">
          ${echapper(formaterMontant(budget.moyen, budget.devise))}
        </p>
        <p class="note">${echapper(
          t('fin.budgetFourchette', {
            bas: formaterMontant(budget.bas, budget.devise),
            haut: formaterMontant(budget.haut, budget.devise),
          })
        )}</p>
      </section>
    `
    : '';

  const recap = lignes(voyage)
    .map(({ etape, valeur }) => {
      const position = ETAPES.indexOf(etape);
      const manquant = valeur === null;

      return `
        <li>
          <button class="recap__ligne${manquant ? ' recap__ligne--vide' : ''}"
                  type="button" data-position="${position}">
            <span class="recap__icone">${icone(etape, { taille: 22 })}</span>
            <span class="recap__texte">
              <span class="recap__etape">${echapper(t(`parcours.${etape}`))}</span>
              <span class="recap__valeur">${echapper(valeur ?? t('fin.aCompleter'))}</span>
            </span>
            <span class="recap__modifier">${echapper(t('fin.modifier'))}</span>
          </button>
        </li>
      `;
    })
    .join('');

  conteneur.innerHTML = `
    <section class="fin">
      <span class="fin__sceau">${icone('coche', { taille: 30 })}</span>
      <h2 class="fin__titre">${echapper(t('fin.titre'))}</h2>
      <p class="fin__destination">${echapper(voyage.destination ?? '')}</p>
      <p class="fin__resume">${echapper(resume)}</p>
    </section>

    ${blocBudget}

    <ul class="recap">${recap}</ul>

    <button class="bouton bouton--principal" type="button" id="fin-accueil">
      ${echapper(t('fin.retour'))}
    </button>
  `;

  conteneur.querySelectorAll('[data-position]').forEach((bouton) => {
    bouton.addEventListener('click', () => {
      actions.allerA(Number(bouton.dataset.position));
    });
  });

  conteneur.querySelector('#fin-accueil').addEventListener('click', actions.accueil);
}
