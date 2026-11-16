# Anti-Spoil VI

Extension navigateur MV3 (Chrome, Edge, Brave, Opera, Firefox 115+) qui masque ce qui parle de GTA VI. JS vanilla, aucune dépendance, aucun build.

## Fichiers
- `content.js` : content script sur toutes les pages. Sélecteurs par site (`SITES`), masque, aperçu au survol, écran de blocage.
- `content.css` : look du bloc masqué et de l'écran de blocage (style "plage pastel" : sable #f7e4c8, scotch menthe, palmier rose).
- `keywords.js` : mots-clés et réglages par défaut, partagés entre le content script et la popup.
- `popup.*` : réglages, sauvegardés dans `chrome.storage.sync`.

## Lancer
`chrome://extensions` > Mode développeur > Charger l'extension non empaquetée > ce dossier. Après une modif : bouton recharger, puis recharger l'onglet.

## Tester
`node test/e2e.mjs C:/Users/sifly/Documents/Projets/Horizon/node_modules/playwright` avec `CHROME=C:/Users/sifly/AppData/Local/ms-playwright/chromium-1255/chrome-win64/chrome.exe` (`SHOTS=<dossier>` pour les captures). Chromium headless, page `test/fake-x.html` qui imite X. Doit rester tout vert.

## Règles
- Masquer avec l'attribut `data-asv`, jamais avec une classe : React (X, Reddit) réécrit `className` et effaçait le masque.
- Perf : le script tourne sur toutes les pages. Rien qui parcourt tout le DOM ou tous les blocs à chaque mutation ; lectures de layout groupées avant les écritures.
- Ne jamais montrer un spoil, même une frame : le travail passe par `requestAnimationFrame`, avant le rendu.
- Textes de l'UI en français, sans em-dash.
- Commits : pas de co-auteur, pas de signature, pas de trailer Claude.
