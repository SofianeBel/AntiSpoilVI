// Relais entre le content script et le document offscreen qui fait tourner le modèle d'image.
// Firefox n'a pas d'offscreen : la réponse est {score: null} et l'image n'est pas jugée (le texte reste filtré).
var creating = null;
function ensureOffscreen() {
  if (!chrome.offscreen) return Promise.reject(new Error("pas d'offscreen"));
  if (creating) return creating;
  creating = chrome.offscreen.hasDocument().then(function (has) {
    if (has) return;
    return chrome.offscreen.createDocument({ url: "offscreen.html", reasons: ["WORKERS"], justification: "Modèle d'image local qui repère GTA VI dans les miniatures" });
  }).catch(function (e) { creating = null; throw e; });
  return creating;
}
chrome.runtime.onMessage.addListener(function (msg, sender, reply) {
  if (!msg || msg.t !== "asv-img") return;
  ensureOffscreen()
    .then(function () { return chrome.runtime.sendMessage({ target: "asv-offscreen", url: msg.url }); })
    .then(function (r) { reply(r || { score: null }); }, function () { reply({ score: null }); });
  return true;
});
