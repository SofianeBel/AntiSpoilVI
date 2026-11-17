// Liste partagée entre le content script et la popup.
var ASV_DEFAULTS = {
  enabled: true,
  mode: "mask",          // "mask" = bloc grisé cliquable, "hide" = disparaît complètement
  strict: false,         // ajoute Rockstar, Take-Two, etc. (plus de faux positifs)
  until: "",             // date AAAA-MM-JJ après laquelle le filtre se coupe tout seul
  extra: "",             // mots-clés perso, un par ligne
  allow: "",             // sites jamais filtrés, un par ligne
  images: true           // juge aussi les miniatures avec le modèle d'image local
};

var ASV_KEYWORDS = [
  "GTA 6", "GTA VI", "GTAVI", "GTA Six", "Grand Theft Auto 6", "Grand Theft Auto VI",
  "Leonida", "Vice City", "Port Gellhorn", "Grassrivers", "Mount Kalaga", "Leonida Keys", "Ambrosia Sugar",
  "Jason Duval", "Lucia Caminos", "Cal Hampton", "Boobie Ike", "Dre'Quan", "DreQuan", "Real Dimez",
  "Raul Bautista", "Brian Heder", "Only Raw Records", "Macca the Gator"
];
var ASV_STRICT = ["Rockstar Games", "Rockstar", "Take-Two", "R* Games"];

function asvBuildRegex(settings) {
  var words = ASV_KEYWORDS.slice();
  if (settings.strict) words = words.concat(ASV_STRICT);
  (settings.extra || "").split(/\r?\n/).forEach(function (w) { w = w.trim(); if (w) words.push(w); });
  var parts = words.map(function (w) {
    return w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/'/g, "['’]?")
      .replace(/\s+/g, "[\\s\\-_.]*");
  });
  // Hashtags (#GTA6) passent aussi. Les bornes évitent "GTA 60" ou "Vice Cityzen".
  return new RegExp("(?<![\\p{L}\\p{N}])(?:" + parts.join("|") + ")(?![\\p{L}\\p{N}])", "iu");
}
