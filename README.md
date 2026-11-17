# Anti-Spoil VI

Extension navigateur qui masque tout ce qui parle de GTA VI : vignettes YouTube, tweets, posts Reddit, messages Discord (version web), TikTok, Twitch, résultats Google, et les `<article>` de n'importe quel site.
Une page entière sur GTA VI (vidéo YouTube, tweet, article) est remplacée par un écran de blocage.

## Installer (Chrome, Edge, Brave, Opera)
1. Télécharger `anti-spoil-vi.zip` dans la [dernière release](https://github.com/SofianeBel/AntiSpoilVI/releases/latest) et le dézipper.
2. Ouvrir `chrome://extensions` (`edge://extensions` sur Edge).
3. Activer « Mode développeur » (en haut à droite).
4. « Charger l'extension non empaquetée » et choisir le dossier dézippé (celui qui contient `manifest.json`).
5. Épingler l'icône pour régler l'extension. Les onglets déjà ouverts : les recharger.

Ne supprime pas le dossier après l'installation : le navigateur charge l'extension depuis là.

## Installer (Firefox 121+)
`about:debugging#/runtime/this-firefox` puis « Charger un module temporaire » et choisir `manifest.json` (temporaire : à refaire après un redémarrage de Firefox). Sur Firefox, seul le texte est filtré.

## Utilisation
- Un bloc masqué : survole-le une demi-seconde pour jeter un œil (il se remasque dès que la souris sort), clique (ou Entrée au clavier) pour l'afficher pour de bon.
- Sur mobile/tactile : un appui l'affiche.

## Réglages (icône de l'extension)
- On / off, et une date de coupure automatique
- Mode « bloc masqué » (clic pour afficher) ou « supprimer complètement »
- Option stricte : bloque aussi Rockstar / Take-Two
- Mots-clés en plus, et sites jamais filtrés

## Tout reste sur ton PC
Le modèle d'image tourne en local (onnxruntime-web). Aucune image, aucune page visitée n'est envoyée nulle part. Les réglages sont dans le stockage du navigateur.

## Tester
`node test/e2e.mjs <chemin vers node_modules/playwright>` (variable `CHROME` pour un Chromium précis). Charge l'extension dans Chromium headless sur des pages qui imitent X et YouTube et vérifie masque, aperçu, clic, clavier, popup, écran de blocage et modèle d'image (réseau requis pour les miniatures).

## Réentraîner le modèle d'image
`ml/` : `collect.py` et `collect_thumbs.py` (yt-dlp, ffmpeg), `embed.py`, `train.py`. Détails et chiffres dans `specs/detection-visuelle.md`.

## Licence
MIT. onnxruntime-web (MIT, Microsoft) dans `vendor/ort`. MobileCLIP-S0 (Apple) via l'export ONNX de Xenova.

## Limites
- Discord : seulement sur discord.com dans le navigateur. L'appli Discord installée n'accepte pas d'extensions.
- Les applis mobiles (YouTube, X, TikTok) ne sont pas couvertes.
- Images : un modèle local (MobileCLIP-S0 + une petite tête entraînée sur GTA VI) juge les miniatures et médias des sites de la liste. Il en repère environ 6 sur 10 sans aucun texte, et se trompe parfois sur des vlogs de Miami (même esthétique) ou un logo d'un autre GTA. Survoler suffit à vérifier. Désactivable dans la popup (« Analyser les images »).
- Firefox : pas de modèle d'image (l'API offscreen n'existe pas), seul le texte est filtré.
- Une image hors des sites de la liste n'est pas analysée.
