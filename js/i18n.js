/**
 * i18n.js — internationalisation.
 *
 * Seul point d'accès aux libellés de l'interface. Aucun texte ne doit être
 * écrit en dur ailleurs dans le code.
 *
 * V0 : seul `fr` existe, mais ajouter en.json / es.json / zh.json dans lang/
 * suffit — aucune modification de code nécessaire.
 */

/** Langues prévues. Seule `fr` possède un fichier en V0. */
export const LANGUES_PREVUES = ['fr', 'en', 'es', 'zh'];

/** Langue utilisée si aucune n'est demandée ou si le fichier est introuvable. */
export const LANGUE_DEFAUT = 'fr';

/** Langues proposées à l'utilisateur, dans l'ordre des drapeaux. */
export const LANGUES_PROPOSEES = ['fr', 'en', 'es'];

/** Clé de stockage local de la langue choisie. */
const CLE_PREFERENCE = 'nomalia.langue';

/**
 * Langue choisie sur cet appareil, ou null si aucun choix n'a été fait.
 * Le stockage local peut être indisponible (navigation privée) : on fait
 * alors comme si rien n'avait été choisi.
 * @returns {string|null}
 */
export function languePreferee() {
  try {
    const valeur = localStorage.getItem(CLE_PREFERENCE);
    return LANGUES_PROPOSEES.includes(valeur) ? valeur : null;
  } catch {
    return null;
  }
}

/**
 * Retient la langue choisie et charge ses libellés.
 * @param {string} langue
 * @returns {Promise<string>} la langue effectivement chargée
 */
export async function choisirLangue(langue) {
  try {
    localStorage.setItem(CLE_PREFERENCE, langue);
  } catch {
    // Sans stockage, le choix vaut pour la session en cours.
  }
  return chargerLangue(langue);
}

let langueCourante = LANGUE_DEFAUT;
let traductions = {};

/**
 * Charge le fichier de langue et le garde en mémoire.
 * @param {string} langue code ISO à deux lettres
 * @returns {Promise<string>} la langue réellement chargée
 */
export async function chargerLangue(langue = LANGUE_DEFAUT) {
  const demandee = LANGUES_PREVUES.includes(langue) ? langue : LANGUE_DEFAUT;

  try {
    const reponse = await fetch(`lang/${demandee}.json`, { cache: 'no-cache' });
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
    traductions = await reponse.json();
    langueCourante = demandee;
  } catch (erreur) {
    // Repli sur le français si la langue demandée est absente.
    if (demandee !== LANGUE_DEFAUT) return chargerLangue(LANGUE_DEFAUT);
    console.error('Impossible de charger les libellés', erreur);
    traductions = {};
  }

  document.documentElement.lang = langueCourante;
  return langueCourante;
}

/** @returns {string} la langue actuellement chargée */
export function langue() {
  return langueCourante;
}

/**
 * Renvoie le libellé associé à une clé.
 *
 * Les clés sont hiérarchiques : `t('saisie.destination')` lit
 * `{ "saisie": { "destination": "…" } }`.
 *
 * Les variables sont interpolées avec la syntaxe `{nom}` :
 * `t('budget.total', { montant: 1200 })` → « Total : 1200 € ».
 *
 * Si la clé est absente, la clé elle-même est renvoyée (repérable en test).
 *
 * @param {string} cle
 * @param {Object<string, string|number>} [variables]
 * @returns {string}
 */
export function t(cle, variables) {
  const valeur = cle.split('.').reduce(
    (noeud, morceau) => (noeud && typeof noeud === 'object' ? noeud[morceau] : undefined),
    traductions
  );

  if (typeof valeur !== 'string') {
    console.warn(`Libellé manquant : ${cle}`);
    return cle;
  }

  if (!variables) return valeur;

  return valeur.replace(/\{(\w+)\}/g, (correspondance, nom) =>
    nom in variables ? String(variables[nom]) : correspondance
  );
}

/**
 * Renvoie une série de libellés.
 *
 * Certains libellés vont par série — les phrases qui se relaient pendant une
 * attente, par exemple. Les stocker en tableau dans le fichier de langue les
 * garde lisibles et traduisibles d'un bloc, mais t() ne rend que des chaînes.
 *
 * Si la clé est absente ou n'est pas une liste de chaînes, une liste vide est
 * renvoyée : un appelant qui affiche des messages n'a alors rien à afficher,
 * ce qui vaut mieux qu'une clé brute.
 *
 * Le nom évite `liste`, déjà porté par des variables locales dans les tiroirs.
 *
 * @param {string} cle
 * @returns {string[]}
 */
export function libelles(cle) {
  const valeur = cle.split('.').reduce(
    (noeud, morceau) => (noeud && typeof noeud === 'object' ? noeud[morceau] : undefined),
    traductions
  );

  if (!Array.isArray(valeur) || valeur.some((element) => typeof element !== 'string')) {
    console.warn(`Série de libellés manquante : ${cle}`);
    return [];
  }

  return valeur;
}

/**
 * Échappe une chaîne avant insertion dans du HTML.
 *
 * Vit ici parce que tout texte inséré dans la page passe par les libellés ou
 * par des données saisies par l'utilisateur : les deux doivent être échappés.
 *
 * @param {string} texte
 * @returns {string}
 */
export function echapper(texte) {
  return String(texte ?? '').replace(
    /[&<>"']/g,
    (caractere) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[caractere]
  );
}

/**
 * Remplace le contenu des éléments porteurs d'un attribut `data-i18n`
 * par le libellé correspondant.
 *
 * Variantes acceptées :
 *  - `data-i18n="cle"`             → textContent
 *  - `data-i18n-placeholder="cle"` → attribut placeholder
 *  - `data-i18n-aria="cle"`        → attribut aria-label
 *  - `data-i18n-titre="cle"`       → attribut title
 *
 * @param {ParentNode} [racine=document] portée à traduire
 */
export function traduireDom(racine = document) {
  racine.querySelectorAll('[data-i18n]').forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });

  const attributs = {
    'data-i18n-placeholder': 'placeholder',
    'data-i18n-aria': 'aria-label',
    'data-i18n-titre': 'title',
  };

  for (const [donnee, attribut] of Object.entries(attributs)) {
    racine.querySelectorAll(`[${donnee}]`).forEach((element) => {
      element.setAttribute(attribut, t(element.getAttribute(donnee)));
    });
  }
}
