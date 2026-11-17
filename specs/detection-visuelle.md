# Détection visuelle de GTA VI (images et vidéos)

## Objectif
Masquer une carte (tweet, vidéo YouTube, post Reddit...) quand son image ou sa vignette montre GTA VI, même sans aucun texte autour : miniature sans titre explicite, capture du jeu, logo, Jason ou Lucia, carte de Leonida.

## Décisions prises (2026-11-17)
- **Modèle visuel local** : encodeur d'image MobileCLIP-S0 en **fp32** (45 Mo, `Xenova/mobileclip_s0` `onnx/vision_model.onnx`, gardé hors Git dans `model/vision.onnx`). L'int8 (11,8 Mo) a été écarté : 659 ms par image sur un coeur contre 37 ms en fp32 (16 ms sur 4 coeurs), onnxruntime sert mal sa quantification dynamique. Tête : MLP 1024 -> 256 -> 1 sur deux vues concaténées (recadrage central + image entière écrasée, car le recadrage coupe le logo posé sur le côté des miniatures). Pas d'OCR pour l'instant.
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

## Résultats phase 2a (2026-11-17)
Données (`ml/collect.py`, `ml/collect_thumbs.py`, hors Git) : 6 278 images.
- Positives 1 529 : Extended Look (re-upload, l'officiel demande une connexion), trailers 1, 2, lancement, Features, Pre-Load, 101 captures officielles locales (`Documents/gta6_gallery`, `Documents/gtadiscord`), 498 miniatures de recherches « GTA 6 » (~6 % de bruit estimé à l'oeil).
- Négatives 4 749 : GTA V (trailers + gameplay), GTA Online, RDR2, Saints Row, Forza Horizon 5, Far Cry 6, Cyberpunk, Mafia, vrai Miami en drone, 2 615 miniatures variées dont vraie Floride, GTA V moddé, démos UE5.

Validation croisée par source (une vidéo ou une série d'images n'est jamais à la fois en entraînement et en test), `python ml/train.py` :
- **Miniatures (domaine de l'extension), seuil 0,87 : précision 95,4 %, rappel 62,2 %, 15 faux positifs / 2 615.**
- Captures officielles : ~73 % reconnues au seuil 0,9.
- Frames de vidéo : mauvais (précision ~84 % au mieux). Une frame de gameplay photoréaliste ressemble à une vraie photo de Floride pour ce modèle.
- Faux positifs restants : surtout des vlogs de Miami et de Floride (plages, néons roses, voitures custom), un logo GTA Online. Le modèle a appris l'esthétique GTA VI, qui est celle de Miami.

Done check 1 : précision atteinte sur les miniatures, rappel en dessous de l'objectif (62 % contre 85 %). Décision attendue : intégrer tel quel (complément du texte) ou améliorer le rappel d'abord.

## Résultats phase 2b (2026-11-17, intégré tel quel au seuil 0,87)
- E2E : miniature GTA VI sans mot-clé masquée en ~1 s après la navigation (chargement du modèle compris), 0 frame nette avant le verdict, carte recyclée sûre puis GTA jamais nette, scores JS = Python à 0,0003 près.
- Une miniature jugée en ~165 ms (téléchargement compris), hors de l'onglet. Vrai YouTube : 0 tâche longue en scrollant.
- Vrai YouTube, recherche « miami vlog » : 2 à 4 vlogs sur 20 masqués à tort selon les résultats. La miniature du trailer officiel de GTA V score 0,92 (logo).
- Firefox : texte seulement (pas d'offscreen), manifest compatible 121+.

## Plan
- **Phase 2a, données et modèle** (`ml/`, Python) : collecter les positifs (captures et artworks officiels Rockstar, frames des trailers 1 et 2 à 1 image/s, miniatures YouTube GTA VI), les négatifs (GTA V, RDR2, autres jeux, miniatures YouTube variées, photos), calculer les embeddings MobileCLIP, entraîner la tête, `ml/eval.py`. Sortie : `model/head.json` + le rapport de précision/rappel. **Point d'arrêt** si le done check 1 échoue.
- **Phase 2b, intégration** : offscreen + ORT WASM + cache + flou + masque, sur YouTube et X d'abord, E2E (done check 2), vrai site (3), perf (4).
- **Phase 3** : posters et première frame des vidéos (X, Reddit, TikTok), Firefox, réglage on/off dans la popup.
