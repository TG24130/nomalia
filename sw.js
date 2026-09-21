/**
 * sw.js — service worker minimal.
 *
 * Met en cache les fichiers statiques pour permettre l'installation sur
 * l'écran d'accueil et un démarrage rapide. Aucune donnée Firestore n'est
 * mise en cache ici : le SDK Firebase gère sa propre persistance.
 *
 * Incrémenter VERSION_CACHE à chaque mise en ligne pour forcer la mise à jour.
 */

const VERSION_CACHE = 'mytrip-v1';

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
  './js/api.js',
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
];

self.addEventListener('install', (evenement) => {
  evenement.waitUntil(
    caches
      .open(VERSION_CACHE)
      .then((cache) => cache.addAll(FICHIERS_STATIQUES))
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
      .catch(() => caches.match(requete))
  );
});
