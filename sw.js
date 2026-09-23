/**
 * sw.js — service worker.
 *
 * Met en cache les fichiers statiques pour permettre l'installation sur
 * l'écran d'accueil et un démarrage rapide. Aucune donnée Firestore n'est
 * mise en cache ici : le SDK Firebase gère sa propre persistance.
 *
 * Incrémenter VERSION_CACHE à chaque mise en ligne pour forcer la mise à jour.
 */

const VERSION_CACHE = 'nomalia-v2';

/**
 * Fichiers mis en cache dès l'installation.
 *
 * Les tables data/*.json en sont exclues : elles pèsent un demi-mégaoctet à
 * elles deux et ne servent qu'au tiroir Transport. Elles sont mises en cache
 * à la première utilisation, comme le reste.
 */
const FICHIERS_STATIQUES = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './js/i18n.js',
  './js/firebase-config.js',
  './js/voyage.js',
  './js/liens.js',
  './js/icones.js',
  './js/attente.js',
  './js/recapitulatif.js',
  './js/illustrations.js',
  './js/banniere.js',
  './js/sejours.js',
  './js/prechargement.js',
  './js/cartes-choix.js',
  './js/api.js',
  './js/budget.js',
  './js/aeroports.js',
  './js/gares.js',
  './js/recherche-lieux.js',
  './js/tiroirs/saisie.js',
  './js/tiroirs/fiche.js',
  './js/tiroirs/transport.js',
  './js/tiroirs/hebergement.js',
  './js/tiroirs/tourisme.js',
  './js/tiroirs/randos.js',
  './js/tiroirs/budget-vue.js',
  './lang/fr.json',
  // Photos des bandeaux : 420 ko à elles trois, mises en cache dès
  // l'installation parce qu'elles s'affichent sur le premier écran.
  './images/accueil.jpg',
  './images/etape-randos.jpg',
  './images/etape-tourisme.jpg',
  './icons/icone-192.png',
  './icons/icone-512.png',
  './icons/icone-maskable-512.png',
  './icons/icone-apple-180.png',
  './icons/favicon-32.png',
];

self.addEventListener('install', (evenement) => {
  evenement.waitUntil(
    caches
      .open(VERSION_CACHE)
      // addAll échoue en bloc si un seul fichier manque : on les ajoute un par
      // un pour qu'une icône absente n'empêche pas l'installation.
      .then((cache) =>
        Promise.all(
          FICHIERS_STATIQUES.map((fichier) =>
            cache.add(fichier).catch((erreur) => {
              console.warn('Fichier non mis en cache', fichier, erreur);
            })
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (evenement) => {
  evenement.waitUntil(
    caches
      .keys()
      .then((cles) =>
        Promise.all(cles.filter((cle) => cle !== VERSION_CACHE).map((cle) => caches.delete(cle)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (evenement) => {
  const requete = evenement.request;

  // Seules les requêtes GET de même origine sont servies par le cache.
  if (requete.method !== 'GET') return;
  if (new URL(requete.url).origin !== self.location.origin) return;

  // Réseau d'abord, cache en secours : évite de servir une version périmée.
  evenement.respondWith(
    fetch(requete)
      .then((reponse) => {
        const copie = reponse.clone();
        caches.open(VERSION_CACHE).then((cache) => cache.put(requete, copie));
        return reponse;
      })
      .catch(async () => {
        const enCache = await caches.match(requete);
        if (enCache) return enCache;

        // Hors ligne sur une navigation : on renvoie la page d'accueil, seule
        // entrée de l'application.
        if (requete.mode === 'navigate') {
          const accueil = await caches.match('./index.html');
          if (accueil) return accueil;
        }

        return Response.error();
      })
  );
});
