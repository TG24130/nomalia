/**
 * synthese.js — fiche de synthèse du voyage, imprimable en PDF.
 *
 * Rassemble sur une seule page ce que le parcours a construit : le voyage,
 * la fiche pratique, puis chaque poste retenu avec son budget. L'impression
 * passe par celle du navigateur (« Enregistrer au format PDF »), sans
 * bibliothèque : la feuille de style n'imprime que cette fiche.
 *
 * Fonction pure d'affichage : elle ne lit que le voyage, la fiche et le
 * budget qu'on lui donne.
 */

import { echapper, langue, t } from './i18n.js';
import { POINTS, apercu, contenu } from './tiroirs/fiche.js';
import { datesVoyage } from './voyage.js';

/**
 * Met en forme un montant en euros.
 * @param {number} montant
 * @returns {string}
 */
function euros(montant) {
  try {
    return new Intl.NumberFormat(langue(), {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(montant);
  } catch {
    return `${Math.round(montant)} €`;
  }
}

/**
 * Met en forme une date ISO.
 * @param {string} date AAAA-MM-JJ
 * @returns {string}
 */
function formaterDate(date) {
  try {
    return new Intl.DateTimeFormat(langue(), { dateStyle: 'long' }).format(
      new Date(`${date}T12:00:00Z`)
    );
  } catch {
    return date;
  }
}

/**
 * Montant moyen d'un poste, avec sa fourchette quand elle s'écarte.
 * @param {{ bas: number, moyen: number, haut: number }} poste
 * @returns {string}
 */
function montantPoste(poste) {
  if (!poste || poste.moyen <= 0) return t('synthese.nonEstime');
  if (poste.bas === poste.haut) return euros(poste.moyen);
  return t('synthese.montantFourchette', {
    moyen: euros(poste.moyen),
    bas: euros(poste.bas),
    haut: euros(poste.haut),
  });
}

/**
 * Une section de la fiche.
 * @param {string} titre
 * @param {string} corps HTML déjà échappé
 * @returns {string}
 */
function section(titre, corps) {
  return `
    <section class="synthese__section">
      <h3>${echapper(titre)}</h3>
      ${corps}
    </section>
  `;
}

/**
 * Ligne « libellé : valeur ».
 * @param {string} libelle
 * @param {string} valeur
 * @returns {string}
 */
function ligne(libelle, valeur) {
  return `<p><strong>${echapper(libelle)} :</strong> ${echapper(valeur)}</p>`;
}

/** En-tête : où, quand, qui, quel séjour. */
function entete(voyage) {
  const { dateDebut, dateFin } = datesVoyage(voyage);
  const adultes = voyage.voyageurs?.adultes ?? 0;
  const enfants = voyage.voyageurs?.enfants ?? 0;

  const quand = dateDebut
    ? t('synthese.du', { debut: formaterDate(dateDebut), fin: formaterDate(dateFin) })
    : voyage.mois
      ? t(`mois.${voyage.mois}`)
      : t('synthese.nonRenseigne');

  return `
    <header class="synthese__entete">
      <img class="synthese__logo" src="icons/logo-nomalia.png" width="640" height="560"
           alt="${echapper(t('app.nom'))}">
      <div>
        <p class="synthese__surtitre">${echapper(t('synthese.titre'))}</p>
        <h2 class="synthese__destination">${echapper(voyage.destination ?? '')}</h2>
      </div>
    </header>
    <section class="synthese__section">
      ${ligne(t('synthese.dates'), quand)}
      ${ligne(t('synthese.duree'), t('synthese.jours', { nombre: voyage.jours ?? '?' }))}
      ${ligne(
        t('synthese.voyageurs'),
        t('synthese.voyageursDetail', { adultes, enfants })
      )}
      ${ligne(
        t('synthese.typeSejour'),
        voyage.tourisme?.type ? t(`tourisme.type.${voyage.tourisme.type}`) : t('synthese.nonRenseigne')
      )}
    </section>
  `;
}

/** Les dix points de la fiche pratique, dépliés. */
function fichePratique(voyage, fiche) {
  if (!fiche?.points) return section(t('fiche.titre'), `<p>${echapper(t('synthese.ficheAbsente'))}</p>`);

  const points = POINTS.filter((nom) => fiche.points[nom])
    .map((nom) => {
      const point = fiche.points[nom];
      const resume = apercu(nom, point, voyage);
      return `
        <div class="synthese__point">
          <h4>${echapper(t(`fiche.${nom}`))}${resume ? ` — ${echapper(resume)}` : ''}</h4>
          ${contenu(nom, point, voyage)}
        </div>
      `;
    })
    .join('');

  return section(t('fiche.titre'), points);
}

/** Transport retenu et son coût. */
function transport(voyage, budget) {
  const mode = voyage.transport?.mode;
  if (!mode) return section(t('parcours.transport'), `<p>${echapper(t('synthese.nonRenseigne'))}</p>`);

  const surPlace = budget.detail.transportLocal;
  return section(
    t('parcours.transport'),
    [
      ligne(t('synthese.mode'), t(`transport.mode.${mode}`)),
      ligne(t('synthese.budgetTrajet'), montantPoste(budget.detail.transport)),
      surPlace.moyen > 0 ? ligne(t('budget.detail.transportLocal'), montantPoste(surPlace)) : '',
    ].join('')
  );
}

/** Hébergement retenu, ses critères et son coût. */
function hebergement(voyage, budget) {
  const type = voyage.hebergement?.type;
  if (!type) return section(t('parcours.hebergement'), `<p>${echapper(t('synthese.nonRenseigne'))}</p>`);

  const filtres = voyage.hebergement?.filtres ?? [];
  return section(
    t('parcours.hebergement'),
    [
      ligne(t('synthese.type'), t(`hebergement.type.${type}`)),
      filtres.length
        ? ligne(t('synthese.criteres'), filtres.map((f) => t(`hebergement.filtre.${f}`)).join(', '))
        : '',
      ligne(t('synthese.budgetMoyen'), montantPoste(budget.detail.hebergement)),
    ].join('')
  );
}

/** Lieux et activités retenus. */
function activites(voyage, budget) {
  const lieux = voyage.tourisme?.lieuxRetenus ?? [];
  const liste = lieux.length
    ? `<ul>${lieux
        .map(
          (lieu) =>
            `<li>${echapper(lieu.nom)}${
              typeof lieu.prixEntree === 'number'
                ? ` — ${echapper(t('synthese.parPersonne', { montant: euros(lieu.prixEntree) }))}`
                : ''
            }</li>`
        )
        .join('')}</ul>`
    : `<p>${echapper(t('synthese.aucuneActivite'))}</p>`;

  return section(
    t('synthese.activites'),
    liste + (lieux.length ? ligne(t('synthese.budgetMoyen'), montantPoste(budget.detail.activites)) : '')
  );
}

/** Randonnées retenues. */
function randonnees(voyage) {
  const retenues = voyage.randos?.retenues ?? [];
  if (!retenues.length) {
    return section(t('parcours.randos'), `<p>${echapper(t('synthese.aucuneRando'))}</p>`);
  }

  const items = retenues
    .map((rando) => {
      const chiffres = [
        Number.isFinite(rando.distanceKm) ? t('randos.distanceValeur', { km: rando.distanceKm }) : null,
        Number.isFinite(rando.dureeHeures)
          ? `${new Intl.NumberFormat(langue(), { maximumFractionDigits: 1 }).format(rando.dureeHeures)} h`
          : null,
        Number.isFinite(rando.deniveleM) ? t('randos.deniveleValeur', { m: rando.deniveleM }) : null,
        rando.niveau ? t(`randos.niveaux.${rando.niveau}`) : null,
      ].filter(Boolean);

      return `
        <li>
          <strong>${echapper(rando.nom)}</strong> — ${echapper(chiffres.join(' · '))}
          ${rando.pointDepart ? `<br>${echapper(t('randos.depart'))} : ${echapper(rando.pointDepart)}` : ''}
        </li>
      `;
    })
    .join('');

  return section(t('parcours.randos'), `<ul>${items}</ul>`);
}

/** Récapitulatif du budget. */
function recapBudget(budget) {
  const postes = ['repas', 'annexes', 'imprevus']
    .filter((poste) => budget.detail[poste].moyen > 0)
    .map((poste) => ligne(t(`budget.detail.${poste}`), montantPoste(budget.detail[poste])))
    .join('');

  return section(
    t('synthese.budgetTotal'),
    `
      <p class="synthese__total">${echapper(euros(budget.moyen))}</p>
      <p>${echapper(t('fin.budgetFourchette', { bas: euros(budget.bas), haut: euros(budget.haut) }))}</p>
      ${postes}
      <p class="note">${echapper(t('budget.mention'))}</p>
    `
  );
}

/**
 * Construit la fiche de synthèse.
 *
 * @param {object} voyage
 * @param {object|null} fiche fiche destination (peut manquer)
 * @param {object} budget résultat de calculerBudget
 * @returns {string} HTML
 */
export function construireSynthese(voyage, fiche, budget) {
  return `
    <article class="synthese" id="synthese">
      ${entete(voyage)}
      ${fichePratique(voyage, fiche)}
      ${transport(voyage, budget)}
      ${hebergement(voyage, budget)}
      ${activites(voyage, budget)}
      ${randonnees(voyage)}
      ${recapBudget(budget)}
    </article>
  `;
}
