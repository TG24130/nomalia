/**
 * voyage.js — seul point d'accès à l'objet voyage.
 *
 * Les tiroirs lisent et écrivent le voyage uniquement par ces fonctions
 * (CLAUDE.md §3.3). Aucun autre fichier ne parle à Firestore pour les voyages.
 *
 * La sauvegarde est automatique : chaque modification est appliquée en mémoire
 * puis écrite dans Firestore après un court délai, ce qui évite une écriture
 * par frappe au clavier.
 */

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

/** Modèle d'un voyage vide — référence du schéma (CLAUDE.md §4). */
export const VOYAGE_VIDE = {
  proprietaire: null,
  creeLe: null,
  modifieLe: null,
  langue: 'fr',
  nationalite: 'FR',
  destination: '',
  destinationNormalisee: '',
  jours: null,
  mois: null,
  // Date de départ au format AAAA-MM-JJ, facultative : le mois seul suffit à
  // préparer le voyage, mais les comparateurs de vols et d'hébergement
  // attendent des dates précises pour une recherche préremplie.
  dateDepart: null,
  voyageurs: { adultes: 2, enfants: 0 },
  depart: '',
  ficheId: null,
  transport: { mode: null, notes: '' },
  hebergement: { type: null, filtres: [] },
  tourisme: { type: null, lieuxRetenus: [] },
  randos: { niveau: null, dureeMax: null, retenues: [] },
  budget: null,
  etapeCourante: 'saisie',
};

/** Ordre des tiroirs, utilisé par la navigation et la barre de progression. */
export const ETAPES = [
  'saisie',
  'fiche',
  'transport',
  'hebergement',
  'tourisme',
  'randos',
  'budget',
];

/** Délai d'attente avant écriture dans Firestore, en millisecondes. */
const DELAI_SAUVEGARDE_MS = 600;

/** Champs jamais réécrits par une modification. */
const CHAMPS_PROTEGES = ['proprietaire', 'creeLe'];

let baseDonnees = null;
let identifiantUtilisateur = null;

/** Voyage actuellement ouvert. */
let idCourant = null;
let donneesCourantes = null;

/** Minuteur de la sauvegarde différée. */
let minuteur = null;

/** Promesse de la sauvegarde en cours, pour pouvoir l'attendre. */
let sauvegardeEnCours = null;

/**
 * Branche le module sur Firestore et sur l'utilisateur connecté.
 * À appeler après l'authentification, avant tout autre appel.
 *
 * @param {object} db instance Firestore
 * @param {{ uid: string }} utilisateur
 */
export function configurerVoyages(db, utilisateur) {
  baseDonnees = db;
  identifiantUtilisateur = utilisateur.uid;
  idCourant = null;
  donneesCourantes = null;
}

/**
 * Normalise un texte pour servir de clé (destination, cache).
 * « Crète » → « crete »
 *
 * Note : la même logique existe côté Cloud Functions ; front et back n'ayant
 * pas d'étape de build commune, les deux copies doivent rester alignées.
 *
 * @param {string} texte
 * @returns {string}
 */
export function normaliser(texte) {
  return String(texte ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Renvoie les dates de début et de fin du voyage, si elles sont connues.
 *
 * Seule la date de départ est saisie ; la date de retour s'en déduit par le
 * nombre de jours. Sans date de départ, les deux valent null et les liens
 * partenaires restent non préremplis.
 *
 * @param {object} voyage
 * @returns {{ dateDebut: string|null, dateFin: string|null }} dates ISO
 */
export function datesVoyage(voyage) {
  const depart = voyage?.dateDepart;
  if (!depart || !/^\d{4}-\d{2}-\d{2}$/.test(depart)) {
    return { dateDebut: null, dateFin: null };
  }

  const jours = Number.isInteger(voyage.jours) && voyage.jours > 0 ? voyage.jours : 1;

  // Midi UTC : évite qu'un décalage horaire fasse changer la date de retour.
  const retour = new Date(`${depart}T12:00:00Z`);
  retour.setUTCDate(retour.getUTCDate() + jours);

  return { dateDebut: depart, dateFin: retour.toISOString().slice(0, 10) };
}

/**
 * Fusionne `modifications` dans `cible` en profondeur.
 * Les tableaux sont remplacés, jamais concaténés.
 *
 * @param {object} cible
 * @param {object} modifications
 * @returns {object} la cible modifiée
 */
function fusionner(cible, modifications) {
  for (const [cle, valeur] of Object.entries(modifications)) {
    const estObjet = valeur !== null && typeof valeur === 'object' && !Array.isArray(valeur);

    if (estObjet) {
      cible[cle] = fusionner({ ...(cible[cle] ?? {}) }, valeur);
    } else {
      cible[cle] = valeur;
    }
  }
  return cible;
}

/** Vérifie que configurerVoyages a été appelé. */
function exigerConfiguration() {
  if (!baseDonnees || !identifiantUtilisateur) {
    throw new Error('voyage.js : configurerVoyages doit être appelé après la connexion.');
  }
}

/* — Lecture — */

/**
 * Liste les voyages de l'utilisateur, du plus récemment modifié au plus ancien.
 * @returns {Promise<Array<object>>} voyages avec leur `id`
 */
export async function listerVoyages() {
  exigerConfiguration();

  const requete = query(
    collection(baseDonnees, 'voyages'),
    where('proprietaire', '==', identifiantUtilisateur),
    orderBy('modifieLe', 'desc')
  );

  const resultat = await getDocs(requete);
  return resultat.docs.map((document) => ({ id: document.id, ...document.data() }));
}

/**
 * Ouvre un voyage et le garde en mémoire comme voyage courant.
 * @param {string} id
 * @returns {Promise<object>} le voyage, avec son `id`
 */
export async function ouvrirVoyage(id) {
  exigerConfiguration();
  await sauvegarderMaintenant();

  const document = await getDoc(doc(baseDonnees, 'voyages', id));
  if (!document.exists()) {
    throw new Error('voyage-introuvable');
  }

  idCourant = id;
  donneesCourantes = document.data();
  return { id, ...donneesCourantes };
}

/**
 * Voyage actuellement ouvert, ou null.
 * @returns {object|null}
 */
export function voyageCourant() {
  if (!idCourant) return null;
  return { id: idCourant, ...donneesCourantes };
}

/** Referme le voyage courant après avoir écrit les modifications en attente. */
export async function fermerVoyage() {
  await sauvegarderMaintenant();
  idCourant = null;
  donneesCourantes = null;
}

/* — Écriture — */

/**
 * Crée un voyage et l'ouvre.
 * @param {object} [donneesInitiales] champs du tiroir Saisie
 * @returns {Promise<object>} le voyage créé, avec son `id`
 */
export async function creerVoyage(donneesInitiales = {}) {
  exigerConfiguration();
  await sauvegarderMaintenant();

  const voyage = fusionner(structuredClone(VOYAGE_VIDE), donneesInitiales);
  voyage.proprietaire = identifiantUtilisateur;
  voyage.destinationNormalisee = normaliser(voyage.destination);
  voyage.creeLe = serverTimestamp();
  voyage.modifieLe = serverTimestamp();

  const document = await addDoc(collection(baseDonnees, 'voyages'), voyage);

  idCourant = document.id;
  donneesCourantes = voyage;
  return { id: document.id, ...voyage };
}

/**
 * Applique des modifications au voyage courant et programme la sauvegarde.
 * La fusion est profonde : `modifierVoyage({ transport: { mode: 'avion' } })`
 * ne perd pas `transport.notes`.
 *
 * @param {object} modifications
 * @returns {object} le voyage courant à jour
 */
export function modifierVoyage(modifications) {
  if (!idCourant) {
    throw new Error('voyage.js : aucun voyage ouvert.');
  }

  const retenues = { ...modifications };
  for (const champ of CHAMPS_PROTEGES) delete retenues[champ];

  fusionner(donneesCourantes, retenues);

  if ('destination' in retenues) {
    donneesCourantes.destinationNormalisee = normaliser(donneesCourantes.destination);
  }

  programmerSauvegarde();
  return voyageCourant();
}

/** Programme une écriture différée du voyage courant. */
function programmerSauvegarde() {
  clearTimeout(minuteur);
  minuteur = setTimeout(() => {
    sauvegardeEnCours = ecrire();
  }, DELAI_SAUVEGARDE_MS);
}

/** Écrit le voyage courant dans Firestore. */
async function ecrire() {
  if (!idCourant) return;

  const aEcrire = { ...donneesCourantes };
  for (const champ of CHAMPS_PROTEGES) delete aEcrire[champ];
  aEcrire.modifieLe = serverTimestamp();

  await updateDoc(doc(baseDonnees, 'voyages', idCourant), aEcrire);
}

/**
 * Écrit immédiatement les modifications en attente.
 * À appeler avant de quitter un écran ou de fermer l'application.
 * @returns {Promise<void>}
 */
export async function sauvegarderMaintenant() {
  if (minuteur) {
    clearTimeout(minuteur);
    minuteur = null;
    sauvegardeEnCours = ecrire();
  }
  await sauvegardeEnCours;
}

/**
 * Duplique un voyage. La copie est un nouveau voyage, non ouvert.
 * @param {string} id
 * @returns {Promise<string>} identifiant de la copie
 */
export async function dupliquerVoyage(id) {
  exigerConfiguration();
  await sauvegarderMaintenant();

  const document = await getDoc(doc(baseDonnees, 'voyages', id));
  if (!document.exists()) {
    throw new Error('voyage-introuvable');
  }

  const copie = document.data();
  copie.proprietaire = identifiantUtilisateur;
  copie.creeLe = serverTimestamp();
  copie.modifieLe = serverTimestamp();

  const creee = await addDoc(collection(baseDonnees, 'voyages'), copie);
  return creee.id;
}

/**
 * Supprime un voyage. Referme le voyage courant si c'est celui-là.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function supprimerVoyage(id) {
  exigerConfiguration();

  if (id === idCourant) {
    clearTimeout(minuteur);
    minuteur = null;
    idCourant = null;
    donneesCourantes = null;
  }

  await deleteDoc(doc(baseDonnees, 'voyages', id));
}
