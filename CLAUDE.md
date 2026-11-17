# Anti-Spoil VI

Extension navigateur MV3 (Chrome, Edge, Brave, Opera, Firefox 115+) qui masque ce qui parle de GTA VI. JS vanilla, aucune dépendance, aucun build.

## Fichiers
- `content.js` : content script sur toutes les pages. Sélecteurs par site (`SITES`), masque, aperçu au survol, écran de blocage.
- `content.css` : look du bloc masqué et de l'écran de blocage (style "plage pastel" : sable #f7e4c8, scotch menthe, palmier rose).
- `keywords.js` : mots-clés et réglages par défaut, partagés entre le content script et la popup.
- `popup.*` : réglages, sauvegardés dans `chrome.storage.sync`.
- `background.js` + `offscreen.*` : modèle d'image (onnxruntime-web dans `vendor/ort`, `model/vision.onnx` MobileCLIP-S0 fp32, tête `model/head.bin`). Le content script floute la miniature (`data-asv-img=wait`) jusqu'au verdict.
- `ml/` : collecte, embeddings, entraînement, `ml/score.py` = référence Python des scores (le test vérifie que le JS donne pareil). Données dans `ml/data/` hors Git.

## Lancer
`chrome://extensions` > Mode développeur > Charger l'extension non empaquetée > ce dossier. Après une modif : bouton recharger, puis recharger l'onglet.

## Tester
`node test/e2e.mjs C:/Users/sifly/Documents/Projets/Horizon/node_modules/playwright` avec `CHROME=C:/Users/sifly/AppData/Local/ms-playwright/chromium-1255/chrome-win64/chrome.exe` (`SHOTS=<dossier>` pour les captures). Chromium headless, pages `test/fake-x.html` (imite X) et `test/fake-yt.html` (imite YouTube : grille imbriquée, lecteur de prévisualisation `#video-preview` hors de la carte). Doit rester tout vert.

## En cours
`specs/detection-visuelle.md` : détection visuelle intégrée (phase 2b). Reste : Firefox, vidéos en lecture, seuil réglable (faux positifs sur les vlogs de Miami).

## Règles modèle
- Garder le fp32 : l'int8 est 18x plus lent sur CPU.
- Prétraitement JS = PIL BILINEAR à l'identique (`offscreen.js` resize), sinon les scores dérivent jusqu'à 0,1.

## Règles
- Masquer avec l'attribut `data-asv`, jamais avec une classe : React (X, Reddit) réécrit `className` et effaçait le masque.
- Perf : le script tourne sur toutes les pages. Rien qui parcourt tout le DOM ou tous les blocs à chaque mutation ; lectures de layout groupées avant les écritures.
- Ne jamais montrer un spoil, même une frame : le travail passe par `requestAnimationFrame`, avant le rendu.
- Textes de l'UI en français, sans em-dash.
- Commits : pas de co-auteur, pas de signature, pas de trailer Claude.
