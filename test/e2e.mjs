// E2E : charge l'extension dans Chromium headless et vérifie le masque sur une page qui imite X.
// Lancer : node test/e2e.mjs [chemin/vers/node_modules/playwright]
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { createRequire } from "node:module";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1")), "..");
const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] || "playwright");
const shots = process.env.SHOTS || path.join(root, "test", "shots"); fs.mkdirSync(shots, { recursive: true });
const srv = http.createServer((q, r) => { r.setHeader("content-type", "text/html; charset=utf-8"); r.end(fs.readFileSync(path.join(root, "test", "fake-x.html"))); }).listen(0);
const url = "http://127.0.0.1:" + srv.address().port + "/";
const ctx = await chromium.launchPersistentContext("", { headless: true, channel: "chromium", executablePath: process.env.CHROME || undefined, viewport: { width: 1000, height: 900 },
  args: ["--disable-extensions-except=" + root, "--load-extension=" + root] });
const results = []; const ok = (name, cond, info = "") => results.push((cond ? "PASS " : "FAIL ") + name + (info ? "  (" + info + ")" : ""));
const page = await ctx.newPage(); await page.goto(url); await page.waitForTimeout(800);
const state = (id) => page.evaluate((id) => { const a = document.getElementById(id); const t = a.querySelector(".t");
  if (!t) return {};
  return { asv: a.getAttribute("data-asv"), peek: a.hasAttribute("data-asv-peek"), textVisible: getComputedStyle(t).visibility === "visible" }; }, id);
let s = await state("p1"); ok("post GTA masqué au chargement", s.asv === "mask" && !s.textVisible, JSON.stringify(s));
s = await state("p0"); ok("post normal pas masqué", !s.asv && s.textVisible);
s = await state("p3"); ok("2e post GTA masqué", s.asv === "mask" && !s.textVisible);
await page.screenshot({ path: path.join(shots, "feed-dark.png") });
const box = await page.locator("#p1").boundingBox();
await page.mouse.move(box.x + 40, box.y + box.height / 2); await page.waitForTimeout(120);
s = await state("p1"); ok("survol bref : reste masqué", s.asv === "mask" && !s.textVisible, JSON.stringify(s));
await page.waitForTimeout(500);
s = await state("p1"); ok("survol prolongé : aperçu visible", s.asv === "mask" && s.textVisible, JSON.stringify(s));
await page.screenshot({ path: path.join(shots, "feed-peek.png") });
await page.mouse.move(5, 5); await page.waitForTimeout(50);
s = await state("p1"); ok("souris sortie : remasqué tout de suite", s.asv === "mask" && !s.textVisible && !s.peek, JSON.stringify(s));
// Échantillonne chaque frame pendant 3 s avec re-render React toutes les 120 ms : le masque ne doit jamais sauter.
const gaps = await page.evaluate(() => new Promise((res) => { let n = 0, bad = 0; const end = performance.now() + 3000;
  (function f() { for (const id of ["p1", "p3"]) { n++; const t = document.querySelector("#" + id + " .t"); if (getComputedStyle(t).visibility === "visible") bad++; }
    if (performance.now() < end) requestAnimationFrame(f); else res({ n, bad }); })(); }));
ok("aucun clignotement sur 3 s de re-render", gaps.bad === 0, gaps.bad + "/" + gaps.n + " frames visibles");
// Survols rapides en série (passage en scrollant) : jamais d'aperçu.
for (let i = 0; i < 6; i++) { await page.mouse.move(box.x + 40, box.y + 20 + i * 10); await page.waitForTimeout(40); await page.mouse.move(5, 5); await page.waitForTimeout(40); }
s = await state("p1"); ok("passages rapides : pas d'aperçu", !s.textVisible && !s.peek);
// Carte recyclée pendant un aperçu : le nouveau post ne doit pas hériter de l'aperçu.
await page.mouse.move(box.x + 40, box.y + box.height / 2); await page.waitForTimeout(500);
await page.evaluate(() => { const a = document.querySelector("#p1"); a.querySelector(".t a").href = "/x/status/99"; a.querySelector(".t a").textContent = "Autre fuite GTA 6 sur Leonida"; });
await page.waitForTimeout(60);
s = await state("p1"); ok("carte recyclée pendant l'aperçu : remasquée", s.asv === "mask" && !s.textVisible, JSON.stringify(s));
// Un site qui arrache l'attribut : remis avant la frame suivante.
await page.mouse.move(5, 5);
const torn = await page.evaluate(() => new Promise((r) => { const a = document.querySelector("#p3"); a.removeAttribute("data-asv");
  requestAnimationFrame(() => requestAnimationFrame(() => r(a.getAttribute("data-asv")))); }));
ok("attribut arraché : remis aussitôt", torn === "mask", String(torn));
await page.mouse.click(box.x + 40, box.y + box.height / 2); await page.waitForTimeout(100);
await page.mouse.move(5, 5); await page.waitForTimeout(400);
s = await state("p1"); ok("clic : affiché pour de bon", !s.asv && s.textVisible, JSON.stringify(s));
ok("url inchangée après le clic (lien pas suivi)", page.url() === url, page.url());
s = await state("p3"); ok("l'autre post reste masqué", s.asv === "mask" && !s.textVisible);
s = await page.evaluate(() => document.getElementById("p4").getAttribute("data-asv-size"));
ok("petit bloc en mode compact", s === "s", s);
await page.focus("#p3"); await page.keyboard.press("Enter"); await page.waitForTimeout(100);
s = await state("p3"); ok("Entrée au clavier : affiché", !s.asv && s.textVisible, JSON.stringify(s));
ok("thème sombre détecté", (await page.evaluate(() => document.documentElement.getAttribute("data-asv-theme"))) === "dark");
const light = await ctx.newPage(); await light.goto(url + "?light"); await light.waitForTimeout(1500);
ok("thème clair détecté", (await light.evaluate(() => document.documentElement.getAttribute("data-asv-theme"))) === "light");
await light.screenshot({ path: path.join(shots, "feed-light.png") });
// Popup
const ext = await ctx.newPage(); await ext.goto("chrome://extensions");
const extId = await ext.evaluate(() => new Promise((r) => chrome.developerPrivate.getExtensionsInfo((l) => r((l.find((e) => e.name === "Anti-Spoil VI") || {}).id))));
if (extId) { const pop = await ctx.newPage(); await pop.setViewportSize({ width: 340, height: 600 }); await pop.goto("chrome-extension://" + extId + "/popup.html"); await pop.waitForTimeout(300);
  await pop.screenshot({ path: path.join(shots, "popup.png"), fullPage: true });
  await pop.click(".sw"); await pop.waitForTimeout(200); await pop.screenshot({ path: path.join(shots, "popup-off.png"), fullPage: true });
  await page.bringToFront(); await page.waitForTimeout(800);
  ok("coupé depuis la popup : plus rien de masqué", (await page.evaluate(() => document.querySelectorAll("[data-asv]").length)) === 0);
  await pop.click(".sw"); await page.waitForTimeout(800);
  ok("rallumé : re-masqué", (await page.evaluate(() => document.querySelectorAll("[data-asv=mask]").length)) >= 1); }
else ok("popup trouvée", false);
const wall = await ctx.newPage(); await wall.route("**/wall", (r) => r.fulfill({ contentType: "text/html", body: "<title>GTA 6 : tout sur Vice City</title><h1>GTA 6 : tout sur Vice City</h1>" }));
await wall.goto(url + "wall"); await wall.waitForTimeout(600);
ok("écran de blocage sur une page GTA VI", await wall.evaluate(() => !!document.getElementById("asv-wall")));
await wall.screenshot({ path: path.join(shots, "wall.png") });
// Sur x.com : le nom, le @ et "a reposté" ne comptent pas, seul le contenu du tweet compte.
const xp = await ctx.newPage(); await xp.route("https://x.com/**", (r) => r.fulfill({ contentType: "text/html; charset=utf-8", body: fs.readFileSync(path.join(root, "test", "fake-x.html")) }));
await xp.goto("https://x.com/home"); await xp.waitForTimeout(800);
const xs = (id) => xp.evaluate((id) => document.getElementById(id).getAttribute("data-asv"), id);
ok("x.com : retweet d'un compte nommé GTA 6, sujet sans rapport : pas masqué", !(await xs("p5")), String(await xs("p5")));
ok("x.com : auteur nommé GTA VI, sujet sans rapport : pas masqué", !(await xs("p6")), String(await xs("p6")));
ok("x.com : tweet qui parle de GTA 6 : masqué", (await xs("p1")) === "mask", String(await xs("p1")));
await xp.evaluate(() => { document.querySelector("#p5 .t a").textContent = "Le trailer de GTA 6 est sorti"; }); await xp.waitForTimeout(100);
ok("x.com : même retweet, contenu GTA : masqué", (await xs("p5")) === "mask", String(await xs("p5")));
console.log(results.join("\n")); console.log("shots: " + shots);
await ctx.close(); srv.close(); process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0);
