/**
 * prompts/langues.js — ce que les prompts partagent au sujet de la langue.
 *
 * Les prompts sont rédigés en français ; seule la langue de la réponse
 * change. Le mois du voyage se nomme donc toujours en français dans la
 * demande, et une consigne explicite fixe la langue des textes renvoyés :
 * un simple « langue : en » au milieu d'un prompt français ne suffit pas à
 * détourner le modèle du français.
 */

/** Noms des mois, pour situer la demande dans la saison. */
export const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/** Nom de chaque langue de réponse, tel qu'il s'écrit dans un prompt français. */
const NOMS_LANGUES = {
  fr: 'français',
  en: 'anglais',
  es: 'espagnol',
  zh: 'chinois',
};

/**
 * La même consigne, écrite dans la langue visée. Mesuré le 24/09/2026 : avec
 * la seule consigne en français, une génération espagnole sur deux revenait
 * avec des descriptions vides ; la phrase dans la langue cible lève
 * l'ambiguïté.
 */
const CONSIGNES_NATIVES = {
  en: 'Write every text field of the JSON in English, in full.',
  es: 'Redacta en español todos los campos de texto del JSON, completos.',
  zh: '请用中文完整撰写 JSON 中的所有文本字段。',
};

/**
 * Consigne fixant la langue de tous les textes de la réponse.
 * @param {string} langue code de langue
 * @returns {string}
 */
export function consigneLangue(langue) {
  const nom = NOMS_LANGUES[langue] ?? NOMS_LANGUES.fr;
  const lecteur = nom === 'français' ? 'francophone' : `de langue ${nom}`;
  const native = CONSIGNES_NATIVES[langue] ? `\n${CONSIGNES_NATIVES[langue]}` : '';
  return `Langue de la réponse : rédige tous les textes du JSON en ${nom}, quelle que soit la langue de cette demande. Les noms des champs du JSON, eux, restent tels que le schéma les définit. Les noms de lieux prennent la forme usuelle pour un lecteur ${lecteur}.${native}`;
}
