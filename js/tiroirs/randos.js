/**
 * randos.js — tiroir 5 « Randonnées ».
 *
 * L'utilisateur choisit ses critères, demande une sélection, puis coche les
 * randonnées qu'il retient. Les critères et les randonnées retenues sont
 * conservés dans `randos` (CLAUDE.md §4).
 *
 * La recherche n'est pas lancée automatiquement : chaque changement de
 * critère produirait un appel payant. C'est un bouton explicite qui déclenche
 * la génération.
 */

import { attente } from '../attente.js';
import { echapper, langue, libelles, t } from '../i18n.js';
import { genererRandos } from '../api.js';
import { lienReservation } from '../liens.js';
import { modifierVoyage } from '../voyage.js';

/** Ce tiroir peut être passé (CLAUDE.md §7). */
export const PEUT_ETRE_PASSE = true;

/** Niveaux de difficulté, du plus accessible au plus engagé. */
const NIVEAUX = ['facile', 'moyen', 'difficile', 'tres-difficile'];

/** Durées de marche maximales proposées, en heures. */
const DUREES = [2, 3, 4, 6, 8];

/** Dénivelés positifs maximaux proposés, en mètres. */
const DENIVELES = [300, 600, 1000, 1500];

/** Formes d'itinéraire. */
const FORMES = ['oui', 'non'];

/**
 * Met en forme une durée en heures.
 * @param {number} heures
 * @returns {string}
 */
function formaterDuree(heures) {
  if (!Number.isFinite(heures)) return '';
  const entier = Math.floor(heures);
  const minutes = Math.round((heures - entier) * 60);
  return minutes ? `${entier} h ${minutes}` : `${entier} h`;
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
export function afficher(conteneur, voyage, actions) {
  /** Critères de travail, initialisés depuis le voyage. */
  const criteres = {
    niveau: voyage.randos?.niveau ?? null,
    dureeMax: voyage.randos?.dureeMax ?? null,
    deniveleMax: voyage.randos?.deniveleMax ?? null,
    boucle: voyage.randos?.boucle ?? null,
    adapteeEnfants: voyage.randos?.adapteeEnfants ?? false,
  };

  /** Randonnées retenues, indexées par nom. */
  const retenues = new Map((voyage.randos?.retenues ?? []).map((rando) => [rando.nom, rando]));

  let liste = null;
  let erreur = null;
  let chargement = false;

  /** Enregistre les critères dans le voyage. */
  const enregistrerCriteres = () => {
    voyage.randos = { ...voyage.randos, ...criteres };
    modifierVoyage({ randos: { ...criteres } });
  };

  /** Enregistre la sélection dans le voyage. */
  const enregistrerRetenues = () => {
    const valeurs = [...retenues.values()];
    voyage.randos = { ...voyage.randos, retenues: valeurs };
    modifierVoyage({ randos: { retenues: valeurs } });
  };

  /** Demande une sélection correspondant aux critères. */
  const chercher = async () => {
    chargement = true;
    erreur = null;
    rendre();

    try {
      const resultat = await genererRandos({
        destination: voyage.destination,
        mois: voyage.mois,
        langue: langue(),
        ...criteres,
      });
      liste = resultat;
    } catch (echec) {
      erreur = echec.cleLibelle ?? 'erreurs.ia';
      liste = null;
    } finally {
      chargement = false;
      rendre();
    }
  };

  /** Construit un groupe de boutons à choix unique, désélectionnable. */
  const groupeChoix = (cle, valeurs, valeurCourante, libelle) => {
    const boutons = valeurs
      .map(
        (valeur) => `
          <button class="bouton bouton--choix${valeur === valeurCourante ? ' bouton--choisi' : ''}"
                  type="button" data-critere="${cle}" data-valeur="${valeur}"
                  aria-pressed="${valeur === valeurCourante}">
            ${echapper(libelle(valeur))}
          </button>
        `
      )
      .join('');

    return `
      <fieldset class="groupe-filtres">
        <legend>${echapper(t(`randos.${cle}`))}</legend>
        <div class="choix">${boutons}</div>
      </fieldset>
    `;
  };

  /** Construit la carte d'une randonnée. */
  const carteRando = (rando) => {
    const cochee = retenues.has(rando.nom);

    const chiffres = [
      t('randos.distanceValeur', { km: formaterNombre(rando.distanceKm) }),
      formaterDuree(rando.dureeHeures),
      t('randos.deniveleValeur', { m: formaterNombre(rando.deniveleM) }),
      t(`randos.niveaux.${rando.niveau}`),
      rando.boucle ? t('randos.estBoucle') : t('randos.estAllerRetour'),
    ];

    if (rando.adapteeEnfants) chiffres.push(t('randos.estEnfants'));

    // Une recherche web du tracé : elle mène à la page de l'itinéraire chez
    // Komoot, AllTrails ou Visorando (voir liens.js, recherchetrace).
    const lienTrace = lienReservation('recherchetrace', {
      requete: rando.nom,
      destination: voyage.destination,
    });

    const lienDepart = lienReservation('googlemapslieu', {
      requete: rando.pointDepart,
      destination: voyage.destination,
    });

    return `
      <article class="carte carte--lieu">
        <label class="case case--lieu">
          <input type="checkbox" data-rando="${echapper(rando.nom)}" ${cochee ? 'checked' : ''}>
          <span class="lieu__nom">${echapper(rando.nom)}</span>
        </label>

        <p class="note">${echapper(chiffres.join(' · '))}</p>
        <p>${echapper(rando.description)}</p>
        <p class="lieu__conseils">${echapper(rando.conseils)}</p>

        <p class="note">
          ${echapper(t('randos.depart'))} :
          <a href="${echapper(lienDepart)}" target="_blank" rel="noopener noreferrer">
            ${echapper(rando.pointDepart)}
          </a>
          · ${echapper(t('randos.meilleureSaison'))} : ${echapper(rando.meilleureSaison)}
        </p>

        <a class="bouton bouton--lien" href="${echapper(lienTrace)}"
           target="_blank" rel="noopener noreferrer">
          ${echapper(t('randos.voirTrace'))}
        </a>
      </article>
    `;
  };

  function rendre() {
    let resultats = '';

    if (chargement) {
      resultats = attente(libelles('attente.randos'), 3);
    } else if (erreur) {
      resultats = `
        <section class="carte">
          <p class="avertissement">${echapper(t(erreur))}</p>
        </section>
      `;
    } else if (liste?.randos?.length) {
      const recapitulatif = retenues.size
        ? `<p class="note">${echapper(t('randos.retenuesRecapitulatif', { nombre: retenues.size }))}</p>`
        : '';
      resultats = `${recapitulatif}${liste.randos.map(carteRando).join('')}`;
    } else if (liste) {
      // Le prompt demande d'en proposer moins plutôt que d'en inventer :
      // une liste vide signale des critères trop restrictifs.
      resultats = `
        <section class="carte">
          <p class="avertissement">${echapper(t('randos.aucuneTrouvee'))}</p>
        </section>
      `;
    }

    conteneur.innerHTML = `
      <section class="carte">
        <h2>${echapper(t('randos.titre'))}</h2>
        <p>${echapper(t('randos.question'))}</p>

        ${groupeChoix('niveau', NIVEAUX, criteres.niveau, (valeur) => t(`randos.niveaux.${valeur}`))}
        ${groupeChoix('dureeMax', DUREES, criteres.dureeMax, (valeur) => `${valeur} h`)}
        ${groupeChoix('deniveleMax', DENIVELES, criteres.deniveleMax, (valeur) =>
          t('randos.deniveleValeur', { m: formaterNombre(valeur) })
        )}
        ${groupeChoix('boucle', FORMES, criteres.boucle, (valeur) =>
          valeur === 'oui' ? t('randos.estBoucle') : t('randos.estAllerRetour')
        )}

        <label class="case">
          <input type="checkbox" id="randos-enfants" ${criteres.adapteeEnfants ? 'checked' : ''}>
          <span>${echapper(t('randos.enfants'))}</span>
        </label>

        <button class="bouton bouton--principal" type="button" id="randos-chercher">
          ${echapper(liste ? t('randos.relancer') : t('randos.chercher'))}
        </button>
      </section>

      ${resultats}

      <button class="bouton bouton--principal" type="button" id="randos-suivant">
        ${echapper(t('commun.suivant'))}
      </button>
    `;

    conteneur.querySelectorAll('[data-critere]').forEach((bouton) => {
      bouton.addEventListener('click', () => {
        const { critere, valeur } = bouton.dataset;
        const nombre = Number(valeur);
        const valeurTypee = Number.isNaN(nombre) ? valeur : nombre;

        // Un second clic sur le critère déjà retenu l'annule.
        criteres[critere] = criteres[critere] === valeurTypee ? null : valeurTypee;
        enregistrerCriteres();
        rendre();
      });
    });

    conteneur.querySelector('#randos-enfants').addEventListener('change', (evenement) => {
      criteres.adapteeEnfants = evenement.target.checked;
      enregistrerCriteres();
    });

    conteneur.querySelectorAll('[data-rando]').forEach((caseACocher) => {
      caseACocher.addEventListener('change', () => {
        const nom = caseACocher.dataset.rando;
        const rando = liste?.randos?.find((candidate) => candidate.nom === nom);
        if (!rando) return;

        if (caseACocher.checked) {
          retenues.set(nom, {
            nom: rando.nom,
            niveau: rando.niveau,
            distanceKm: rando.distanceKm,
            dureeHeures: rando.dureeHeures,
            deniveleM: rando.deniveleM,
            pointDepart: rando.pointDepart,
          });
        } else {
          retenues.delete(nom);
        }

        enregistrerRetenues();
        rendre();
      });
    });

    conteneur.querySelector('#randos-chercher').addEventListener('click', chercher);
    conteneur.querySelector('#randos-suivant').addEventListener('click', actions.suivant);
  }

  rendre();
}
