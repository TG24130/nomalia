/**
 * pays.js — liste des nationalités proposées à la saisie.
 *
 * Seuls les codes ISO 3166-1 sont écrits ici : leurs noms viennent du
 * navigateur (Intl.DisplayNames), dans la langue de l'interface. Aucune
 * traduction à tenir à jour pour 249 pays.
 */

import { echapper, langue } from './i18n.js';

/** Nationalités les plus probables, proposées en tête de liste. */
const FREQUENTS = ['FR', 'BE', 'CH', 'LU', 'CA', 'GB', 'IE', 'US', 'ES', 'MX', 'AR', 'CO', 'DE', 'IT', 'PT'];

/** Tous les codes ISO 3166-1 alpha-2 attribués. */
const TOUS = `AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM
BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK
DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT
GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW
KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV
MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA
RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ
TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW`.split(/\s+/);

/**
 * Nom d'un pays dans la langue de l'interface.
 * @param {string} code ISO 3166-1 alpha-2
 * @returns {string}
 */
export function nomPays(code) {
  try {
    return new Intl.DisplayNames([langue()], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Index « nom de pays normalisé → code », construit à la première demande. */
let indexNoms = null;

/**
 * Reconnaît un nom de pays, en français, en anglais ou en espagnol.
 *
 * @param {string} texte saisie de l'utilisateur
 * @param {(texte: string) => string} normaliser même normalisation que l'appelant
 * @returns {string|null} code ISO, ou null si le texte ne nomme pas un pays
 */
export function paysDepuisNom(texte, normaliser) {
  if (!indexNoms) {
    indexNoms = new Map();
    for (const locale of ['fr', 'en', 'es']) {
      try {
        const noms = new Intl.DisplayNames([locale], { type: 'region' });
        for (const code of TOUS) indexNoms.set(normaliser(noms.of(code)), code);
      } catch {
        // Locale indisponible : les autres suffisent.
      }
    }
  }
  return indexNoms.get(normaliser(texte)) ?? null;
}

/**
 * Options du sélecteur de nationalité : les plus fréquentes, puis toutes,
 * par ordre alphabétique dans la langue courante.
 *
 * @param {string} choisi code sélectionné
 * @param {{ frequents: string, tous: string }} titres libellés des deux groupes
 * @returns {string} HTML
 */
export function optionsPays(choisi, titres) {
  const option = (code) =>
    `<option value="${code}"${code === choisi ? ' selected' : ''}>${echapper(nomPays(code))}</option>`;

  const collation = new Intl.Collator(langue());
  const tries = [...TOUS].sort((a, b) => collation.compare(nomPays(a), nomPays(b)));

  // Un pays fréquent apparaît dans les deux groupes : seule sa première
  // occurrence porte la sélection.
  const tousSansDoublonSelectionne = tries
    .map((code) => (FREQUENTS.includes(code) ? option(code).replace(' selected', '') : option(code)))
    .join('');

  return `
    <optgroup label="${echapper(titres.frequents)}">${FREQUENTS.map(option).join('')}</optgroup>
    <optgroup label="${echapper(titres.tous)}">${tousSansDoublonSelectionne}</optgroup>
  `;
}
