/**
 * hebergement.js — tiroir 3 « Hébergement ».
 *
 * L'utilisateur choisit un type de logement et ses critères, puis suit les
 * liens partenaires correspondants, tous construits par js/liens.js
 * (CLAUDE.md §3.4).
 *
 * Les critères ne sont transmis à aucun partenaire : aucun des sites vérifiés
 * n'accepte de filtres par URL. Ils servent à garder la préférence d'un
 * passage à l'autre et à rappeler quoi cocher une fois sur place.
 */

import { brancherChoix, grilleChoix } from '../cartes-choix.js';
import { echapper, langue, t } from '../i18n.js';
import { chercherAeroport } from '../aeroports.js';
import { estPrerempli, lienReservation, nomPartenaire } from '../liens.js';
import { datesVoyage, modifierVoyage } from '../voyage.js';

/** Ce tiroir peut être passé (CLAUDE.md §7). */
export const PEUT_ETRE_PASSE = true;

/** Types de logement (CLAUDE.md §4). */
const TYPES = [
  'hotel',
  'appartement',
  'gite',
  'chez-habitant',
  'camping',
  'camping-materiel-loue',
];

/**
 * Critères, groupés pour rester lisibles sur un écran de téléphone.
 *
 * Les dix premiers viennent du modèle de données ; les autres sont des
 * critères courants des sites de réservation, ajoutés pour que la liste soit
 * réellement utile au moment de filtrer.
 */
const GROUPES_FILTRES = [
  {
    cle: 'confort',
    filtres: ['piscine', 'climatisation', 'vue-mer', 'balcon-terrasse', 'spa'],
  },
  {
    cle: 'salle-de-bain',
    filtres: ['douche-italienne', 'baignoire-balneo', 'jacuzzi-privatif'],
  },
  {
    cle: 'services',
    filtres: [
      'petit-dejeuner',
      'wifi-gratuit',
      'parking',
      'borne-recharge',
      'restaurant',
      'navette-aeroport',
    ],
  },
  {
    cle: 'pratique',
    filtres: ['annulation-gratuite', 'animaux', 'cuisine', 'machine-a-laver', 'accessible'],
  },
  {
    cle: 'situation',
    filtres: ['centre-ville', 'proche-plage', 'au-calme'],
  },
  {
    cle: 'categorie',
    filtres: ['etoiles-3', 'etoiles-4', 'etoiles-5'],
  },
];

/** Critères pertinents selon le type de logement. */
const FILTRES_MASQUES = {
  'chez-habitant': ['etoiles-3', 'etoiles-4', 'etoiles-5', 'restaurant', 'navette-aeroport'],
  camping: ['etoiles-3', 'etoiles-4', 'etoiles-5', 'navette-aeroport'],
  'camping-materiel-loue': ['etoiles-3', 'etoiles-4', 'etoiles-5', 'navette-aeroport'],
  gite: ['etoiles-3', 'etoiles-4', 'etoiles-5', 'restaurant', 'navette-aeroport'],
  appartement: ['restaurant', 'navette-aeroport'],
};

/**
 * Partenaires proposés selon le type de logement (CLAUDE.md §6, tiroir 3).
 * `gitesdefrance` n'apparaît que pour une destination française.
 */
const PARTENAIRES_PAR_TYPE = {
  hotel: ['kayakhotels', 'booking', 'hotels'],
  appartement: ['airbnb', 'abritel', 'booking'],
  gite: ['abritel', 'gitesdefrance', 'booking'],
  'chez-habitant': ['airbnb'],
  camping: ['pitchup', 'booking'],
  'camping-materiel-loue': ['pitchup', 'booking'],
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
 * Affiche le tiroir.
 *
 * @param {HTMLElement} conteneur
 * @param {object} voyage
 * @param {object} actions navigation fournie par app.js
 */
export async function afficher(conteneur, voyage, actions) {
  const { dateDebut, dateFin } = datesVoyage(voyage);

  // En van, on dort dans le véhicule : les aires et campings sont le choix
  // naturel, et le budget compte déjà des nuitées d'aire (budget.js).
  if (voyage.transport?.mode === 'van' && !voyage.hebergement?.type) {
    voyage.hebergement = { ...voyage.hebergement, type: 'camping' };
    modifierVoyage({ hebergement: { type: 'camping' } });
  }

  const params = {
    destination: voyage?.destination ?? '',
    dateDebut,
    dateFin,
    adultes: voyage?.voyageurs?.adultes,
    enfants: voyage?.voyageurs?.enfants,
  };

  // Gîtes de France ne couvre que la France : on s'appuie sur le pays de
  // l'aéroport de destination, déjà résolu pour le transport.
  const aeroport = await chercherAeroport(voyage?.destination);
  const enFrance = aeroport?.pays === 'FR';

  const rendre = () => {
    const type = voyage.hebergement?.type ?? null;
    const retenus = new Set(voyage.hebergement?.filtres ?? []);

    // Le nom du type sert aussi de clé d'icône : hotel, gite, camping…
    const choixType = grilleChoix(
      TYPES.map((valeur) => ({
        valeur,
        libelle: t(`hebergement.type.${valeur}`),
        icones: [valeur],
      })),
      type
    );

    const masques = FILTRES_MASQUES[type] ?? [];

    const groupes = GROUPES_FILTRES.map((groupe) => {
      const cases = groupe.filtres
        .filter((filtre) => !masques.includes(filtre))
        .map(
          (filtre) => `
            <label class="case">
              <input type="checkbox" data-filtre="${filtre}"
                     ${retenus.has(filtre) ? 'checked' : ''}>
              <span>${echapper(t(`hebergement.filtre.${filtre}`))}</span>
            </label>
          `
        )
        .join('');

      if (!cases) return '';

      return `
        <fieldset class="groupe-filtres">
          <legend>${echapper(t(`hebergement.groupe.${groupe.cle}`))}</legend>
          ${cases}
        </fieldset>
      `;
    }).join('');

    const partenaires = (PARTENAIRES_PAR_TYPE[type] ?? []).filter(
      (partenaire) => partenaire !== 'gitesdefrance' || enFrance
    );

    const liens = partenaires
      .map((partenaire) => {
        const url = lienReservation(partenaire, { ...params, filtres: [...retenus] });
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

    // Les critères cochés ne partent pas chez le partenaire : on les rappelle
    // pour qu'il n'y ait plus qu'à les recocher sur place.
    const rappelFiltres = retenus.size
      ? `<p class="note">${echapper(
          t('hebergement.rappelFiltres', {
            filtres: [...retenus].map((filtre) => t(`hebergement.filtre.${filtre}`)).join(', '),
          })
        )}</p>`
      : '';

    const rappelSejour =
      type && params.destination
        ? `<p class="note">${echapper(
            t('hebergement.rappelSejour', {
              destination: params.destination,
              dates: dateDebut
                ? `${formaterDate(dateDebut)} — ${formaterDate(dateFin)}`
                : t(`mois.${voyage.mois}`),
              nuits: voyage.jours ?? '?',
              voyageurs: (params.adultes ?? 0) + (params.enfants ?? 0),
            })
          )}</p>`
        : '';

    conteneur.innerHTML = `
      <section class="carte">
        <h2>${echapper(t('hebergement.titre'))}</h2>
        <p>${echapper(t('hebergement.question'))}</p>
        ${choixType}
      </section>

      ${
        type
          ? `<section class="carte">
               <h3>${echapper(t('hebergement.filtres'))}</h3>
               ${groupes}
             </section>`
          : ''
      }

      ${rappelSejour}
      ${rappelFiltres}

      ${
        liens
          ? `<section class="carte">
               <h3>${echapper(t('hebergement.chercher'))}</h3>
               <ul class="liens">${liens}</ul>
             </section>`
          : ''
      }

      <section class="carte">
        <div class="champ">
          <label for="hebergement-prix">${echapper(t('hebergement.prixNuit'))}</label>
          <input type="number" id="hebergement-prix" min="0" step="5"
                 value="${voyage.hebergement?.prixNuit ?? ''}">
          <p class="champ__aide">${echapper(t('hebergement.prixNuitAide'))}</p>
        </div>
      </section>

      <button class="bouton bouton--principal" type="button" id="hebergement-suivant">
        ${echapper(t('commun.suivant'))}
      </button>
    `;

    brancherChoix(conteneur, type, (nouveau) => {
      voyage.hebergement = { ...voyage.hebergement, type: nouveau };
      modifierVoyage({ hebergement: { type: nouveau } });
      rendre();
    });

    conteneur.querySelectorAll('[data-filtre]').forEach((caseACocher) => {
      caseACocher.addEventListener('change', () => {
        const filtre = caseACocher.dataset.filtre;
        const filtres = new Set(voyage.hebergement?.filtres ?? []);

        if (caseACocher.checked) filtres.add(filtre);
        else filtres.delete(filtre);

        const liste = [...filtres];
        voyage.hebergement = { ...voyage.hebergement, filtres: liste };
        modifierVoyage({ hebergement: { filtres: liste } });
        rendre();
      });
    });

    conteneur.querySelector('#hebergement-prix').addEventListener('input', (evenement) => {
      const valeur = Number.parseFloat(evenement.target.value);
      const prixNuit = Number.isFinite(valeur) && valeur >= 0 ? valeur : null;
      voyage.hebergement = { ...voyage.hebergement, prixNuit };
      modifierVoyage({ hebergement: { prixNuit } });
    });

    conteneur.querySelector('#hebergement-suivant').addEventListener('click', actions.suivant);
  };

  rendre();
}
