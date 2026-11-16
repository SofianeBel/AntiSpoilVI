var ids = ["enabled", "mode", "strict", "until", "extra", "allow"];
chrome.storage.sync.get(ASV_DEFAULTS, function (s) {
  ids.forEach(function (id) {
    var el = document.getElementById(id);
    if (el.type === "checkbox") el.checked = !!s[id]; else el.value = s[id] || "";
    el.addEventListener(el.tagName === "TEXTAREA" ? "input" : "change", save);
  });
});
chrome.storage.local.get({ count: 0 }, function (r) { document.getElementById("count").textContent = r.count; });
var t = null;
function save() {
  clearTimeout(t);
  t = setTimeout(function () {
    var o = {};
    ids.forEach(function (id) { var el = document.getElementById(id); o[id] = el.type === "checkbox" ? el.checked : el.value; });
    chrome.storage.sync.set(o);
  }, 300);
}
