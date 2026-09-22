/**
 * prechargement.js — générations lancées en avance.
 *
 * Une recherche par l'IA dure entre une et deux minutes. Les tiroirs Transport
 * et Hébergement, eux, se remplissent en quelques dizaines de secondes de
 * lecture et de clics. On met ce temps à profit : la liste de lieux du tiroir
 * Séjour est demandée dès l'entrée dans Transport, de sorte qu'elle soit prête
 * — ou déjà en cache côté serveur — quand l'utilisateur y arrive.
 *
 * Deux règles tiennent tout le module :
 *
 * 1. Une demande préchargée n'est jamais relancée. Le tiroir qui en a besoin
 *    récupère la promesse en cours au lieu d'ouvrir un second appel, faute de
 *    quoi le préchargement doublerait le coût au lieu de faire gagner du temps.
 *
 * 2. Un échec est silencieux. Rien n'est affiché à l'utilisateur, qui n'a rien
 *    demandé ; le tiroir concerné refera la demande normalement et montrera
 *    l'erreur à ce moment-là, s'il y a lieu.
 */

/** Promesses en cours ou terminées, par clé. */
const enCours = new Map();

/**
 * Vide les demandes mémorisées.
 * À appeler en changeant de voyage : les clés portent la destination, mais
 * rien ne sert de garder les promesses d'un voyage qu'on a quitté.
 */
export function oublierPrechargements() {
  enCours.clear();
}

/**
 * Lance une demande en avance, si elle ne l'est pas déjà.
 *
 * @param {string} cle identifie la demande ; deux appels de même clé n'en font qu'un
 * @param {() => Promise<object>} demander lance réellement l'appel
 */
export function precharger(cle, demander) {
  if (enCours.has(cle)) return;

  // L'échec est capté ici pour qu'aucun rejet ne remonte sans récepteur ; la
  // promesse mémorisée garde l'erreur, que le tiroir traitera s'il la réclame.
  const promesse = demander().catch((erreur) => {
    console.warn('Préchargement abandonné', cle, erreur);
    throw erreur;
  });

  enCours.set(cle, promesse);
}

/**
 * Récupère une demande préchargée.
 *
 * Renvoie la promesse même si elle est encore en vol : le tiroir l'attend
 * alors comme il aurait attendu la sienne, mais avec l'avance déjà prise.
 *
 * Une demande dont la promesse a échoué est oubliée, pour que le tiroir puisse
 * réessayer proprement.
 *
 * @param {string} cle
 * @returns {Promise<object>|null}
 */
export function recuperer(cle) {
  const promesse = enCours.get(cle);
  if (!promesse) return null;

  promesse.catch(() => enCours.delete(cle));
  return promesse;
}

/**
 * Clé d'une demande de lieux. Reprend la forme de la clé de cache côté
 * Cloud Function, pour qu'un même besoin porte le même nom des deux côtés.
 *
 * @param {{ destination: string, type: string, mois: number, langue: string }} parametres
 * @returns {string}
 */
export function cleLieux({ destination, type, mois, langue }) {
  return `lieux:${destination}:${type}:${mois}:${langue}`;
}
