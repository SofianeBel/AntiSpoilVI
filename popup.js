var ids = ["enabled", "mode", "strict", "images", "until", "extra", "allow"];
function showState(on) {
  document.body.classList.toggle("off", !on);
  document.getElementById("state").textContent = on ? "Protection activée" : "Protection coupée";
}
chrome.storage.sync.get(ASV_DEFAULTS, function (s) {
  ids.forEach(function (id) {
    var el = document.getElementById(id);
    if (el.type === "checkbox") el.checked = !!s[id]; else el.value = s[id] || "";
    el.addEventListener(el.tagName === "TEXTAREA" ? "input" : "change", save);
  });
  showState(s.enabled);
});
chrome.storage.local.get({ count: 0 }, function (r) {
  document.getElementById("count").textContent = r.count.toLocaleString("fr-FR");
  document.getElementById("countLabel").textContent = r.count > 1 ? "spoils masqués" : "spoil masqué";
});
// Posts validés d'un clic : affichés partout sans masque. "Oublier" les remasque.
function showKept(n) {
  document.getElementById("kept").hidden = !n;
  document.getElementById("keptN").textContent = n + (n > 1 ? " posts validés, plus masqués" : " post validé, plus masqué");
}
chrome.storage.local.get({ kept: [] }, function (r) { showKept(r.kept.length); });
document.getElementById("forget").addEventListener("click", function () { chrome.storage.local.set({ kept: [] }, function () { showKept(0); }); });
var t = null, savedEl = document.getElementById("saved");
function save() {
  clearTimeout(t);
  showState(document.getElementById("enabled").checked);
  t = setTimeout(function () {
    var o = {};
    ids.forEach(function (id) { var el = document.getElementById(id); o[id] = el.type === "checkbox" ? el.checked : el.value; });
    chrome.storage.sync.set(o, function () {
      savedEl.textContent = "Enregistré"; savedEl.classList.add("on");
      setTimeout(function () { savedEl.textContent = ""; savedEl.classList.remove("on"); }, 1200);
    });
  }, 300);
}
