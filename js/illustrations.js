/**
 * illustrations.js — les paysages de l'application.
 *
 * Dessinés au vecteur plutôt que photographiés : quelques kilo-octets pour
 * l'ensemble, nets sur tous les écrans, et rien à demander à un hébergeur
 * d'images. L'écran d'accueil peut, lui, recevoir une vraie photo (voir
 * `photoAccueil` dans js/banniere.js) ; ces scènes lui servent alors de
 * repli.
 *
 * Deux formats, deux usages :
 *  - les bandeaux, en 400 × 120, coiffent chaque écran ;
 *  - les vignettes, en 120 × 60, remplissent les cartes de choix du séjour.
 *
 * Le vocabulaire est commun — un ciel en dégradé, un relief, un sol — pour
 * que sept paysages différents restent manifestement de la même main.
 */

/** Compteur d'identifiants de dégradés, uniques dans toute la page. */
let compteur = 0;

/**
 * Construit un dégradé vertical et renvoie de quoi l'insérer et le citer.
 *
 * Les identifiants sont numérotés : deux scènes affichées ensemble
 * emploieraient sinon le même nom, et la seconde hériterait des couleurs de
 * la première.
 *
 * @param {string} haut couleur du haut
 * @param {string} bas couleur du bas
 * @returns {{ def: string, url: string }}
 */
function degrade(haut, bas) {
  compteur += 1;
  const id = `deg${compteur}`;

  return {
    def: `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${haut}"/><stop offset="1" stop-color="${bas}"/>
    </linearGradient>`,
    url: `url(#${id})`,
  };
}

/**
 * Assemble une scène.
 *
 * @param {number} largeur largeur du repère
 * @param {number} hauteur hauteur du repère
 * @param {(d: typeof degrade) => { defs?: string, corps: string }} composer
 * @returns {string} balisage SVG
 */
function scene(largeur, hauteur, composer) {
  const { defs = '', corps } = composer(degrade);

  // Décorative : elle accompagne toujours un titre ou un libellé visible.
  return `<svg viewBox="0 0 ${largeur} ${hauteur}" preserveAspectRatio="xMidYMid slice"
    xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
    ${defs ? `<defs>${defs}</defs>` : ''}${corps}
  </svg>`;
}

/* — Bandeaux, un par étape du parcours — */

/**
 * Chaque entrée compose un paysage de 400 × 120.
 *
 * En bandeau court, seule la bande centrale du repère reste visible — environ
 * y de 14 à 106. Tout ce qui compte y tient : la ligne d'eau vers y = 70, le
 * premier plan avant y = 100, le soleil et les crêtes sous y = 20.
 */
const BANDEAUX = {
  // Accueil — la seule scène en 400 × 200 : elle coiffe la connexion, la liste
  // des voyages et la saisie, où le paysage a droit à toute sa hauteur. Les
  // autres sont des bandes, rognées de haut en bas.
  accueil: () =>
    scene(400, 200, (d) => {
      const ciel = d('#e8623a', '#ffd39b');
      const mer = d('#17a2a4', '#0a6e70');

      return {
        defs: ciel.def + mer.def,
        corps: `
          <rect width="400" height="200" fill="${ciel.url}"/>
          <circle cx="290" cy="96" r="32" fill="#fff0cf" opacity=".95"/>
          <path d="M-10 140 58 74l42 42 36-28 62 52Z" fill="#8f5570" opacity=".5"/>
          <path d="M150 140 218 80l38 32 34-24 70 52Z" fill="#6f4160" opacity=".45"/>
          <rect y="134" width="400" height="44" fill="${mer.url}"/>
          <path d="M232 146h112M252 158h84M268 168h56" stroke="#ffd7a4"
                stroke-opacity=".45" stroke-width="3" stroke-linecap="round"/>
          <path d="M0 172c66-12 132 8 200 4s130-16 200-8v32H0Z" fill="#f4d7a5"/>
          <path d="M56 194c2-30 7-50 18-68" stroke="#6b4423" stroke-width="6"
                fill="none" stroke-linecap="round"/>
          <g fill="#1d7f56">
            <path d="M76 124c-17-13-35-11-44 2 15-5 29-3 40 5Z"/>
            <path d="M76 124c17-13 35-11 44 2-15-5-29-3-40 5Z"/>
            <path d="M76 124c-4-19 2-32 17-37-9 12-12 24-10 36Z"/>
            <path d="M76 124c-15-14-17-29-8-40 1 14 5 27 11 36Z"/>
          </g>`,
      };
    }),

  // Saisie — le même couchant, en bande.
  saisie: () =>
    scene(400, 120, (d) => {
      const ciel = d('#e8623a', '#ffd39b');
      const mer = d('#17a2a4', '#0a6e70');

      return {
        defs: ciel.def + mer.def,
        corps: `
          <rect width="400" height="120" fill="${ciel.url}"/>
          <circle cx="292" cy="44" r="22" fill="#fff0cf" opacity=".95"/>
          <path d="M-10 72 58 28l40 27 36-19 60 36Z" fill="#8f5570" opacity=".5"/>
          <path d="M150 72 216 32l36 21 32-15 72 34Z" fill="#6f4160" opacity=".45"/>
          <rect y="68" width="400" height="34" fill="${mer.url}"/>
          <path d="M236 78h108M256 88h78" stroke="#ffd7a4" stroke-opacity=".45"
                stroke-width="3" stroke-linecap="round"/>
          <path d="M0 98c66-8 132 5 200 3s130-11 200-5v24H0Z" fill="#f4d7a5"/>
          <path d="M54 106c2-17 6-29 13-40" stroke="#6b4423" stroke-width="5"
                fill="none" stroke-linecap="round"/>
          <g fill="#1d7f56">
            <path d="M67 66c-13-9-27-8-34 2 11-4 23-2 31 4Z"/>
            <path d="M67 66c13-9 27-8 34 2-11-4-23-2-31 4Z"/>
            <path d="M67 66c-3-14 2-24 13-28-6 9-9 18-7 27Z"/>
            <path d="M67 66c-11-10-13-22-6-31 1 10 4 20 9 27Z"/>
          </g>`,
      };
    }),

  // Fiche — le petit matin sur des collines, quand on se renseigne.
  fiche: () =>
    scene(400, 120, (d) => {
      const ciel = d('#ffd6a0', '#fff1dc');

      return {
        defs: ciel.def,
        corps: `
          <rect width="400" height="120" fill="${ciel.url}"/>
          <circle cx="96" cy="36" r="18" fill="#ffb457" opacity=".85"/>
          <ellipse cx="250" cy="28" rx="34" ry="10" fill="#fff" opacity=".65"/>
          <ellipse cx="288" cy="34" rx="24" ry="8" fill="#fff" opacity=".5"/>
          <path d="M0 74c50-20 92 9 146-6s94 6 134-7 78-4 120 9v50H0Z" fill="#d8a86f"/>
          <path d="M0 90c58-13 104 11 160-2s96 7 142-4 66 2 98 7v29H0Z" fill="#b8854d"/>
          <path d="M330 68v-15" stroke="#8c5f36" stroke-width="4" stroke-linecap="round"/>
          <path d="M330 53c-8-2-12-6-13-11 6 3 10 5 13 8 3-3 7-5 13-8-1 5-5 9-13 11Z"
                fill="#2f7a52"/>`,
      };
    }),

  // Transport — un avion et sa traînée, au-dessus des nuages.
  transport: () =>
    scene(400, 120, (d) => {
      const ciel = d('#7ec8e8', '#ffe2bb');

      return {
        defs: ciel.def,
        corps: `
          <rect width="400" height="120" fill="${ciel.url}"/>
          <circle cx="58" cy="34" r="17" fill="#fff4d8"/>
          <path d="M120 46c22-9 44 6 66-2" stroke="#fff" stroke-opacity=".7"
                stroke-width="3" stroke-linecap="round" stroke-dasharray="10 9" fill="none"/>
          <g fill="#3d4f66" transform="translate(228 30) rotate(-12)">
            <path d="M0 8c1.6 0 2.5 1.8 2.5 4v6l12 7v3.6l-12-3.6v6.9l4 2.9v2.9L0 36l-6.5 1.7v-2.9l4-2.9v-6.9l-12 3.6V25l12-7v-6c0-2.2.9-4 2.5-4Z"/>
          </g>
          <ellipse cx="150" cy="70" rx="54" ry="15" fill="#fff" opacity=".8"/>
          <ellipse cx="206" cy="76" rx="44" ry="12" fill="#fff" opacity=".7"/>
          <ellipse cx="320" cy="66" rx="48" ry="13" fill="#fff" opacity=".65"/>
          <path d="M0 86c70-11 140 9 210-2s120-6 190 4v32H0Z" fill="#fff" opacity=".85"/>`,
      };
    }),

  // Hébergement — un village au bord de l'eau, fenêtres allumées au crépuscule.
  hebergement: () =>
    scene(400, 120, (d) => {
      const ciel = d('#f0a07a', '#ffd9b0');
      const eau = d('#3b6f86', '#27495c');

      return {
        defs: ciel.def + eau.def,
        corps: `
          <rect width="400" height="120" fill="${ciel.url}"/>
          <circle cx="330" cy="30" r="19" fill="#ffeccd" opacity=".9"/>
          <g fill="#b06a52">
            <path d="M40 70V46l20-13 20 13v24Z"/>
            <path d="M96 70V38l24-15 24 15v32Z"/>
            <path d="M160 70V50l18-12 18 12v20Z"/>
            <path d="M212 70V42l22-14 22 14v28Z"/>
            <path d="M272 70V52l16-11 16 11v18Z"/>
          </g>
          <g fill="#ffe0a6">
            <rect x="52" y="50" width="7" height="7"/><rect x="112" y="42" width="8" height="8"/>
            <rect x="128" y="56" width="8" height="8"/><rect x="172" y="54" width="7" height="7"/>
            <rect x="226" y="46" width="8" height="8"/><rect x="242" y="58" width="8" height="8"/>
            <rect x="282" y="56" width="7" height="7"/>
          </g>
          <rect y="70" width="400" height="50" fill="${eau.url}"/>
          <path d="M40 80h30M110 88h40M220 80h34M280 92h44" stroke="#ffd6a0"
                stroke-opacity=".4" stroke-width="3" stroke-linecap="round"/>`,
      };
    }),

  // Séjour — un horizon lumineux : le paysage précis dépend du type choisi,
  // que le bandeau ne connaît pas.
  tourisme: () =>
    scene(400, 120, (d) => {
      const ciel = d('#ffb067', '#ffe7c4');
      const mer = d('#1aa7a2', '#0c7a76');

      return {
        defs: ciel.def + mer.def,
        corps: `
          <rect width="400" height="120" fill="${ciel.url}"/>
          <circle cx="200" cy="50" r="26" fill="#fff3d4"/>
          <path d="M-10 68 70 36l46 25 40-17 60 24Z" fill="#c97f52" opacity=".55"/>
          <path d="M210 68 280 38l40 21 36-13 44 22Z" fill="#a9653f" opacity=".5"/>
          <rect y="66" width="400" height="54" fill="${mer.url}"/>
          <path d="M150 78h100M170 88h60M180 98h40" stroke="#ffe0b0"
                stroke-opacity=".45" stroke-width="3" stroke-linecap="round"/>`,
      };
    }),

  // Randonnées — des sommets enneigés et le sentier qui y mène.
  randos: () =>
    scene(400, 120, (d) => {
      const ciel = d('#bcdcf0', '#ffe4c2');

      return {
        defs: ciel.def,
        corps: `
          <rect width="400" height="120" fill="${ciel.url}"/>
          <circle cx="74" cy="26" r="14" fill="#fff7e6"/>
          <path d="M-10 82 90 22l52 40 34-24 108 46Z" fill="#7d8ca8"/>
          <path d="M90 22l19 15-15 11-11-9Z" fill="#fff"/>
          <path d="M176 38l15 11-11 8-10-7Z" fill="#fff"/>
          <path d="M220 82 300 36l40 27 30-16 40 35Z" fill="#5d6c87"/>
          <path d="M300 36l15 11-11 8-10-7Z" fill="#fff"/>
          <path d="M0 84h400v36H0Z" fill="#4a5872"/>
          <path d="M20 102c40-13 60 4 100-7s70 5 110-6 90 2 150 9" stroke="#e8d6b8"
                stroke-opacity=".55" stroke-width="3" stroke-linecap="round"
                stroke-dasharray="9 8" fill="none"/>`,
      };
    }),

  // Budget — l'horizon dégagé de la fin : tout est prêt.
  budget: () =>
    scene(400, 120, (d) => {
      const ciel = d('#ffc07a', '#fff0d6');

      return {
        defs: ciel.def,
        corps: `
          <rect width="400" height="120" fill="${ciel.url}"/>
          <circle cx="200" cy="70" r="36" fill="#ffc87e" opacity=".8"/>
          <circle cx="200" cy="70" r="23" fill="#fff4dd"/>
          <path d="M-10 64 66 32l44 23 34-13 56 22Z" fill="#d79a62" opacity=".5"/>
          <path d="M210 64 284 34l38 21 34-13 44 22Z" fill="#c4854c" opacity=".45"/>
          <path d="M0 82c54-9 96 7 150-2s106 7 160-2 60 2 90 5v37H0Z" fill="#e0ad72"/>
          <path d="M0 96c66-7 118 7 178-2s110 5 162-2 40 2 60 4v24H0Z" fill="#c1894f"/>
          <path d="M40 38h22M51 27v22" stroke="#fff2d6" stroke-opacity=".6"
                stroke-width="3" stroke-linecap="round"/>
          <path d="M332 28h16M340 20v16" stroke="#fff2d6" stroke-opacity=".5"
                stroke-width="3" stroke-linecap="round"/>`,
      };
    }),
};

/* — Vignettes, une par type de séjour — */

/** Chaque entrée compose un paysage de 120 × 60 pour une carte de choix. */
const VIGNETTES = {
  business: () =>
    scene(120, 60, (d) => {
      const ciel = d('#ffd9b0', '#cfe3f2');
      return {
        defs: ciel.def,
        corps: `
          <rect width="120" height="60" fill="${ciel.url}"/>
          <circle cx="96" cy="14" r="7" fill="#fff4dc"/>
          <path d="M8 60V30h12v30Zm16 0V18h14v42Zm18 0V26h10v34Zm14 0V10h12v50Zm16 0V24h12v36Zm16 0V34h12v26Z"
                fill="#35506e"/>
          <path d="M28 22h2M33 22h2M28 28h2M33 28h2M28 34h2M33 34h2M60 14h2M65 14h2M60 20h2M65 20h2M60 26h2M65 26h2M60 32h2M65 32h2"
                stroke="#ffd58a" stroke-width="2"/>
          <path d="M0 54h120v6H0Z" fill="#233a52"/>`,
      };
    }),

  'trip-liberte': () =>
    scene(120, 60, (d) => {
      const ciel = d('#ffd0a3', '#ffbe93');
      return {
        defs: ciel.def,
        corps: `
          <rect width="120" height="60" fill="${ciel.url}"/>
          <path d="M0 38c24-14 48 8 72-6s36-6 48-2v30H0Z" fill="#e0a87a"/>
          <path d="M0 48c30-8 50 6 78-2s30-2 42 0v14H0Z" fill="#c98a5d"/>
          <path d="M14 40c18 6 30-8 48-2s28 10 44 4" stroke="#fff3e0" stroke-width="2.5"
                stroke-dasharray="5 5" fill="none" stroke-linecap="round"/>
          <circle cx="14" cy="40" r="4.5" fill="#c2410c"/>
          <circle cx="106" cy="42" r="4.5" fill="#c2410c"/>`,
      };
    }),

  safari: () =>
    scene(120, 60, (d) => {
      const ciel = d('#ffc477', '#ff9a4d');
      return {
        defs: ciel.def,
        corps: `
          <rect width="120" height="60" fill="${ciel.url}"/>
          <circle cx="30" cy="24" r="13" fill="#ffe9bd"/>
          <path d="M0 42h120v18H0Z" fill="#cf9550"/>
          <path d="M0 42c34-7 66 7 120-3v5H0Z" fill="#b87f3e"/>
          <path d="M94 42V23" stroke="#4a3322" stroke-width="2.6"/>
          <path d="M78 23c2-5 8-8 16-8s14 3 16 8Z" fill="#4a3322"/>
          <path d="M38 42v-9M44 42v-9M50 42v-9M56 42v-9" stroke="#4a3322" stroke-width="2.6"/>
          <rect x="35" y="24" width="23" height="10" rx="4.5" fill="#4a3322"/>
          <path d="M55 27 62 12" stroke="#4a3322" stroke-width="3.6" stroke-linecap="round"/>
          <path d="M60 10h8l1.5 4H61Z" fill="#4a3322"/>`,
      };
    }),

  romantique: () =>
    scene(120, 60, (d) => {
      const ciel = d('#ff9d7a', '#ffd0b0');
      const mer = d('#b0466a', '#7e2f4d');
      return {
        defs: ciel.def + mer.def,
        corps: `
          <rect width="120" height="60" fill="${ciel.url}"/>
          <circle cx="88" cy="19" r="13" fill="#ffe3c8"/>
          <rect y="38" width="120" height="22" fill="${mer.url}"/>
          <path d="M78 44h40M84 50h28" stroke="#ffd9b3" stroke-opacity=".45"
                stroke-width="2" stroke-linecap="round"/>
          <path d="M26 47c-6-4-10-7-10-11a5 5 0 0 1 10-2 5 5 0 0 1 10 2c0 4-4 7-10 11Z"
                fill="#ffffff" fill-opacity=".92"/>`,
      };
    }),

  'repos-total': () =>
    scene(120, 60, (d) => {
      const ciel = d('#3b3564', '#6b4b73');
      return {
        defs: ciel.def,
        corps: `
          <rect width="120" height="60" fill="${ciel.url}"/>
          <path d="M96 11a10 10 0 1 0 9 13 8 8 0 0 1-9-13Z" fill="#ffe7b8"/>
          <circle cx="26" cy="12" r="1.4" fill="#fff"/>
          <circle cx="46" cy="20" r="1.1" fill="#fff"/>
          <circle cx="14" cy="26" r="1" fill="#fff"/>
          <circle cx="62" cy="10" r="1.2" fill="#fff"/>
          <path d="M0 44h120v16H0Z" fill="#2a2450"/>
          <path d="M0 44c40-10 80 10 120-2v4H0Z" fill="#231e46"/>`,
      };
    }),
};

/**
 * Paysage d'une étape du parcours.
 *
 * @param {string} etape nom de l'étape
 * @returns {string} balisage SVG, celui de la saisie si l'étape est inconnue
 */
export function bandeau(etape) {
  return (BANDEAUX[etape] ?? BANDEAUX.saisie)();
}

/**
 * Paysage d'un type de séjour, au format d'une carte de choix.
 *
 * @param {string} type
 * @returns {string} balisage SVG, ou chaîne vide si le type est inconnu
 */
export function vignette(type) {
  const composer = VIGNETTES[type];
  if (!composer) {
    console.warn(`Vignette inconnue : ${type}`);
    return '';
  }
  return composer();
}
