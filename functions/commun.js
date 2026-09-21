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
import { getFirestore } from 'firebase-admin/firestore';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2';

/** Modèle Claude utilisé par toutes les fonctions — un seul endroit à changer. */
export const MODELE_CLAUDE = 'claude-opus-5';

/** Clé de l'API Claude, lue depuis Secret Manager. Jamais dans le code. */
export const CLE_ANTHROPIC = defineSecret('ANTHROPIC_API_KEY');

/** Durée de validité du cache des fiches et des listes (30 jours). */
export const DUREE_CACHE_MS = 30 * 24 * 60 * 60 * 1000;

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
