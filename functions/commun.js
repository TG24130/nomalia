/**
 * commun.js — socle partagé par toutes les Cloud Functions.
 *
 * Ce module ne dépend d'aucune fonction métier : c'est ce qui permet à
 * index.js de les exporter sans créer de cycle d'import. Un module de
 * fonction importe son socle ici, jamais depuis index.js.
 *
 * Règle absolue : la clé de l'API Claude ne sort jamais de ce processus.
 */

import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';

/**
 * Modèle Claude utilisé par toutes les fonctions — un seul endroit à changer.
 *
 * Sonnet 5 suffit pour une fiche factuelle et coûte environ deux fois moins
 * cher qu'Opus 5 ; la recherche web, elle, coûte le même prix quel que soit
 * le modèle. Passer à 'claude-opus-5' si la qualité des fiches le justifie.
 */
export const MODELE_CLAUDE = 'claude-sonnet-5';

/** Clé de l'API Claude, lue depuis Secret Manager. Jamais dans le code. */
export const CLE_ANTHROPIC = defineSecret('ANTHROPIC_API_KEY');

/** Durée de validité du cache des fiches et des listes (30 jours). */
export const DUREE_CACHE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Version du format des réponses mises en cache.
 *
 * À incrémenter dès qu'un changement de prompt ou de schéma rend les entrées
 * existantes inexploitables. Une entrée d'une autre version est ignorée et
 * régénérée, plutôt que servie trente jours durant dans l'ancien format.
 *
 * 2 : tous les montants sont en euros, convertis au taux courant. Avant, les
 *     prix revenaient dans la monnaie locale et se retrouvaient additionnés
 *     avec des postes déjà libellés en euros.
 * 3 : la fiche donne aussi les prix d'une location et d'un camping par nuit,
 *     pour que le budget suive le type d'hébergement choisi.
 */
export const VERSION_CACHE = 3;

setGlobalOptions({
  region: 'europe-west1',
  maxInstances: 10,
  memory: '512MiB',
  timeoutSeconds: 120,
});

initializeApp();

export const db = getFirestore();

/**
 * Vérifie que l'appelant est connecté, que son e-mail est vérifié et qu'il
 * figure dans la collection `autorises`. À appeler au début de chaque fonction.
 *
 * @param {import('firebase-functions/v2/https').CallableRequest} requete
 * @returns {Promise<{ uid: string, email: string }>}
 * @throws {HttpsError} `unauthenticated` ou `permission-denied`
 */
export async function verifierAcces(requete) {
  const auth = requete.auth;

  if (!auth || !auth.token?.email) {
    throw new HttpsError('unauthenticated', 'Connexion requise.');
  }

  if (auth.token.email_verified !== true) {
    throw new HttpsError('permission-denied', 'Adresse e-mail non vérifiée.');
  }

  const email = auth.token.email.toLowerCase();
  const entree = await db.collection('autorises').doc(email).get();

  if (!entree.exists) {
    throw new HttpsError('permission-denied', 'Adresse e-mail non autorisée.');
  }

  return { uid: auth.uid, email };
}

/**
 * Normalise une destination pour servir de clé de cache.
 * « Crète, Grèce » → « crete-grece »
 *
 * Note : la même logique existe côté front dans js/voyage.js ; front et back
 * n'ayant pas d'étape de build commune, les deux copies doivent rester
 * alignées.
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
 * Construit la clé de cache d'une fiche : `destination_mois_langue`.
 * @param {string} destination
 * @param {number} mois 1 à 12
 * @param {string} langue
 * @returns {string}
 */
export function cleFiche(destination, mois, langue) {
  return `${normaliser(destination)}_${String(mois).padStart(2, '0')}_${langue}`;
}

/**
 * Lit une entrée de cache encore valable : ni expirée, ni écrite sous une
 * autre VERSION_CACHE.
 * @param {string} collection
 * @param {string} cle
 * @returns {Promise<object|null>} les données, ou null
 */
export async function lireCache(collection, cle) {
  const entree = await db.collection(collection).doc(cle).get();
  if (!entree.exists) return null;

  const donnees = entree.data();
  const expiree = donnees.expireLe?.toMillis?.() < Date.now();
  const perimee = donnees.version !== VERSION_CACHE;
  return expiree || perimee ? null : donnees;
}

/**
 * Écrit une entrée de cache, horodatée et versionnée.
 * @param {string} collection
 * @param {string} cle
 * @param {object} donnees
 */
export async function ecrireCache(collection, cle, donnees) {
  await db.collection(collection).doc(cle).set({
    ...donnees,
    modele: MODELE_CLAUDE,
    version: VERSION_CACHE,
    genereLe: FieldValue.serverTimestamp(),
    expireLe: new Date(Date.now() + DUREE_CACHE_MS),
  });
}
