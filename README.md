# Anti-Spoil VI

Extension navigateur qui masque tout ce qui parle de GTA VI : vignettes YouTube, tweets, posts Reddit, messages Discord (version web), TikTok, Twitch, résultats Google, et les `<article>` de n'importe quel site.
Une page entière sur GTA VI (vidéo YouTube, tweet, article) est remplacée par un écran de blocage.

## Installer (Chrome, Edge, Brave, Opera)
1. Ouvrir `chrome://extensions`
2. Activer « Mode développeur » (en haut à droite)
3. « Charger l'extension non empaquetée » et choisir ce dossier

## Installer (Firefox)
`about:debugging#/runtime/this-firefox` puis « Charger un module temporaire » et choisir `manifest.json` (temporaire : à refaire après un redémarrage de Firefox).

## Réglages (icône de l'extension)
- On / off, et une date de coupure automatique
- Mode « bloc masqué » (clic pour afficher) ou « supprimer complètement »
- Option stricte : bloque aussi Rockstar / Take-Two
- Mots-clés en plus, et sites jamais filtrés

## Limites
- Discord : seulement sur discord.com dans le navigateur. L'appli Discord installée n'accepte pas d'extensions.
- Les applis mobiles (YouTube, X, TikTok) ne sont pas couvertes.
- Une image sans texte autour (un meme sans légende) ne peut pas être détectée.
