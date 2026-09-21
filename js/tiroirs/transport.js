/**
 * transport.js — tiroir 2 « Transport ».
 *
 * L'utilisateur choisit son mode de transport ; le tiroir propose les liens
 * correspondants, tous construits par js/liens.js (CLAUDE.md §3.4), et un
 * prix estimé facultatif qui affinera le budget.
 */

import { echapper, langue, t } from '../i18n.js';
import { chercherAeroport } from '../aeroports.js';
import { estPrerempli, lienReservation, nomPartenaire } from '../liens.js';
import { datesVoyage, modifierVoyage } from '../voyage.js';

/** Ce tiroir peut être passé (CLAUDE.md §7). */
export const PEUT_ETRE_PASSE = true;

/** Modes proposés, dans l'ordre d'affichage (CLAUDE.md §4). */
const MODES = [
  'avion',
  'train',
  'bateau',
  'voiture',
  'avion+voiture',
  'train+voiture',
  'bateau+voiture',
];

/** Partenaires par moyen de transport élémentaire. */
const PARTENAIRES_PAR_MOYEN = {
  avion: ['googleflights', 'skyscanner'],
  train: ['trainline', 'sncfconnect'],
  bateau: ['ferryhopper', 'directferries'],
  // « voiture » seul désigne la voiture personnelle : on propose un itinéraire.
  voiture: ['googlemaps', 'viamichelin'],
  // Le « +voiture » des combinés désigne une voiture de location sur place.
  location: ['discovercars', 'rentalcars'],
};

/**
 * Met en forme une date ISO selon la langue courante.
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
 * Traduit un mode en liste de blocs de liens.
 * @param {string} mode
 * @returns {Array<{ moyen: string, partenaires: string[] }>}
 */
function blocsPourMode(mode) {
  if (!mode) return [];

  const [principal, complement] = mode.split('+');
  const blocs = [{ moyen: principal, partenaires: PARTENAIRES_PAR_MOYEN[principal] ?? [] }];

  if (complement === 'voiture') {
    blocs.push({ moyen: 'location', partenaires: PARTENAIRES_PAR_MOYEN.location });
  }

  return blocs;
}

/**
 * Construit un bloc de liens pour un moyen de transport.
 * @param {{ moyen: string, partenaires: string[] }} bloc
 * @param {object} params paramètres normalisés pour liens.js
 * @returns {string}
 */
function blocLiens(bloc, params) {
  const liens = bloc.partenaires
    .map((partenaire) => {
      const url = lienReservation(partenaire, params);
      const mention = estPrerempli(partenaire, params)
        ? ''
        : `<span class="lien__mention">${echapper(t('transport.aSaisir'))}</span>`;

      return `
        <li>
          <a class="bouton bouton--lien" href="${echapper(url)}"
             target="_blank" rel="noopener noreferrer">
            ${echapper(nomPartenaire(partenaire))}
          </a>
          ${mention}
        </li>
      `;
    })
    .join('');

  return `
    <section class="carte">
      <h3>${echapper(t(`transport.bloc.${bloc.moyen}`))}</h3>
      <ul class="liens">${liens}</ul>
    </section>
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
  const { dateDebut, dateFin } = datesVoyage(voyage);

  const params = {
    destination: voyage?.destination ?? '',
    origine: voyage?.depart ?? '',
    dateDebut,
    dateFin,
    adultes: voyage?.voyageurs?.adultes,
    enfants: voyage?.voyageurs?.enfants,
  };

  // Les comparateurs de vols attendent des codes d'aéroport. La résolution
  // échoue silencieusement : les liens restent alors non préremplis.
  const [origine, destination] = await Promise.all([
    chercherAeroport(voyage?.depart),
    chercherAeroport(voyage?.destination),
  ]);

  params.iataOrigine = origine?.code ?? null;
  params.iataDestination = destination?.code ?? null;

  const rendre = () => {
    const mode = voyage.transport?.mode ?? null;

    const boutons = MODES.map(
      (valeur) => `
        <button class="bouton bouton--choix${valeur === mode ? ' bouton--choisi' : ''}"
                type="button" data-mode="${valeur}"
                aria-pressed="${valeur === mode}">
          ${echapper(t(`transport.mode.${valeur}`))}
        </button>
      `
    ).join('');

    const blocs = blocsPourMode(mode).map((bloc) => blocLiens(bloc, params)).join('');

    // Le rappel des critères évite d'avoir à revenir en arrière une fois sur
    // le site du partenaire, puisque la plupart n'acceptent pas de recherche
    // préremplie par URL.
    const rappel =
      mode && params.destination
        ? `<p class="note">${echapper(
            t('transport.rappel', {
              destination: params.destination,
              mois: dateDebut ? formaterDate(dateDebut) : t(`mois.${voyage.mois}`),
              jours: voyage.jours ?? '?',
              voyageurs: (params.adultes ?? 0) + (params.enfants ?? 0),
            })
          )}</p>`
        : '';

    // Quand un vol est concerné, on indique ce qui a été résolu, pour que
    // l'utilisateur comprenne pourquoi un lien est prérempli ou non.
    const concerneAvion = Boolean(mode?.startsWith('avion'));
    const aeroports =
      concerneAvion && (origine || destination)
        ? `<p class="note">${echapper(
            t('transport.aeroports', {
              origine: origine ? `${origine.ville} (${origine.code})` : t('transport.aeroportInconnu'),
              destination: destination
                ? `${destination.ville} (${destination.code})`
                : t('transport.aeroportInconnu'),
            })
          )}</p>`
        : '';

    const manqueDate = mode && !dateDebut
      ? `<p class="note">${echapper(t('transport.sansDate'))}</p>`
      : '';

    conteneur.innerHTML = `
      <section class="carte">
        <h2>${echapper(t('transport.titre'))}</h2>
        <p>${echapper(t('transport.question'))}</p>
        <div class="choix">${boutons}</div>
      </section>

      ${rappel}
      ${aeroports}
      ${manqueDate}
      ${blocs}

      <section class="carte">
        <div class="champ">
          <label for="transport-prix">${echapper(t('transport.prixEstime'))}</label>
          <input type="number" id="transport-prix" min="0" step="10"
                 value="${voyage.transport?.prixEstime ?? ''}">
          <p class="champ__aide">${echapper(t('transport.prixEstimeAide'))}</p>
        </div>
      </section>

      <button class="bouton bouton--principal" type="button" id="transport-suivant">
        ${echapper(t('commun.suivant'))}
      </button>
    `;

    conteneur.querySelectorAll('[data-mode]').forEach((bouton) => {
      bouton.addEventListener('click', () => {
        const choisi = bouton.dataset.mode;
        // Un second clic sur le mode déjà retenu l'annule.
        const nouveau = choisi === voyage.transport?.mode ? null : choisi;
        voyage.transport = { ...voyage.transport, mode: nouveau };
        modifierVoyage({ transport: { mode: nouveau } });
        rendre();
      });
    });

    conteneur.querySelector('#transport-prix').addEventListener('input', (evenement) => {
      const valeur = Number.parseFloat(evenement.target.value);
      const prixEstime = Number.isFinite(valeur) && valeur >= 0 ? valeur : null;
      voyage.transport = { ...voyage.transport, prixEstime };
      modifierVoyage({ transport: { prixEstime } });
    });

    conteneur.querySelector('#transport-suivant').addEventListener('click', actions.suivant);
  };

  rendre();
}
