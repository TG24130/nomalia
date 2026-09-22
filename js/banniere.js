/**
 * banniere.js — le bandeau qui coiffe chaque écran.
 *
 * Grand sur l'accueil et la saisie, court dans les tiroirs, et toujours un
 * paysage : c'est lui qui distingue une préparation de voyage d'un formulaire
 * administratif.
 *
 * Il porte aussi le nom de l'application et l'étape en cours, là où un en-tête
 * séparé aurait pris de la hauteur pour rien.
 */

import { echapper, t } from './i18n.js';
import { bandeau } from './illustrations.js';

/**
 * Emplacement d'une photo, s'il y en a une.
 *
 * Aucune de ces images n'est livrée avec l'application : tant qu'un fichier
 * manque, l'illustration vectorielle tient la place. On évite ainsi qu'un
 * écran reste vide en attendant une photo, et on peut en ajouter — ou en
 * retirer — sans toucher au code.
 *
 *  - `images/accueil.jpg` coiffe l'accueil, la connexion et la saisie ;
 *  - `images/etape-transport.jpg`, `etape-randos.jpg`… coiffent chaque tiroir.
 *
 * Format conseillé : au moins 1200 pixels de large, en JPEG, et une image
 * dont on a le droit de se servir — une photo personnelle fait l'affaire.
 *
 * @param {string} etape
 * @param {boolean} compacte
 * @returns {string} chemin du fichier attendu
 */
function cheminPhoto(etape, compacte) {
  return compacte ? `images/etape-${etape}.jpg` : 'images/accueil.jpg';
}

/** Présence des photos déjà testées, par chemin : on ne teste qu'une fois. */
const photosConnues = new Map();

/** Écran affiché, pour qu'une photo lente ne se pose pas sur le suivant. */
let etapeAffichee = null;
let compacteAffichee = false;

/**
 * Vérifie si une photo est présente.
 *
 * @param {string} chemin
 * @returns {Promise<boolean>}
 */
function photoExiste(chemin) {
  if (!photosConnues.has(chemin)) {
    photosConnues.set(
      chemin,
      new Promise((resoudre) => {
        const image = new Image();
        image.addEventListener('load', () => resoudre(true));
        image.addEventListener('error', () => resoudre(false));
        image.src = chemin;
      })
    );
  }

  return photosConnues.get(chemin);
}

/**
 * Affiche le bandeau.
 *
 * @param {HTMLElement} element conteneur du bandeau
 * @param {object} options
 * @param {string} [options.etape] étape du parcours, qui choisit le paysage
 * @param {boolean} [options.compacte] version courte, pour les tiroirs
 * @param {string} [options.titre] texte posé sur le paysage
 * @param {string} [options.sousTitre]
 */
export function afficherBanniere(element, { etape = 'saisie', compacte = false, titre, sousTitre } = {}) {
  etapeAffichee = etape;
  compacteAffichee = compacte;

  element.classList.toggle('banniere--compacte', compacte);
  element.hidden = false;

  const legende =
    titre || sousTitre
      ? `<div class="banniere__texte">
           ${titre ? `<p class="banniere__titre">${echapper(titre)}</p>` : ''}
           ${sousTitre ? `<p class="banniere__slogan">${echapper(sousTitre)}</p>` : ''}
         </div>`
      : '';

  element.innerHTML = `<div class="banniere__scene">${bandeau(etape)}</div>${legende}`;

  afficherFond(etape, compacte);
}

/**
 * Pose la photo de l'écran en fond de page.
 *
 * Les photos ont d'abord été affichées dans le bandeau : sur une bande de
 * quatre-vingts pixels, on n'y voyait rien. Elles occupent désormais une large
 * part de l'écran, derrière le contenu, atténuées par un voile et estompées
 * sur les bords — assez présentes pour qu'on les regarde, assez discrètes pour
 * qu'on lise ce qui est posé dessus.
 *
 * Le dessin du bandeau reste : il porte le titre de l'étape et tient la place
 * quand aucune photo n'a été déposée.
 *
 * @param {string} etape
 * @param {boolean} compacte
 */
function afficherFond(etape, compacte) {
  const fond = document.getElementById('fond');
  if (!fond) return;

  const chemin = cheminPhoto(etape, compacte);

  photoExiste(chemin).then((existe) => {
    // La photo de l'écran courant peut avoir changé entre-temps : on ne pose
    // que celle qui correspond encore à ce qui est affiché.
    if (chemin !== cheminPhoto(etapeAffichee, compacteAffichee)) return;

    fond.style.backgroundImage = existe ? `url("${chemin}")` : '';
    fond.classList.toggle('fond--visible', existe);

    // Deux paysages l'un sur l'autre se mangent : quand la photo est là, le
    // bandeau ne garde que son titre et la laisse paraître au travers.
    document.body.classList.toggle('a-photo', existe);
  });
}

/**
 * Affiche le bandeau d'un tiroir : court, avec le nom de l'étape.
 *
 * @param {HTMLElement} element
 * @param {string} etape
 * @param {string} [destination] rappelée sous le nom de l'étape
 */
export function afficherBanniereEtape(element, etape, destination) {
  afficherBanniere(element, {
    etape,
    compacte: true,
    titre: t(`parcours.${etape}`),
    sousTitre: destination || '',
  });
}
