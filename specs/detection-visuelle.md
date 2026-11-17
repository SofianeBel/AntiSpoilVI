# Détection visuelle de GTA VI (images et vidéos)

## Objectif
Masquer une carte (tweet, vidéo YouTube, post Reddit...) quand son image ou sa vignette montre GTA VI, même sans aucun texte autour : miniature sans titre explicite, capture du jeu, logo, Jason ou Lucia, carte de Leonida.

## Décisions prises (2026-11-17)
- **Modèle visuel local** : encodeur d'image MobileCLIP-S0 (ONNX int8, 11,8 Mo, `Xenova/mobileclip_s0` `onnx/vision_model_int8.onnx`) + une petite tête (régression logistique sur l'embedding 512) entraînée sur des images de GTA VI. Pas d'OCR pour l'instant.
- **En attente du verdict : image floutée**, jamais visible nette avant d'être jugée sûre.
- **Portée : les sites de la liste** (`SITES` dans content.js), pas tout le web.

## Hors périmètre
- OCR du texte dans les images (pourra s'ajouter plus tard).
- Images hors des cartes surveillées (fond de page, avatars, emojis).
- Analyse continue d'une vidéo en lecture image par image (phase 3 au mieux : poster et une frame).
- Applis mobiles.

## Architecture
- **Content script** : repère les `img` (et posters de `video`) de plus de 100 px dans les cartes `SEL`, à l'approche de l'écran (IntersectionObserver, marge 600 px). Pose `data-asv-img=wait` (flou CSS) dans le même rAF que la découverte, donc avant le rendu. Envoie l'URL au background.
- **Background / offscreen document** (Chrome : `chrome.offscreen` ; Firefox : la page de fond MV3 a un DOM) : télécharge l'image (`host_permissions` limitées aux CDN d'images des sites listés : `i.ytimg.com`, `pbs.twimg.com`, `*.redd.it`, ...), la redimensionne en 256x256, passe dans onnxruntime-web (WASM SIMD, embarqué dans l'extension, pas de code distant), applique la tête, renvoie un score.
- **Cache** par URL (Map en mémoire + IndexedDB, limité), pour ne jamais juger deux fois la même vignette.
- Verdict : score >= seuil, la carte entière est masquée comme aujourd'hui (`data-asv=mask`) ; sinon le flou saute.
- File d'attente : une inférence à la fois, les images visibles d'abord. Délai max : au-delà de 3 s sans verdict (modèle pas chargé), l'image reste floutée avec le texte « Analyse... ».
- Le modèle (11,8 Mo) est livré dans l'extension (pas de téléchargement à l'exécution).

## Done check
1. **Hors ligne** : sur un jeu de test tenu à part (au moins 200 images GTA VI, 600 négatives dont 200 de GTA V et RDR2), précision >= 95 % et rappel >= 85 %, au seuil retenu. Script `ml/eval.py` qui imprime les chiffres.
2. **E2E** : `test/e2e.mjs` sur une page de test avec 3 cartes sans texte GTA (une image GTA VI, une GTA V, un chat) : la carte GTA VI est masquée, les deux autres non, et aucune frame ne montre l'image GTA VI nette (échantillonnage par frame comme le test de clignotement).
3. **Vrai site** : recherche YouTube « gta 6 » et un fil X, les miniatures GTA VI sans mot-clé dans le titre sont masquées.
4. **Perf** : inférence <= 80 ms par image sur un CPU 4 coeurs moyen ; le scroll d'un fil YouTube reste à 60 fps (trace Chromium, pas de tâche longue > 50 ms dans l'onglet).

## Risques
- MobileCLIP ne distingue peut-être pas bien GTA VI de GTA V (même style). La phase 2a le mesure avant toute intégration ; si la précision n'y est pas, on s'arrête là.
- Images cross-origin : le content script ne peut pas lire leurs pixels (canvas teinté), d'où le téléchargement côté background et les `host_permissions` (nouvel avertissement à l'installation).
- Taille de l'extension : ~12 Mo de modèle + ~10 Mo de runtime WASM.
- Le flou au scroll peut gêner : à juger sur le vrai site en 2b.

## Plan
- **Phase 2a, données et modèle** (`ml/`, Python) : collecter les positifs (captures et artworks officiels Rockstar, frames des trailers 1 et 2 à 1 image/s, miniatures YouTube GTA VI), les négatifs (GTA V, RDR2, autres jeux, miniatures YouTube variées, photos), calculer les embeddings MobileCLIP, entraîner la tête, `ml/eval.py`. Sortie : `model/head.json` + le rapport de précision/rappel. **Point d'arrêt** si le done check 1 échoue.
- **Phase 2b, intégration** : offscreen + ORT WASM + cache + flou + masque, sur YouTube et X d'abord, E2E (done check 2), vrai site (3), perf (4).
- **Phase 3** : posters et première frame des vidéos (X, Reddit, TikTok), Firefox, réglage on/off dans la popup.
