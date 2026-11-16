(function () {
  "use strict";
  var host = location.hostname.replace(/^www\./, "");

  // Conteneurs à masquer par site. Ailleurs : les <article>.
  var SITES = [
    { re: /(^|\.)youtube\.com$/, sel: "ytd-rich-item-renderer,ytd-video-renderer,ytd-compact-video-renderer,ytd-grid-video-renderer,ytd-reel-item-renderer,ytd-playlist-renderer,ytd-channel-renderer,ytd-comment-thread-renderer,ytd-post-renderer,ytd-notification-renderer,yt-lockup-view-model,ytm-shorts-lockup-view-model,ytd-universal-watch-card-renderer,ytd-search-refinement-card-renderer,yt-page-header-view-model,yt-page-header-renderer,ytd-c4-tabbed-header-renderer", page: /^\/(watch|shorts\/)/ },
    { re: /(^|\.)(x|twitter)\.com$/, sel: "article,[data-testid=trend],[data-testid=UserCell],[data-testid=typeaheadResult]", page: /\/status\// },
    { re: /(^|\.)reddit\.com$/, sel: "shreddit-post,shreddit-comment,article,[data-testid=post-container],faceplate-tracker[noun=trending_search],reddit-recent-pages li", page: /\/comments\// },
    { re: /(^|\.)discord\.com$/, sel: "li[id^=chat-messages-],[data-list-item-id^=channels___],[data-list-item-id^=guildsnav___],[class*=threadSidebar] li,[class*=searchResult]", page: null },
    { re: /(^|\.)tiktok\.com$/, sel: "[data-e2e=recommend-list-item-container],[data-e2e=search_top-item],[data-e2e=search_video-item],[data-e2e=comment-level-1],[data-e2e=user-post-item],article", page: /\/video\// },
    { re: /(^|\.)twitch\.tv$/, sel: "article,[data-a-target=card],.chat-line__message", page: null },
    { re: /(^|\.)instagram\.com$/, sel: "article,[role=button]:has(img)", page: null },
    { re: /(^|\.)google\.[a-z.]+$/, sel: ".MjjYud,.g,g-inner-card,.WlydOe,[data-attrid=title]", page: null }
  ];
  var site = SITES.filter(function (s) { return s.re.test(host); })[0];
  var SEL = site ? site.sel : "article";

  var settings = null, rx = null, active = false;
  var seen = new WeakMap();      // élément -> texte déjà analysé
  var revealed = new WeakMap();  // élément -> identité (lien) affichée volontairement
  var pending = new Set(), scheduled = false, fullScan = false;
  var masked = 0, wallOpenFor = null, wallDismissed = null;
  var maskedEls = new Set();     // blocs masqués, pour remettre le masque si le site l'enlève
  var peekTimer = null, peekEl = null;
  var PEEK_DELAY = 350;
  var toSize = [];               // blocs fraîchement masqués dont on mesure la hauteur en une passe          // un passage de souris en scrollant ne doit pas spoiler

  function isActive(s) {
    if (!s.enabled) return false;
    if (s.until && new Date() > new Date(s.until + "T23:59:59")) return false;
    var allow = (s.allow || "").split(/\r?\n/).map(function (a) { return a.trim().replace(/^www\./, ""); }).filter(Boolean);
    return !allow.some(function (a) { return host === a || host.endsWith("." + a); });
  }

  // Nœuds texte séparés par un espace : textContent colle les blocs ("#GTA6" + "vues" = "#GTA6vues")
  // et la borne de mot ratait. On garde aussi la version collée pour "GT<b>A 6</b>".
  function textOf(el) {
    var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), parts = [], n;
    while ((n = w.nextNode())) parts.push(n.nodeValue);
    var t = parts.join(" ") + "\n" + parts.join("");
    var extra = el.querySelectorAll("img[alt],[aria-label],[title]");
    for (var i = 0; i < extra.length && i < 40; i++) {
      t += " " + (extra[i].getAttribute("alt") || "") + " " + (extra[i].getAttribute("aria-label") || "") + " " + (extra[i].getAttribute("title") || "");
    }
    return t;
  }

  // Identité stable d'une carte : son premier lien. Le survol change le texte, pas le lien ;
  // le recyclage de cartes (YouTube, X) change le lien.
  function identity(el) {
    var a = el.querySelector("a[href*='/status/'],a[href*='/watch'],a[href*='/shorts/'],a[href*='/comments/'],a[href*='/video/']") || el.querySelector("a[href]");
    return a ? a.getAttribute("href") : (el.textContent || "").slice(0, 300);
  }

  // Attribut et pas classe : React (X, Reddit) réécrit className au survol et effaçait le masque.
  function mask(el) {
    if (!maskedEls.has(el)) { maskedEls.add(el); masked++; if (settings.mode === "mask") toSize.push(el); }
    if (el.getAttribute("data-asv") !== settings.mode) el.setAttribute("data-asv", settings.mode);
  }
  function unmask(el) {
    maskedEls.delete(el);
    if (el === peekEl) endPeek();
    if (el.hasAttribute("data-asv")) el.removeAttribute("data-asv");
    el.removeAttribute("data-asv-peek");
    el.removeAttribute("data-asv-size");
  }

  function check(el) {
    if (!el.isConnected) return;
    var t = textOf(el);
    if (seen.get(el) === t) return;
    seen.set(el, t);
    if (rx.test(t) && revealed.get(el) !== identity(el)) mask(el);
    else unmask(el); // YouTube et X recyclent leurs cartes : on démasque si le contenu a changé.
  }

  // Filet de sécurité : un bloc masqué qui a perdu son attribut le retrouve avant le rendu.
  function enforce() {
    maskedEls.forEach(function (el) {
      if (!el.isConnected) { maskedEls.delete(el); return; }
      if (el.getAttribute("data-asv") !== settings.mode) el.setAttribute("data-asv", settings.mode);
    });
  }

  function checkPage() {
    var onPage = site ? (site.page && site.page.test(location.pathname)) : true;
    var key = location.href;
    var h1 = document.querySelector("h1");
    var hit = onPage && (rx.test(document.title) || (h1 && rx.test(h1.textContent || "")));
    if (hit && wallDismissed !== key) openWall(key); else if (!hit) closeWall();
  }

  // Thème de la page (clair/sombre) lu sur le fond réel, pour que le masque se fonde dans le site.
  function theme() {
    var bg = "", nodes = [document.body, document.documentElement];
    for (var i = 0; i < nodes.length && !bg; i++) {
      var c = nodes[i] && getComputedStyle(nodes[i]).backgroundColor;
      if (c && !/rgba\(\s*0,\s*0,\s*0,\s*0\s*\)|transparent/.test(c)) bg = c;
    }
    var m = (bg || "rgb(255,255,255)").match(/\d+(\.\d+)?/g).map(Number);
    var dark = (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) < 128;
    var v = dark ? "dark" : "light";
    if (document.documentElement.getAttribute("data-asv-theme") !== v) document.documentElement.setAttribute("data-asv-theme", v);
  }

  function flush() {
    scheduled = false;
    if (!active) return;
    if (fullScan) {
      fullScan = false; pending.clear();
      document.querySelectorAll(SEL).forEach(check);
    } else {
      pending.forEach(check); pending.clear();
    }
    enforce();
    if (toSize.length) {
      var hs = toSize.map(function (el) { return el.offsetHeight; });
      toSize.forEach(function (el, i) { el.setAttribute("data-asv-size", hs[i] < 110 ? "s" : "l"); });
      toSize = [];
    }
    checkPage();
    if (masked) { var n = masked; masked = 0; bump(n); }
  }

  // requestAnimationFrame passe avant le rendu : le spoil n'apparaît jamais, même une frame.
  function schedule() { if (!scheduled) { scheduled = true; requestAnimationFrame(flush); } }

  function collect(node) {
    if (node.nodeType === 3) node = node.parentElement;
    if (!node || node.nodeType !== 1) return;
    var c = node.closest(SEL);
    if (c) pending.add(c);
    if (node.querySelectorAll) node.querySelectorAll(SEL).forEach(function (e) { pending.add(e); });
  }

  var mo = new MutationObserver(function (list) {
    if (!active) return;
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (m.type === "childList") { m.addedNodes.forEach(collect); if (m.target.nodeType === 1) collect(m.target); }
      else if (m.attributeName === "data-asv") { /* enforce() remet le masque au prochain flush */ }
      else collect(m.target);
    }
    schedule();
  });

  var bumpTimer = null, bumpAcc = 0;
  function bump(n) {
    bumpAcc += n;
    if (bumpTimer) return;
    bumpTimer = setTimeout(function () {
      var add = bumpAcc; bumpAcc = 0; bumpTimer = null;
      try { chrome.storage.local.get({ count: 0 }, function (r) { chrome.storage.local.set({ count: (r.count || 0) + add }); }); } catch (e) {}
    }, 2000);
  }

  function pauseMedia(e) { if (wallOpenFor) { try { e.target.pause(); } catch (x) {} } }

  function openWall(key) {
    if (wallOpenFor === key && document.getElementById("asv-wall")) return;
    closeWall();
    wallOpenFor = key;
    var w = document.createElement("div");
    w.id = "asv-wall";
    w.innerHTML = '<div class="asv-box"><h1>Cette page parle de GTA VI</h1><p>Anti-Spoil VI l\'a cachée pour que tu restes vierge jusqu\'à la sortie.</p><button class="asv-back">Retour</button><button class="asv-go">Afficher quand même</button></div>';
    w.querySelector(".asv-back").onclick = function () { if (history.length > 1) history.back(); else location.href = "about:blank"; };
    w.querySelector(".asv-go").onclick = function () { wallDismissed = key; closeWall(); };
    (document.body || document.documentElement).appendChild(w);
    document.querySelectorAll("video,audio").forEach(function (v) { try { v.pause(); } catch (x) {} });
  }
  function closeWall() {
    wallOpenFor = null;
    var w = document.getElementById("asv-wall"); if (w) w.remove();
  }

  // Survol : aperçu après un court délai, remasqué dès que la souris sort.
  function endPeek() {
    clearTimeout(peekTimer); peekTimer = null;
    if (peekEl) { peekEl.removeAttribute("data-asv-peek"); peekEl = null; }
  }
  function maskedFrom(node) { return node && node.closest ? node.closest("[data-asv=mask]") : null; }
  document.addEventListener("pointerover", function (e) {
    if (e.pointerType === "touch") return;
    var el = maskedFrom(e.target);
    if (el === peekEl) return;
    endPeek();
    if (!el) return;
    peekEl = el;
    peekTimer = setTimeout(function () { if (peekEl === el) el.setAttribute("data-asv-peek", ""); }, PEEK_DELAY);
  }, true);
  document.addEventListener("pointerout", function (e) {
    if (peekEl && !(e.relatedTarget && peekEl.contains(e.relatedTarget))) endPeek();
  }, true);
  window.addEventListener("blur", endPeek);
  window.addEventListener("scroll", function () { if (peekEl && !peekEl.matches(":hover")) endPeek(); }, { passive: true, capture: true });

  // Un clic sur un bloc masqué l'affiche pour de bon (et ne suit pas le lien).
  document.addEventListener("click", function (e) {
    var el = maskedFrom(e.target);
    if (!el) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    // On affiche le bloc cliqué, les blocs masqués dedans et ceux qui l'englobent.
    var list = [el].concat([].slice.call(el.querySelectorAll("[data-asv=mask]")));
    for (var p = el.parentElement; p; p = p.parentElement) if (p.getAttribute("data-asv") === "mask") list.push(p);
    list.forEach(function (x) { revealed.set(x, identity(x)); unmask(x); });
  }, true);
  document.addEventListener("play", pauseMedia, true);

  function apply(s) {
    settings = Object.assign({}, ASV_DEFAULTS, s);
    rx = asvBuildRegex(settings);
    var was = active;
    active = isActive(settings);
    seen = new WeakMap();
    endPeek();
    maskedEls.forEach(unmask);
    document.querySelectorAll("[data-asv]").forEach(unmask);
    if (!active) { closeWall(); if (was) mo.disconnect(); return; }
    if (!was) mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["title", "aria-label", "alt", "data-asv"], attributeOldValue: false });
    theme();
    fullScan = true; schedule();
  }

  chrome.storage.sync.get(ASV_DEFAULTS, apply);
  chrome.storage.onChanged.addListener(function (ch, area) {
    if (area === "sync") chrome.storage.sync.get(ASV_DEFAULTS, apply);
  });
  // Le titre d'onglet change sans muter le body sur certaines SPA.
  setInterval(function () { if (active) { checkPage(); theme(); } }, 1000);
})();
