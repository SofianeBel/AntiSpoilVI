"""Entraîne la tête (MLP 1024 -> 256 -> 1 sur les deux vues MobileCLIP concaténées ; meilleure que la régression logistique, voir specs) et mesure, validation croisée par source.
Lancer : python ml/train.py   -> model/head.json + rapport"""
import json, numpy as np
from pathlib import Path
from sklearn.neural_network import MLPClassifier
from sklearn.model_selection import StratifiedGroupKFold

HERE = Path(__file__).parent
d = np.load(HERE / "data" / "emb.npz"); X, y, g, p = d["X"], d["y"], d["g"], d["p"]
# Un groupe = une vidéo, une série d'images locales (Jason_Duval...) ou une miniature : jamais à cheval entre entraînement et test.
oof = np.zeros(len(y))
for tr, te in StratifiedGroupKFold(5, shuffle=True, random_state=0).split(X, y, g):
    m = MLPClassifier((256,), alpha=1e-3, max_iter=400, early_stopping=True, random_state=0).fit(X[tr], y[tr]); oof[te] = m.predict_proba(X[te])[:, 1]

def stats(t):
    pred = oof >= t; tp = (pred & (y == 1)).sum(); fp = (pred & (y == 0)).sum(); fn = (~pred & (y == 1)).sum()
    return tp / max(tp + fp, 1), tp / max(tp + fn, 1), fp
best = None
# Le seuil se choisit sur les miniatures (le domaine de l'extension), pas sur les frames de vidéo.
th = np.array([s.startswith(("thumb:", "tpos:")) for s in g])
def stats_th(t):
    pred = oof[th] >= t; yy = y[th]; tp = (pred & (yy == 1)).sum(); fp = (pred & (yy == 0)).sum()
    return tp / max(tp + fp, 1), tp / max(yy.sum(), 1), fp
for t in np.arange(0.30, 0.995, 0.005):
    pr, rc, fp = stats_th(t)
    if pr >= 0.95 and (best is None or rc > best[2]): best = (t, pr, rc, fp)
print(f"images {len(y)}  positives {int(y.sum())}  négatives {int((y == 0).sum())}  groupes {len(set(g))}")
for t in (0.5, 0.7, 0.9):
    pr, rc, fp = stats(t); print(f"seuil {t:.2f}  précision {pr:.3f}  rappel {rc:.3f}  faux positifs {fp}")
failed = best is None
if failed:
    print("AUCUN seuil n'atteint 95 % de précision, détail au seuil 0.5")
    best = (0.5, *stats(0.5))
t, pr, rc, fp = best
print(f"RETENU (miniatures) seuil {t:.3f}  précision {pr:.3f}  rappel {rc:.3f}  faux positifs {fp}/{(y[th] == 0).sum()}")
# Le domaine réel de l'extension : des miniatures. Mesure à part, sur les miniatures seulement.
for tt in (0.5, 0.7, 0.8, 0.9, t):
    pred = oof[th] >= tt; yy = y[th]; tp = (pred & (yy == 1)).sum(); fpn = (pred & (yy == 0)).sum()
    print(f"miniatures seuil {tt:.2f}  précision {tp / max(tp + fpn, 1):.3f}  rappel {tp / max(yy.sum(), 1):.3f}  faux positifs {fpn}/{(yy == 0).sum()}")
# Détail par source au seuil retenu : où le modèle se trompe.
src = np.array([s.split(":")[0] + ":" + (s.split(":")[1] if s.startswith("vid:") else "") for s in g])
print("\npar source (part jugée GTA VI) :")
for s in sorted(set(src)):
    k = src == s; lab = int(y[k][0]); r = (oof[k] >= t).mean()
    print(f"  {'POS' if lab else 'neg'} {s:24s} n={k.sum():4d}  jugé GTA VI {r:.1%}")
fps = np.argsort(-(oof * (y == 0)))[:12]; fns = np.argsort(oof + (y == 0) * 9)[:12]
print("\npires faux positifs :"); [print(f"  {oof[i]:.3f} {p[i]}") for i in fps]
print("pires faux négatifs :"); [print(f"  {oof[i]:.3f} {p[i]}") for i in fns]
m = MLPClassifier((256,), alpha=1e-3, max_iter=400, early_stopping=True, random_state=0).fit(X, y)
# Tête en float32 brut pour l'extension : W1 (1024x256, ligne par ligne), b1 (256), w2 (256), b2 (1).
np.concatenate([m.coefs_[0].ravel(), m.intercepts_[0], m.coefs_[1][:, 0], m.intercepts_[1]]).astype("<f4").tofile(HERE.parent / "model" / "head.bin")
(HERE.parent / "model" / "head.json").write_text(json.dumps({"dim": int(X.shape[1]), "hidden": int(m.coefs_[0].shape[1]), "threshold": round(float(t), 3),
    "cv_thumbs": {"precision": round(float(pr), 4), "recall": round(float(rc), 4)}, "n": int(len(y))}, indent=1))
print("model/head.bin et model/head.json écrits")
if failed: raise SystemExit(1)
