/**
 * claude.js — appels à l'API Claude, partagés par les fonctions métier.
 *
 * Centralise ce que toutes les générations ont en commun : la demande d'une
 * réponse JSON contrainte par un schéma, la recherche web, les tentatives en
 * cas de réponse inexploitable, le suivi des tokens et la traduction des
 * erreurs (CLAUDE.md §3.7 et §9).
 *
 * La clé de l'API ne sort jamais de ce processus.
 */

import Anthropic from '@anthropic-ai/sdk';
import { HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';

import { CLE_ANTHROPIC, MODELE_CLAUDE } from './commun.js';

/** Un appel, puis une seule reprise (CLAUDE.md §3.7). */
const TENTATIVES = 2;

/**
 * Traduit une erreur du SDK Anthropic en erreur exploitable par le front.
 *
 * Le détail technique reste dans les journaux : le front ne reçoit qu'un code
 * et un message neutre (CLAUDE.md §7).
 *
 * @param {unknown} erreur
 * @returns {HttpsError}
 */
export function traduireErreurApi(erreur) {
  if (erreur instanceof Anthropic.AuthenticationError) {
    logger.error("Clé ANTHROPIC_API_KEY refusée par l'API.");
    return new HttpsError('internal', 'Service indisponible.');
  }

  if (erreur instanceof Anthropic.RateLimitError) {
    logger.warn('Limite de débit atteinte côté API Claude.');
    return new HttpsError('resource-exhausted', 'Service momentanément saturé.');
  }

  if (erreur instanceof Anthropic.APIConnectionError) {
    logger.warn("Connexion à l'API Claude impossible.");
    return new HttpsError('unavailable', 'Service momentanément injoignable.');
  }

  // Le champ « message » est réservé par le journal structuré de Firebase :
  // le détail de l'API est donc rangé sous « detail ».
  if (erreur instanceof Anthropic.APIError) {
    logger.error("Erreur de l'API Claude", { statut: erreur.status, detail: erreur.message });
    return new HttpsError('internal', 'Service indisponible.');
  }

  logger.error('Erreur inattendue pendant la génération', { detail: String(erreur) });
  return new HttpsError('internal', 'Service indisponible.');
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
export function extraireJson(contenu) {
  const blocsTexte = contenu.filter((bloc) => bloc.type === 'text').map((bloc) => bloc.text);

  for (const texte of blocsTexte.reverse()) {
    // Tolère un bloc de code Markdown malgré la consigne.
    const nettoye = texte
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```$/, '')
      .trim();

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
 * Demande à Claude une réponse JSON conforme à un schéma, avec recherche web.
 *
 * @param {object} options
 * @param {string} options.systeme consigne permanente
 * @param {string} options.prompt demande propre à cet appel
 * @param {object} options.schema schéma JSON de la réponse
 * @param {(donnees: object) => { valide: boolean, erreurs: string[] }} options.valider
 * @param {string} [options.effort] profondeur de raisonnement
 * @param {number} [options.maxRecherches] plafond de recherches web
 * @param {object} [options.journal] informations ajoutées aux traces
 * @returns {Promise<object>} la réponse validée
 * @throws {HttpsError}
 */
export async function demanderJson({
  systeme,
  prompt,
  schema,
  valider,
  effort = 'medium',
  maxRecherches = 6,
  journal = {},
}) {
  const client = new Anthropic({ apiKey: CLE_ANTHROPIC.value() });
  const erreursCumulees = [];

  for (let tentative = 1; tentative <= TENTATIVES; tentative += 1) {
    let reponse;

    try {
      reponse = await client.messages.create({
        model: MODELE_CLAUDE,
        max_tokens: 16000,
        system: systeme,
        messages: [{ role: 'user', content: prompt }],
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: maxRecherches }],
        output_config: { effort, format: { type: 'json_schema', schema } },
      });
    } catch (erreur) {
      throw traduireErreurApi(erreur);
    }

    // Suivi du coût (CLAUDE.md §9).
    logger.info('Appel Claude', {
      ...journal,
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
        ...journal,
        categorie: reponse.stop_details?.category,
      });
      throw new HttpsError('failed-precondition', 'Demande non traitable.');
    }

    const donnees = extraireJson(reponse.content);

    if (donnees === null) {
      erreursCumulees.push(`tentative ${tentative} : réponse non analysable`);
      continue;
    }

    const controle = valider(donnees);
    if (controle.valide) return donnees;

    erreursCumulees.push(`tentative ${tentative} : ${controle.erreurs.join(', ')}`);
  }

  logger.error('Réponse invalide après reprise', { ...journal, erreurs: erreursCumulees });
  throw new HttpsError('internal', "La demande n'a pas pu aboutir.");
}
