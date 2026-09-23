/**
 * serveur.mjs — serveur statique de développement.
 *
 * Usage : node scripts/serveur.mjs [port]
 *
 * Remplace `python -m http.server`, qui laisse le navigateur garder en cache
 * les modules ES : une modification de js/tiroirs/… n'était pas reprise au
 * rechargement, ce qui donne l'impression que le code n'a pas changé. Ici
 * chaque réponse porte `Cache-Control: no-store`.
 *
 * Réservé au développement : en production, le site est servi par GitHub
 * Pages et le service worker gère le cache.
 */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const port = Number(process.argv[2] ?? 5500);

/** Types MIME des fichiers servis par l'application. */
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
};

const serveur = http.createServer((requete, reponse) => {
  const chemin = decodeURIComponent(new URL(requete.url, `http://${requete.headers.host}`).pathname);
  const relatif = chemin === '/' ? 'index.html' : chemin.replace(/^\/+/, '');
  const fichier = path.join(racine, relatif);

  // Un chemin qui remonte hors du projet est refusé.
  if (!fichier.startsWith(racine)) {
    reponse.writeHead(403).end('Accès refusé');
    return;
  }

  fs.readFile(fichier, (erreur, contenu) => {
    if (erreur) {
      reponse.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Introuvable');
      return;
    }

    reponse.writeHead(200, {
      'Content-Type': TYPES[path.extname(fichier).toLowerCase()] ?? 'application/octet-stream',
      // Sans cela, le navigateur garde les modules ES d'une session à l'autre.
      'Cache-Control': 'no-store, must-revalidate',
    });
    reponse.end(contenu);
  });
});

serveur.listen(port, '127.0.0.1', () => {
  console.log(`NOMALIA servi sur http://127.0.0.1:${port} (sans cache)`);
});
