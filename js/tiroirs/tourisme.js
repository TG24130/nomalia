/**
 * tourisme.js — tiroir 4 « Type de séjour ».
 *
 * Types de séjour (CLAUDE.md §6, tiroir 4) :
 *  - repos total : conseils courts, aucun appel à l'IA ;
 *  - tous les autres : cinq lieux proposés par l'IA, avec prix d'entrée
 *    et liens d'activités.
 *
 * Les lieux cochés sont conservés dans `tourisme.lieuxRetenus` avec leur prix,
 * qui servira au calcul du budget.
 *
 * Le safari ajoute un bloc « Safari organisé » : sa durée, ce qu'il comprend
 * et son prix, conservés dans `tourisme.safari`, et les liens vers les
 * opérateurs locaux. Le budget en déduit hébergement et repas (budget.js).
 */

import { attente } from '../attente.js';
import { brancherChoix, grilleChoix } from '../cartes-choix.js';
import { echapper, langue, libelles, t } from '../i18n.js';
import { genererLieux } from '../api.js';
import { cleLieux, precharger, recuperer } from '../prechargement.js';
import { vignette } from '../illustrations.js';
import { LISTE_PAR_TYPE, TYPES_SEJOUR } from '../sejours.js';
import { chercherAeroport } from '../aeroports.js';
import { estPrerempli, lienReservation, nomPartenaire } from '../liens.js';
import { modifierVoyage } from '../voyage.js';

/** Ce tiroir peut être passé (CLAUDE.md §7). */
export const PEUT_ETRE_PASSE = true;

/** Décrit une demande de lieux à partir du voyage et d'un type de séjour. */
function demandeLieux(voyage, type) {
  const typeListe = LISTE_PAR_TYPE[type];
  if (!typeListe || !voyage?.destination || !voyage?.mois) return null;

  return {
    cle: cleLieux({
      destination: voyage.destinationNormalisee ?? voyage.destination,
      type: typeListe,
      mois: voyage.mois,
      langue: langue(),
    }),
    parametres: {
      destination: voyage.destination,
      type: typeListe,
      mois: voyage.mois,
      langue: langue(),
      voyageurs: voyage.voyageurs ?? { adultes: 2, enfants: 0 },
    },
  };
}

/**
 * Lance la recherche de lieux en avance, depuis un tiroir précédent.
 *
 * Appelé par app.js à l'ouverture de la Fiche : les trois tiroirs qui suivent
 * — Fiche, Transport, Hébergement — se lisent et se remplissent pendant que
 * la recherche tourne.
 *
 * Sans type choisi, rien n'est lancé. Parier sur l'un des sept reviendrait à
 * payer six appels perdus pour un bon, maintenant que le type se demande dès
 * la Saisie.
 *
 * @param {object} voyage
 */
export function preparer(voyage) {
  const demande = demandeLieux(voyage, voyage?.tourisme?.type);
  if (!demande) return;

  precharger(demande.cle, () => genererLieux(demande.parametres));
}

/** Durée maximale proposée pour un safari organisé, en jours. */
const SAFARI_JOURS_MAX = 21;

/** Où chercher un safari organisé, du plus spécialisé au plus général. */
const PARTENAIRES_SAFARI = ['safaribookings', 'tourradar', 'viator'];

/** Critères d'hébergement conseillés pour un repos total. */
const FILTRES_CONSEILLES = ['piscine', 'spa', 'au-calme', 'vue-mer'];

/**
 * Met en forme un prix d'entrée.
 * @param {number|null} prix
 * @param {string|null} devise
 * @returns {string}
 */
function formaterPrix(prix, devise) {
  if (typeof prix !== 'number') return t('tourisme.entreeLibre');

  try {
    return new Intl.NumberFormat(langue(), {
      style: 'currency',
      currency: devise || 'EUR',
      maximumFractionDigits: 0,
    }).format(prix);
  } catch {
    return `${Math.round(prix)} ${devise ?? ''}`.trim();
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
  // Le pays de destination oriente les liens vers les opérateurs de safari.
  const pays = (await chercherAeroport(voyage?.destination))?.pays ?? null;

  /** Liste chargée pour le type courant, null tant qu'elle n'a pas été demandée. */
  let liste = null;
  let erreurListe = null;
  let chargement = false;

  /** Lieux retenus, indexés par nom pour retrouver l'état des cases. */
  const retenus = new Map(
    (voyage.tourisme?.lieuxRetenus ?? []).map((lieu) => [lieu.nom, lieu])
  );

  /** Enregistre la sélection dans le voyage. */
  const enregistrerRetenus = () => {
    const lieuxRetenus = [...retenus.values()];
    voyage.tourisme = { ...voyage.tourisme, lieuxRetenus };
    modifierVoyage({ tourisme: { lieuxRetenus } });
  };

  /** Demande la liste correspondant au type choisi. */
  const chargerListe = async (type) => {
    // Sans type de liste (repos total) ou sans destination, il n'y a rien à
    // demander — et demandeLieux renvoie null dans les deux cas.
    const demande = demandeLieux(voyage, type);
    if (!demande) {
      liste = null;
      rendre();
      return;
    }

    chargement = true;
    erreurListe = null;
    rendre();

    try {
      // Si la recherche a été lancée en avance, on attend celle-là : en
      // ouvrir une seconde paierait deux fois la même chose et annulerait
      // l'avance prise.
      const resultat = await (recuperer(demande.cle) ?? genererLieux(demande.parametres));
      liste = resultat;
    } catch (erreur) {
      erreurListe = erreur.cleLibelle ?? 'erreurs.ia';
      liste = null;
    } finally {
      chargement = false;
      rendre();
    }
  };

  /** Enregistre une modification du safari organisé. */
  const enregistrerSafari = (modifications) => {
    const safari = { ...(voyage.tourisme?.safari ?? {}), ...modifications };
    voyage.tourisme = { ...voyage.tourisme, safari };
    modifierVoyage({ tourisme: { safari } });
  };

  /** Bloc « Safari organisé » : durée, contenu, prix et opérateurs. */
  const blocSafari = () => {
    const safari = voyage.tourisme?.safari ?? {};
    const maximum = Math.max(1, Math.min(voyage.jours ?? SAFARI_JOURS_MAX, SAFARI_JOURS_MAX));

    const durees = [
      `<option value="">${echapper(t('tourisme.safariSansOrganise'))}</option>`,
      ...Array.from({ length: maximum }, (_, index) => index + 1).map(
        (nombre) =>
          `<option value="${nombre}"${nombre === safari.jours ? ' selected' : ''}>
            ${echapper(t('tourisme.safariJoursValeur', { nombre }))}</option>`
      ),
    ].join('');

    // Un lien qui ne mènerait qu'à une page d'accueil (SafariBookings hors
    // d'Afrique) n'aide pas : on ne le montre pas.
    const params = { pays, destination: voyage.destination, requete: 'safari' };
    const liens = PARTENAIRES_SAFARI.filter((partenaire) => estPrerempli(partenaire, params))
      .map(
        (partenaire) => `
          <li>
            <a class="bouton bouton--lien" href="${echapper(lienReservation(partenaire, params))}"
               target="_blank" rel="noopener noreferrer">${echapper(nomPartenaire(partenaire))}</a>
          </li>`
      )
      .join('');

    return `
      <section class="carte">
        <h3>${echapper(t('tourisme.safariTitre'))}</h3>
        <p>${echapper(t('tourisme.safariIntro'))}</p>
        <ul class="liens">${liens}</ul>

        <div class="champ">
          <label for="safari-jours">${echapper(t('tourisme.safariJours'))}</label>
          <select id="safari-jours">${durees}</select>
        </div>

        <label class="case">
          <input type="checkbox" id="safari-tout-compris" ${safari.toutCompris === false ? '' : 'checked'}>
          <span>${echapper(t('tourisme.safariToutCompris'))}</span>
        </label>

        <div class="champ">
          <label for="safari-prix">${echapper(t('tourisme.safariPrix'))}</label>
          <input type="number" id="safari-prix" min="0" step="10" inputmode="decimal"
                 value="${safari.prixTotal ?? ''}">
          <p class="champ__aide">${echapper(t('tourisme.safariPrixAide'))}</p>
        </div>
      </section>
    `;
  };

  /** Construit la carte d'un lieu. */
  const carteLieu = (lieu) => {
    const coche = retenus.has(lieu.nom);
    const prix = formaterPrix(lieu.prixEntree, lieu.devise);

    // Le lien d'activité est construit à partir du nom du lieu (CLAUDE.md §6).
    // Viator plutôt que GetYourGuide : sur téléphone, l'app GetYourGuide
    // intercepte le lien et perd la recherche (constaté le 24/09/2026).
    const lienActivite = lienReservation('viator', {
      requete: lieu.nom,
      destination: voyage.destination,
    });

    const lienOfficiel = lieu.lienOfficiel
      ? `<p><a href="${echapper(lieu.lienOfficiel)}" target="_blank" rel="noopener noreferrer">
           ${echapper(t('tourisme.lienOfficiel'))}</a>
           <span class="a-verifier">${echapper(t('commun.aVerifier'))}</span></p>`
      : '';

    return `
      <article class="carte carte--lieu">
        <label class="case case--lieu">
          <input type="checkbox" data-lieu="${echapper(lieu.nom)}" ${coche ? 'checked' : ''}>
          <span class="lieu__nom">${echapper(lieu.nom)}</span>
        </label>
        <p class="note">${echapper(t('tourisme.prixEntree'))} : ${echapper(prix)}</p>
        <p>${echapper(lieu.description)}</p>
        <p class="lieu__conseils">${echapper(lieu.conseils)}</p>
        ${lienOfficiel}
        <a class="bouton bouton--lien" href="${echapper(lienActivite)}"
           target="_blank" rel="noopener noreferrer">
          ${echapper(t('tourisme.reserverChez', { partenaire: nomPartenaire('viator') }))}
        </a>
      </article>
    `;
  };

  function rendre() {
    const type = voyage.tourisme?.type ?? null;

    // Le nom du type sert aussi de clé d'icône : business, repos-total…
    const choix = grilleChoix(
      TYPES_SEJOUR.map((valeur) => ({
        valeur,
        libelle: t(`tourisme.type.${valeur}`),
        // Un paysage plutôt qu'un pictogramme : c'est ici qu'on choisit
        // l'ambiance du voyage, et une plage se reconnaît mieux qu'un parasol
        // au trait.
        scene: vignette(valeur),
      })),
      type
    );

    let contenu = '';

    if (type === 'repos-total') {
      // Aucun appel à l'IA ici : un repos total se prépare dans le choix de
      // l'hébergement, pas dans une liste de visites.
      contenu = `
        <section class="carte">
          <h3>${echapper(t('tourisme.reposTitre'))}</h3>
          <p>${echapper(t('tourisme.reposConseils'))}</p>
          <p class="note">${echapper(
            t('tourisme.reposFiltres', {
              filtres: FILTRES_CONSEILLES.map((filtre) =>
                t(`hebergement.filtre.${filtre}`)
              ).join(', '),
            })
          )}</p>
        </section>
      `;
    } else if (chargement) {
      // Les messages disent ce qui est cherché : visites, adresses, étapes…
      contenu = attente(libelles(`attente.${LISTE_PAR_TYPE[type]}`), 3);
    } else if (erreurListe) {
      contenu = `
        <section class="carte">
          <p class="avertissement">${echapper(t(erreurListe))}</p>
          <button class="bouton bouton--principal" type="button" id="tourisme-reessayer">
            ${echapper(t('commun.reessayer'))}
          </button>
        </section>
      `;
    } else if (liste?.lieux?.length) {
      const total = [...retenus.values()].reduce(
        (somme, lieu) => somme + (typeof lieu.prixEntree === 'number' ? lieu.prixEntree : 0),
        0
      );

      const recapitulatif = retenus.size
        ? `<p class="note">${echapper(
            t('tourisme.retenusRecapitulatif', {
              nombre: retenus.size,
              total: formaterPrix(total, liste.lieux[0]?.devise ?? 'EUR'),
            })
          )}</p>`
        : '';

      contenu = `
        ${recapitulatif}
        ${liste.lieux.map(carteLieu).join('')}
      `;
    } else if (liste) {
      // Réponse reçue, mais vide : le prompt demande d'en proposer moins
      // plutôt que d'en inventer. Ce n'est pas une panne, et le message le dit.
      contenu = `
        <section class="carte">
          <p class="avertissement">${echapper(t('tourisme.aucunTrouve'))}</p>
        </section>
      `;
    }

    conteneur.innerHTML = `
      <section class="carte">
        <h2>${echapper(t('tourisme.titre'))}</h2>
        <p>${echapper(t('tourisme.question'))}</p>
        ${choix}
      </section>

      ${type === 'safari' ? blocSafari() : ''}

      ${contenu}

      <button class="bouton bouton--principal" type="button" id="tourisme-suivant">
        ${echapper(t('commun.suivant'))}
      </button>
    `;

    brancherChoix(conteneur, type, (nouveau) => {
      voyage.tourisme = { ...voyage.tourisme, type: nouveau };
      modifierVoyage({ tourisme: { type: nouveau } });

      liste = null;
      erreurListe = null;

      if (nouveau && LISTE_PAR_TYPE[nouveau]) chargerListe(nouveau);
      else rendre();
    });

    conteneur.querySelectorAll('[data-lieu]').forEach((caseACocher) => {
      caseACocher.addEventListener('change', () => {
        const nom = caseACocher.dataset.lieu;
        const lieu = liste?.lieux?.find((candidat) => candidat.nom === nom);
        if (!lieu) return;

        if (caseACocher.checked) {
          retenus.set(nom, {
            nom: lieu.nom,
            prixEntree: typeof lieu.prixEntree === 'number' ? lieu.prixEntree : null,
            devise: lieu.devise ?? null,
          });
        } else {
          retenus.delete(nom);
        }

        enregistrerRetenus();
        rendre();
      });
    });

    conteneur.querySelector('#safari-jours')?.addEventListener('change', (evenement) => {
      const jours = Number.parseInt(evenement.target.value, 10);
      enregistrerSafari({ jours: Number.isNaN(jours) ? null : jours });
    });

    conteneur.querySelector('#safari-tout-compris')?.addEventListener('change', (evenement) => {
      enregistrerSafari({ toutCompris: evenement.target.checked });
    });

    conteneur.querySelector('#safari-prix')?.addEventListener('input', (evenement) => {
      const prix = Number.parseFloat(evenement.target.value);
      enregistrerSafari({ prixTotal: Number.isFinite(prix) && prix > 0 ? prix : null });
    });

    conteneur.querySelector('#tourisme-reessayer')?.addEventListener('click', () => {
      chargerListe(voyage.tourisme?.type);
    });

    conteneur.querySelector('#tourisme-suivant').addEventListener('click', actions.suivant);
  }

  rendre();

  // Une reprise sur ce tiroir recharge la liste correspondant au type déjà
  // choisi : le cache serveur rend l'opération instantanée.
  const typeInitial = voyage.tourisme?.type;
  if (typeInitial && LISTE_PAR_TYPE[typeInitial]) {
    await chargerListe(typeInitial);
  }
}
