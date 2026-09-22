/**
 * fiche.js — tiroir 1 « Fiche pratique ».
 *
 * Affiche les dix points de la fiche destination sous forme de cartes
 * dépliables, avec les avertissements obligatoires sur les formalités et la
 * santé (CLAUDE.md §6, tiroir 1).
 *
 * Aucun lien de réservation ici : les liens proposés par l'IA sont des sites
 * officiels, toujours signalés comme étant à vérifier (CLAUDE.md §3.6).
 */

import { attente } from '../attente.js';
import { echapper, langue, libelles, t } from '../i18n.js';
import { genererFiche } from '../api.js';
import { modifierVoyage } from '../voyage.js';

/** La fiche peut être passée : elle n'est qu'informative. */
export const PEUT_ETRE_PASSE = true;

/** Ordre d'affichage des points. */
const POINTS = [
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
];

/**
 * Met en forme un montant dans la devise de la destination.
 * @param {number} montant
 * @param {string} devise code ISO
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
    // Devise inconnue d'Intl : on affiche le code tel quel.
    return `${Math.round(montant)} ${devise}`;
  }
}

/**
 * Abrège un mois pour la grille des températures.
 *
 * Couper le libellé à trois lettres donnerait « Jui » pour juin comme pour
 * juillet : on laisse la locale produire l'abréviation d'usage.
 *
 * @param {number} mois 1 à 12
 * @returns {string}
 */
function moisAbrege(mois) {
  try {
    return new Intl.DateTimeFormat(langue(), { month: 'short' }).format(new Date(2026, mois - 1, 1));
  } catch {
    return t(`mois.${mois}`).slice(0, 4);
  }
}

/**
 * Valeur courte affichée à droite du titre, carte repliée.
 * @param {string} nom
 * @param {object} point
 * @param {object} fiche
 * @returns {string}
 */
function apercu(nom, point, fiche) {
  switch (nom) {
    case 'meilleuresPeriodes':
      return point.mois.map((mois) => t(`mois.${mois}`)).join(', ');

    case 'decalageHoraire':
      return point.heures === 0
        ? t('fiche.decalageAucun')
        : t('fiche.decalageHeures', { heures: point.heures > 0 ? `+${point.heures}` : point.heures });

    case 'monnaie':
      return point.code;

    case 'prises':
      return `${point.types.join(' / ')} · ${point.tension}`;

    case 'vaccins':
      return point.obligatoires.length
        ? t('fiche.vaccinsObligatoiresNombre', { nombre: point.obligatoires.length })
        : t('fiche.vaccinsAucunObligatoire');

    case 'budgetMoyen':
      return t('fiche.parNuit', {
        montant: formaterMontant(point.hotelNuit.moyen, point.devise),
      });

    case 'temperatureMer':
      return point.moisChoisi === null ? '' : `${Math.round(point.moisChoisi)} °C`;

    default:
      return '';
  }
}

/** Liste à puces, ou un tiret si la liste est vide. */
function liste(valeurs) {
  if (!valeurs.length) return `<p>${echapper(t('fiche.aucun'))}</p>`;
  return `<ul>${valeurs.map((valeur) => `<li>${echapper(valeur)}</li>`).join('')}</ul>`;
}

/**
 * Contenu déplié d'un point.
 * @param {string} nom
 * @param {object} point
 * @param {object} fiche
 * @param {number} moisVoyage
 * @returns {string}
 */
function contenu(nom, point, fiche, moisVoyage) {
  const morceaux = [];

  if (point.resume) morceaux.push(`<p>${echapper(point.resume)}</p>`);

  switch (nom) {
    case 'visa':
      if (point.lienOfficiel) {
        morceaux.push(`
          <p><a href="${echapper(point.lienOfficiel)}" target="_blank" rel="noopener noreferrer">
            ${echapper(t('fiche.lienFranceDiplomatie'))}</a>
            <span class="a-verifier">${echapper(t('commun.aVerifier'))}</span></p>
        `);
      }
      morceaux.push(`<p class="avertissement">${echapper(t('fiche.avertissementVisa'))}</p>`);
      break;

    case 'prises':
      morceaux.push(`
        <p>${echapper(
          point.adaptateur ? t('fiche.adaptateurOui') : t('fiche.adaptateurNon')
        )}</p>
      `);
      break;

    case 'vaccins':
      morceaux.push(`<h4>${echapper(t('fiche.vaccinsObligatoires'))}</h4>${liste(point.obligatoires)}`);
      morceaux.push(`<h4>${echapper(t('fiche.vaccinsRecommandes'))}</h4>${liste(point.recommandes)}`);
      morceaux.push(`<p class="avertissement">${echapper(t('fiche.avertissementVaccins'))}</p>`);
      break;

    case 'budgetMoyen': {
      const ligne = (cle, valeurs) => `
        <tr>
          <th scope="row">${echapper(t(`fiche.${cle}`))}</th>
          <td>${echapper(formaterMontant(valeurs.eco, point.devise))}</td>
          <td>${echapper(formaterMontant(valeurs.moyen, point.devise))}</td>
          <td>${echapper(formaterMontant(valeurs.confort, point.devise))}</td>
        </tr>`;

      morceaux.push(`
        <table class="tableau">
          <thead>
            <tr>
              <td></td>
              <th scope="col">${echapper(t('budget.bas'))}</th>
              <th scope="col">${echapper(t('budget.moyen'))}</th>
              <th scope="col">${echapper(t('budget.haut'))}</th>
            </tr>
          </thead>
          <tbody>
            ${ligne('hotelNuit', point.hotelNuit)}
            ${ligne('repasJour', point.repasJour)}
          </tbody>
        </table>
        <p class="note">${echapper(t('fiche.budgetParPersonne'))}</p>
      `);
      break;
    }

    case 'temperatureMer':
      if (Array.isArray(point.parMois) && point.parMois.length === 12) {
        const cellules = point.parMois
          .map(
            (temperature, index) => `
              <div class="mer__mois${index + 1 === moisVoyage ? ' mer__mois--choisi' : ''}">
                <span class="mer__libelle">${echapper(moisAbrege(index + 1))}</span>
                <span class="mer__valeur">${Math.round(temperature)}°</span>
              </div>`
          )
          .join('');
        morceaux.push(`<div class="mer">${cellules}</div>`);
      }
      break;

    default:
      break;
  }

  return morceaux.join('');
}

/**
 * Construit une carte dépliable.
 * @param {string} nom
 * @param {object} fiche
 * @param {number} moisVoyage
 * @returns {string}
 */
function carte(nom, fiche, moisVoyage) {
  const point = fiche.points[nom];
  if (!point) return '';

  const valeur = apercu(nom, point, fiche);

  return `
    <details class="carte carte--point">
      <summary class="point__entete">
        <span class="point__titre">${echapper(t(`fiche.${nom}`))}</span>
        ${valeur ? `<span class="point__apercu">${echapper(valeur)}</span>` : ''}
      </summary>
      <div class="point__contenu">${contenu(nom, point, fiche, moisVoyage)}</div>
    </details>
  `;
}

/**
 * Affiche le tiroir.
 *
 * @param {HTMLElement} conteneur
 * @param {object} voyage
 * @param {object} actions navigation fournie par app.js
 */
export async function afficher(conteneur, voyage, actions) {
  if (!voyage?.destination || !voyage?.mois) {
    conteneur.innerHTML = `
      <section class="carte">
        <p>${echapper(t('erreurs.parametres'))}</p>
      </section>
    `;
    return;
  }

  conteneur.innerHTML = `
    <section class="carte">
      <h2>${echapper(t('fiche.titre'))}</h2>
      ${attente(libelles('attente.fiche'), 4)}
    </section>
  `;

  let resultat;
  try {
    resultat = await genererFiche({
      destination: voyage.destination,
      mois: voyage.mois,
      langue: voyage.langue ?? 'fr',
      nationalite: voyage.nationalite ?? 'FR',
    });
  } catch (erreur) {
    conteneur.innerHTML = `
      <section class="carte">
        <h2>${echapper(t('fiche.titre'))}</h2>
        <p class="avertissement">${echapper(t(erreur.cleLibelle ?? 'erreurs.ia'))}</p>
        <button class="bouton bouton--principal" type="button" id="fiche-reessayer">
          ${echapper(t('commun.reessayer'))}
        </button>
      </section>
    `;
    conteneur.querySelector('#fiche-reessayer').addEventListener('click', () => {
      afficher(conteneur, voyage, actions);
    });
    return;
  }

  // La fiche est rattachée au voyage pour le calcul du budget (étape 11).
  if (resultat.ficheId !== voyage.ficheId) {
    modifierVoyage({ ficheId: resultat.ficheId });
  }

  const fiche = resultat.fiche;
  const cartes = POINTS.map((nom) => carte(nom, fiche, voyage.mois)).join('');

  // L'alerte sur la saison est affichée avant les cartes : repliée dans la
  // carte « Meilleures périodes », elle serait passée inaperçue.
  const moisFavorables = fiche.points.meilleuresPeriodes?.mois ?? [];
  const alerteSaison = moisFavorables.length && !moisFavorables.includes(voyage.mois)
    ? `<p class="avertissement avertissement--saison">${echapper(
        t('fiche.alerteMoisDetail', {
          mois: t(`mois.${voyage.mois}`),
          favorables: moisFavorables.map((mois) => t(`mois.${mois}`)).join(', '),
        })
      )}</p>`
    : '';

  conteneur.innerHTML = `
    <h2>${echapper(t('fiche.titre'))}</h2>
    <p class="note">${echapper(fiche.destination)}</p>
    ${alerteSaison}
    ${cartes}
    ${
      fiche.sources.length
        ? `<details class="carte carte--sources">
             <summary>${echapper(t('fiche.sources'))}</summary>
             <ul>${fiche.sources
               .map(
                 (source) =>
                   `<li><a href="${echapper(source)}" target="_blank" rel="noopener noreferrer">${echapper(
                     source
                   )}</a></li>`
               )
               .join('')}</ul>
           </details>`
        : ''
    }
    <button class="bouton bouton--principal" type="button" id="fiche-suivant">
      ${echapper(t('commun.suivant'))}
    </button>
  `;

  conteneur.querySelector('#fiche-suivant').addEventListener('click', actions.suivant);
}
