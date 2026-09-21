# CLAUDE.md — Projet MyTrip (V0 « Famille »)

## 1. Contexte

MyTrip est une app de préparation de voyage guidée. L'utilisateur saisit une destination et une durée, reçoit une fiche pratique en 10 points, puis répond à une série de questions « à tiroirs » (transport, hébergement, type de tourisme, randonnées). À la fin, l'app calcule un budget estimatif.

V0 = usage personnel et familial uniquement (quelques utilisateurs, tous avec un passeport français, interface en français).

Évolutions prévues (NE PAS implémenter en V0, mais NE JAMAIS les bloquer) :

- ouverture à un cercle élargi, puis au grand public ;
- 4 langues : FR, EN, ES, ZH ;
- liens de réservation affiliés (Travelpayouts, Booking, GetYourGuide…) ;
- publication iOS/Android via Capacitor.

Toute décision d'architecture doit permettre ces évolutions sans réécriture.

## 2. Stack technique

- **Front** : HTML / CSS / JavaScript natif, modules ES (`<script type="module">`), sans étape de build, sans framework.
- **Backend** : Firebase
  - Authentication : connexion Google uniquement.
  - Firestore : données des voyages + cache des fiches.
  - Cloud Functions (Node 20, 2nd gen) : tous les appels à l'API Claude.
- **Hébergement du front** : GitHub Pages (même fonctionnement que le projet Quittance Facile).
- **Deux environnements** : `test` (émulateurs Firebase en local) et `prod`. La config Firebase est choisie automatiquement selon l'hôte (localhost → test).
- **PWA** : `manifest.json` + service worker minimal (mise en cache des fichiers statiques) pour installation sur l'écran d'accueil du téléphone.
- **Mobile-first** : l'app est d'abord utilisée sur téléphone.

## 3. Règles d'architecture NON NÉGOCIABLES

1. **Aucune clé API dans le front.** La clé Claude est stockée dans Firebase Secret Manager (`defineSecret('ANTHROPIC_API_KEY')`) et utilisée uniquement dans les Cloud Functions. Le front appelle les fonctions via `httpsCallable`.
2. **Aucun texte d'interface en dur.** Tous les libellés passent par `t('cle')` (module `js/i18n.js`) et sont définis dans `lang/fr.json`. Seul le français existe en V0, mais la structure doit accepter `en.json`, `es.json`, `zh.json` sans modification du code.
3. **Un voyage = un objet de données unique** (voir §4). Les tiroirs lisent et écrivent cet objet via `js/voyage.js` uniquement. L'affichage ne fait que lire l'état. Sauvegarde automatique dans Firestore à chaque modification.
4. **Tous les liens de réservation sont fabriqués par `js/liens.js`.** Aucun autre fichier ne construit d'URL de réservation. Chaque partenaire a un champ `affiliateId: null` prévu pour plus tard.
5. **Cache des fiches destination.** Une fiche générée est stockée dans Firestore et réutilisée. Clé de cache : `destination normalisée + mois + langue`. Durée de validité : 30 jours.
6. **L'IA ne doit jamais inventer une URL de réservation.** Elle rédige et synthétise. Les liens de réservation viennent de `liens.js`. Les éventuels liens de sites officiels proposés par l'IA sont affichés avec la mention « à vérifier ».
7. **Réponses de l'IA en JSON strict**, validées côté fonction avant renvoi au front. En cas de JSON invalide : une nouvelle tentative, puis message d'erreur propre.
8. **Accès restreint** : seules les adresses e-mail présentes dans la collection Firestore `autorises` peuvent utiliser l'app (vérifié dans les règles Firestore ET dans chaque Cloud Function).

## 4. Modèle de données Firestore

### Collection `voyages/{voyageId}`

```json
{
  "proprietaire": "uid",
  "creeLe": "timestamp",
  "modifieLe": "timestamp",
  "langue": "fr",
  "nationalite": "FR",
  "destination": "Crète",
  "destinationNormalisee": "crete-grece",
  "jours": 10,
  "mois": 7,
  "voyageurs": { "adultes": 2, "enfants": 2 },
  "depart": "Bordeaux",
  "ficheId": "crete-grece_07_fr",
  "transport": { "mode": "avion+voiture", "notes": "" },
  "hebergement": { "type": "appartement", "filtres": ["piscine", "annulation-gratuite"] },
  "tourisme": { "type": "incontournables", "lieuxRetenus": [] },
  "randos": { "niveau": "facile", "dureeMax": "3h", "retenues": [] },
  "budget": null,
  "etapeCourante": "transport"
}
```

Valeurs possibles :

- `transport.mode` : `avion`, `bateau`, `train`, `voiture`, `avion+voiture`, `train+voiture`, `bateau+voiture`
- `hebergement.type` : `hotel`, `gite`, `appartement`, `chez-habitant`, `camping`, `camping-materiel-loue`
- `hebergement.filtres` : `petit-dejeuner`, `piscine`, `parking`, `annulation-gratuite`, `animaux`, `vue-mer`, `climatisation`, `etoiles-3`, `etoiles-4`, `etoiles-5`
- `tourisme.type` : `plage-repos`, `repos-total`, `incontournables`

### Collection `fiches/{ficheId}` (cache)

Contient le JSON de la fiche en 10 points (§6), `genereLe`, `expireLe`.

### Collections `lieux/{cleCache}` et `randos/{cleCache}` (cache)

Même principe que les fiches.

### Collection `autorises/{email}`

`{ "nom": "…", "ajouteLe": "timestamp" }`

## 5. Structure du projet

```
MyTrip/
├── CLAUDE.md
├── index.html
├── manifest.json
├── sw.js
├── css/
│   └── style.css
├── js/
│   ├── app.js              → démarrage, auth, navigation entre tiroirs
│   ├── firebase-config.js  → config test / prod selon l'hôte
│   ├── voyage.js           → lecture/écriture de l'objet voyage (seul point d'accès)
│   ├── i18n.js             → fonction t() + chargement lang/*.json
│   ├── liens.js            → TOUS les liens de réservation
│   ├── budget.js           → calcul du budget (fonction pure, testable)
│   ├── api.js              → appels aux Cloud Functions
│   └── tiroirs/
│       ├── saisie.js
│       ├── fiche.js
│       ├── transport.js
│       ├── hebergement.js
│       ├── tourisme.js
│       ├── randos.js
│       └── budget-vue.js
├── lang/
│   └── fr.json
├── data/
│   └── prises.json         → types de prises par pays (code ISO) — facultatif en V0
├── functions/
│   ├── index.js
│   ├── prompts/            → un fichier par prompt (fiche, lieux, randos)
│   ├── schemas/            → schémas JSON de validation
│   └── package.json
├── firestore.rules
└── firebase.json
```

## 6. Les tiroirs — spécifications

### Tiroir 0 — Saisie

Champs : destination (texte libre), nombre de jours, mois de départ, adultes, enfants, ville de départ. Nationalité fixée à `FR` en V0 (champ présent dans les données, non affiché). Bouton « Préparer mon voyage » → crée le document voyage puis ouvre la fiche.

### Tiroir 1 — Fiche en 10 points

Cloud Function `genererFiche({ destination, mois, langue, nationalite })`. Utilise l'API Claude avec l'outil de recherche web pour les données factuelles.

JSON attendu :

```json
{
  "destination": "Crète, Grèce",
  "codePays": "GR",
  "points": {
    "visa":        { "resume": "…", "lienOfficiel": "https://www.diplomatie.gouv.fr/fr/conseils-aux-voyageurs/…" },
    "climat":      { "resume": "…" },
    "meilleuresPeriodes": { "mois": [5, 6, 9, 10], "resume": "…" },
    "decalageHoraire":    { "heures": 1, "resume": "…" },
    "monnaie":     { "code": "EUR", "nom": "Euro", "resume": "…" },
    "langue":      { "resume": "…" },
    "prises":      { "types": ["C", "F"], "tension": "230V", "adaptateur": false },
    "vaccins":     { "obligatoires": [], "recommandes": ["…"], "resume": "…" },
    "budgetMoyen": {
      "hotelNuit":  { "eco": 50, "moyen": 90, "confort": 180 },
      "repasJour":  { "eco": 25, "moyen": 45, "confort": 80 },
      "devise": "EUR",
      "resume": "…"
    },
    "temperatureMer": { "moisChoisi": 25, "parMois": [16,16,17,18,21,24,25,26,25,23,20,18], "resume": "…" }
  },
  "sources": ["…"]
}
```

Affichage : 10 cartes compactes, dépliables. Avertissements obligatoires :

- sur Visa : « Vérifiez sur France Diplomatie avant de partir » + lien ;
- sur Vaccins : « Informations indicatives, à confirmer avec votre médecin ou un centre de vaccinations internationales ».

Si le mois choisi n'est pas dans `meilleuresPeriodes`, afficher une alerte douce.

### Tiroir 2 — Transport

Choix du mode (boutons). Selon le mode, afficher les liens générés par `liens.js` :

- avion → Google Flights, Skyscanner
- train → Trainline, SNCF Connect
- bateau → Ferryhopper, Direct Ferries
- voiture de location → DiscoverCars, Rentalcars
- voiture perso → lien itinéraire (Google Maps / ViaMichelin)

Les combos affichent les deux blocs. Champ « prix estimé du transport (€, total) » optionnel, saisi par l'utilisateur pour affiner le budget.

### Tiroir 3 — Hébergement

Choix du type + filtres (cases à cocher). Liens préremplis (destination, dates, nombre de voyageurs) :

- hôtel → Booking, Hotels.com
- appartement / gîte → Abritel, Booking, Gîtes de France (si France)
- chez l'habitant → Airbnb
- camping → recherche Booking / Pitchup ; matériel → lien de recherche location matériel

Champ optionnel « prix par nuit trouvé » pour affiner le budget.

### Tiroir 4 — Type de tourisme

- `plage-repos` → Cloud Function `genererLieux(type: "plages")` : 5 plages avec description, conseils (meilleur moment, accès, enfants).
- `repos-total` → conseils courts + rappel des filtres hébergement conseillés (piscine, spa).
- `incontournables` → `genererLieux(type: "incontournables")` : 5 lieux avec description, conseils (horaires, réservation nécessaire ou non, astuces), prix d'entrée estimé, lien officiel « à vérifier », et un lien de recherche GetYourGuide/Viator construit par `liens.js` à partir du nom du lieu.

L'utilisateur coche les lieux retenus (stockés dans `tourisme.lieuxRetenus` avec leur prix estimé).

### Tiroir 5 — Randonnées

Filtres : niveau (facile / moyen / difficile), durée max, dénivelé max, boucle oui/non, adaptée aux enfants. Cloud Function `genererRandos(destination, filtres)` : 5 randonnées avec distance, durée, dénivelé, point de départ, meilleure saison, conseils, lien de recherche (Visorando si France, sinon Komoot/AllTrails en recherche par nom — jamais d'URL inventée).

### Tiroir 6 — Budget

`budget.js` = fonction pure `calculerBudget(voyage, fiche)` qui renvoie :

```json
{
  "bas": 0, "moyen": 0, "haut": 0,
  "detail": {
    "transport": 0, "hebergement": 0, "repas": 0,
    "activites": 0, "transportLocal": 0, "annexes": 0, "imprevus": 0
  },
  "hypotheses": ["…"]
}
```

Règles :

- hébergement = nuits × prix nuit (saisi par l'utilisateur, sinon `budgetMoyen.hotelNuit` eco/moyen/confort pour bas/moyen/haut) ;
- repas = jours × personnes × `repasJour` (enfant = 0,6 × adulte) ;
- activités = somme des prix des lieux retenus × personnes ;
- transport = saisie utilisateur, sinon estimation demandée à l'IA dans la fiche (champ à ajouter si besoin) ;
- transport local = location voiture estimée × jours si mode « +voiture » ;
- imprévus = 10 % du total.

Toujours afficher les hypothèses utilisées. Mention : « Estimation indicative ».

## 7. Navigation et UX

- Les tiroirs s'enchaînent dans l'ordre, avec barre de progression et retour arrière possible.
- Chaque tiroir peut être « passé ».
- Écran d'accueil : liste des voyages de l'utilisateur (reprendre, dupliquer, supprimer).
- État de chargement clair pendant les appels IA (compter plusieurs secondes).
- Messages d'erreur compréhensibles, jamais d'erreur technique brute.
- Design sobre, lisible, gros boutons tactiles.

## 8. `liens.js` — structure attendue

```js
const PARTENAIRES = {
  booking:      { nom: 'Booking.com',   affiliateId: null, construire: (p) => '…' },
  getyourguide: { nom: 'GetYourGuide', affiliateId: null, construire: (p) => '…' },
  // …
};

export function lienReservation(partenaire, params) { /* … */ }
```

- `params` normalisé : `{ destination, dateDebut, dateFin, adultes, enfants, requete }`.
- Si `affiliateId` est renseigné (plus tard), il est ajouté automatiquement.
- Vérifier le format réel des URL de recherche de chaque site avant de coder le constructeur.

## 9. Cloud Functions — règles

- Modèle Claude défini dans une constante unique (`MODELE_CLAUDE`) pour pouvoir le changer facilement.
- Prompts dans `functions/prompts/`, jamais dans le code métier.
- Chaque prompt exige : réponse JSON uniquement, langue = paramètre `langue`, prudence sur les données réglementaires, pas d'URL inventée.
- Vérification de l'utilisateur (auth + présence dans `autorises`) au début de chaque fonction.
- Consultation du cache avant tout appel à l'API.
- Journaliser les appels (nombre de tokens) pour suivre le coût.

## 10. Conventions

- Code et commentaires en français.
- Fonctions courtes, un fichier = une responsabilité.
- Ne jamais committer de secret (`.gitignore` pour `.env`, `.runtimeconfig.json`, etc.).
- Tester d'abord en local avec les émulateurs Firebase (Auth, Firestore, Functions).
- Commits en français, clairs et atomiques.
- Avant toute modification structurante, proposer le plan et attendre validation.

## 11. Plan de travail V0 (ordre de réalisation)

1. **Socle** : structure des dossiers, `index.html`, `i18n.js` + `fr.json`, config Firebase test/prod, émulateurs. ✅ L'app s'ouvre en local, affiche un libellé via `t()`.
2. **Auth + liste blanche** : connexion Google, collection `autorises`, règles Firestore. ✅ Un e-mail non autorisé est refusé proprement.
3. **Objet voyage** : `voyage.js`, création/lecture/sauvegarde auto, écran d'accueil (liste des voyages). ✅ Créer, reprendre, supprimer un voyage.
4. **Tiroir 0 Saisie** + navigation entre tiroirs + barre de progression.
5. **Cloud Function `genererFiche`** + cache + validation JSON. ✅ Deuxième demande identique = réponse instantanée depuis le cache.
6. **Tiroir 1 Fiche** : affichage des 10 cartes + avertissements.
7. **`liens.js` + Tiroir 2 Transport.**
8. **Tiroir 3 Hébergement.**
9. **`genererLieux` + Tiroir 4 Tourisme.**
10. **`genererRandos` + Tiroir 5 Randonnées.**
11. **`budget.js`** (fonction pure, testée sur 2 ou 3 cas) + **Tiroir 6 Budget.**
12. **PWA** : manifest, icône, service worker, test d'installation sur téléphone.
13. **Déploiement prod** : GitHub Pages + Functions en prod, ajout des e-mails de la famille.

## 12. Hors périmètre V0

Ne pas développer : langues autres que le français, liens affiliés, API payantes (Sherpa, Numbeo), statistiques d'usage, bandeau cookies / RGPD complet, comptes ouverts au public, publication sur les stores, partage public de voyage, export PDF.
