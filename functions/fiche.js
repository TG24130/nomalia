/**
 * fiche.js — Cloud Function `genererFiche`.
 *
 * Renvoie la fiche pratique en 10 points d'une destination, depuis le cache
 * Firestore si elle y est encore valide, sinon en interrogeant l'API Claude
 * avec l'outil de recherche web.
 *
 * La clé de l'API ne sort jamais de ce processus (CLAUDE.md §3.1).
 */

import Anthropic from '@anthropic-ai/sdk';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { FieldValue } from 'firebase-admin/firestore';

import {
  CLE_ANTHROPIC,
  DUREE_CACHE_MS,
  MODELE_CLAUDE,
  cleFiche,
  db,
  verifierAcces,
} from './commun.js';
import { SYSTEME_FICHE, promptFiche } from './prompts/fiche.js';
import { SCHEMA_FICHE, validerFiche } from './schemas/fiche.js';

/** Langues acceptées en entrée (seul `fr` est servi en V0). */
const LANGUES = ['fr', 'en', 'es', 'zh'];

/** Nombre de tentatives : un appel, puis une seule reprise (CLAUDE.md §3.7). */
const TENTATIVES = 2;

/**
 * Valide les paramètres reçus du front.
 * @param {object} donnees
 * @returns {{ destination: string, mois: number, langue: string, nationalite: string }}
 */
function lireParametres(donnees) {
  const destination = String(donnees?.destination ?? '').trim();
  const mois = Number(donnees?.mois);
  const langue = String(donnees?.langue ?? 'fr');
  const nationalite = String(donnees?.nationalite ?? 'FR').toUpperCase();

  if (destination.length < 2 || destination.length > 120) {
    throw new HttpsError('invalid-argument', 'Destination invalide.');
  }
  if (!Number.isInteger(mois) || mois < 1 || mois > 12) {
    throw new HttpsError('invalid-argument', 'Mois invalide.');
  }
  if (!LANGUES.includes(langue)) {
    throw new HttpsError('invalid-argument', 'Langue non prise en charge.');
  }
  if (!/^[A-Z]{2}$/.test(nationalite)) {
    throw new HttpsError('invalid-argument', 'Nationalité invalide.');
  }

  return { destination, mois, langue, nationalite };
}

/**
 * Extrait l'objet JSON de la réponse du modèle.
 *
 * La sortie est contrainte par un schéma, mais la recherche web peut ajouter
 * des blocs de texte intermédiaires : on lit donc du dernier bloc au premier
 * et on retient le premier qui s'analyse correctement.
 *
 * @param {Array<object>} contenu blocs de contenu de la réponse
 * @returns {object|null}
 */
function extraireJson(contenu) {
  const blocsTexte = contenu.filter((bloc) => bloc.type === 'text').map((bloc) => bloc.text);

  for (const texte of blocsTexte.reverse()) {
    // Tolère un bloc de code Markdown malgré la consigne.
    const nettoye = texte.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();

    try {
      const analyse = JSON.parse(nettoye);
      if (analyse !== null && typeof analyse === 'object') return analyse;
    } catch {
      // Bloc non analysable : on essaie le précédent.
    }
  }

  return null;
}

/**
 * Traduit une erreur du SDK Anthropic en erreur exploitable par le front.
 *
 * Le détail technique reste dans les journaux : le front ne reçoit qu'un code
 * et un message neutre (CLAUDE.md §7).
 *
 * @param {unknown} erreur
 * @returns {HttpsError}
 */
function traduireErreurApi(erreur) {
  if (erreur instanceof Anthropic.AuthenticationError) {
    logger.error('Clé ANTHROPIC_API_KEY refusée par l\'API.');
    return new HttpsError('internal', 'Service indisponible.');
  }

  if (erreur instanceof Anthropic.RateLimitError) {
    logger.warn('Limite de débit atteinte côté API Claude.');
    return new HttpsError('resource-exhausted', 'Service momentanément saturé.');
  }

  if (erreur instanceof Anthropic.APIConnectionError) {
    logger.warn('Connexion à l\'API Claude impossible.');
    return new HttpsError('unavailable', 'Service momentanément injoignable.');
  }

  if (erreur instanceof Anthropic.APIError) {
    logger.error('Erreur de l\'API Claude', { statut: erreur.status, message: erreur.message });
    return new HttpsError('internal', 'Service indisponible.');
  }

  logger.error('Erreur inattendue pendant la génération', { message: String(erreur) });
  return new HttpsError('internal', 'Service indisponible.');
}

/**
 * Interroge Claude et renvoie une fiche validée.
 *
 * @param {object} parametres
 * @returns {Promise<object>} la fiche
 */
async function demanderFiche(parametres) {
  const client = new Anthropic({ apiKey: CLE_ANTHROPIC.value() });
  const erreursCumulees = [];

  for (let tentative = 1; tentative <= TENTATIVES; tentative += 1) {
    let reponse;

    try {
      reponse = await client.beta.messages.create({
        model: MODELE_CLAUDE,
        max_tokens: 16000,
        // Repli automatique si le modèle décline la demande : la fiche reste
        // produite par un modèle de secours plutôt que de renvoyer une erreur.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: SYSTEME_FICHE,
        messages: [{ role: 'user', content: promptFiche(parametres) }],
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 6 }],
        output_config: {
          effort: 'medium',
          format: { type: 'json_schema', schema: SCHEMA_FICHE },
        },
      });
    } catch (erreur) {
      throw traduireErreurApi(erreur);
    }

    // Suivi du coût (CLAUDE.md §9).
    logger.info('Appel Claude — genererFiche', {
      destination: parametres.destination,
      tentative,
      modele: reponse.model,
      tokensEntree: reponse.usage?.input_tokens,
      tokensSortie: reponse.usage?.output_tokens,
      tokensCacheLus: reponse.usage?.cache_read_input_tokens,
      recherchesWeb: reponse.usage?.server_tool_use?.web_search_requests,
      arret: reponse.stop_reason,
    });

    if (reponse.stop_reason === 'refusal') {
      logger.warn('Demande déclinée par le modèle', {
        categorie: reponse.stop_details?.category,
      });
      throw new HttpsError('failed-precondition', 'Destination non traitable.');
    }

    const fiche = extraireJson(reponse.content);

    if (fiche === null) {
      erreursCumulees.push(`tentative ${tentative} : réponse non analysable`);
      continue;
    }

    const controle = validerFiche(fiche);
    if (controle.valide) return fiche;

    erreursCumulees.push(`tentative ${tentative} : ${controle.erreurs.join(', ')}`);
  }

  logger.error('Fiche invalide après reprise', { erreurs: erreursCumulees });
  throw new HttpsError('internal', 'La fiche n\'a pas pu être produite.');
}

/**
 * `genererFiche({ destination, mois, langue, nationalite })`
 *
 * @returns {Promise<{ ficheId: string, fiche: object, depuisCache: boolean }>}
 */
export const genererFiche = onCall(
  { secrets: [CLE_ANTHROPIC], timeoutSeconds: 300 },
  async (requete) => {
    await verifierAcces(requete);

    const parametres = lireParametres(requete.data);
    const ficheId = cleFiche(parametres.destination, parametres.mois, parametres.langue);

    // Le cache passe avant tout appel à l'API (CLAUDE.md §9).
    const enCache = await db.collection('fiches').doc(ficheId).get();

    if (enCache.exists) {
      const donnees = enCache.data();
      const expiree = donnees.expireLe?.toMillis?.() < Date.now();

      if (!expiree) {
        logger.info('Fiche servie depuis le cache', { ficheId });
        return { ficheId, fiche: donnees.fiche, depuisCache: true };
      }
    }

    const fiche = await demanderFiche(parametres);
    const maintenant = Date.now();

    await db.collection('fiches').doc(ficheId).set({
      fiche,
      destinationNormalisee: ficheId.split('_')[0],
      mois: parametres.mois,
      langue: parametres.langue,
      modele: MODELE_CLAUDE,
      genereLe: FieldValue.serverTimestamp(),
      expireLe: new Date(maintenant + DUREE_CACHE_MS),
    });

    logger.info('Fiche générée et mise en cache', { ficheId });
    return { ficheId, fiche, depuisCache: false };
  }
);
