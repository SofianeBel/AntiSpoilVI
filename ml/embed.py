"""Embeddings MobileCLIP-S0 (le même ONNX fp32 que l'extension ; l'int8 est 18x plus lent sur CPU) de toutes les images de ml/data et des dossiers locaux.
Lancer : python ml/embed.py   -> ml/data/emb.npz"""
import os, re, sys, numpy as np, onnxruntime as ort
from pathlib import Path
from PIL import Image

HERE = Path(__file__).parent; DATA = HERE / "data"
# Dossiers d'images GTA VI en plus (captures officielles), séparés par ";" : ASV_LOCAL_IMAGES="D:/gta6_gallery;D:/autres"
LOCAL = [Path(p) for p in os.environ.get("ASV_LOCAL_IMAGES", "").split(";") if p]
sess = ort.InferenceSession(str(HERE.parent / "model" / "vision.onnx"), providers=["CPUExecutionProvider"])
INP = sess.get_inputs()[0].name

def views(path):
    """Deux vues par image : recadrage central (comme preprocessor_config.json) et image entière écrasée en 256x256.
    Le recadrage seul coupe souvent le logo, posé sur le côté des miniatures. /255, sans normalisation."""
    im = Image.open(path).convert("RGB")
    sq = np.asarray(im.resize((256, 256), Image.BILINEAR), dtype=np.float32).transpose(2, 0, 1) / 255.0
    w, h = im.size; s = 256 / min(w, h)
    im = im.resize((max(256, round(w * s)), max(256, round(h * s))), Image.BILINEAR); w, h = im.size
    l, t = (w - 256) // 2, (h - 256) // 2
    return np.asarray(im.crop((l, t, l + 256, t + 256)), dtype=np.float32).transpose(2, 0, 1) / 255.0, sq

def items():
    for d in sorted((DATA / "frames").iterdir()):
        label, vid = d.name.split("_", 1)
        for f in sorted(d.glob("*.jpg")): yield f, int(label), "vid:" + vid
    for d in LOCAL:
        for f in sorted(d.glob("*.jp*g")): yield f, 1, "local:" + re.sub(r"(_Mobile)?_?\d+$", "", f.stem)
    for f in sorted((DATA / "thumbs").glob("*.jpg")): yield f, 0, "thumb:" + f.stem
    for f in sorted((DATA / "thumbs_neg2").glob("*.jpg")): yield f, 0, "thumb:" + f.stem
    # Recherches "GTA 6" : ~6 % de bruit estimé sur une planche contact de 120 (JT, pubs), gardé comme positif faible.
    for f in sorted((DATA / "thumbs_pos").glob("*.jpg")): yield f, 1, "tpos:" + f.stem

def keep(x):
    # Frames noires ou unies (fondus, cartons) : rien à apprendre, et elles brouillent les deux classes.
    return x.std() > 0.06

if __name__ == "__main__":
    X, Y, G, P = [], [], [], []
    batch, meta = [], []
    def flush():
        if not batch: return
        out = sess.run(None, {INP: np.stack([v for pair in batch for v in pair])})[0]
        out /= np.linalg.norm(out, axis=1, keepdims=True)
        out = out.reshape(len(batch), -1)  # [recadrée | écrasée], 1024 valeurs
        for e, (f, y, g) in zip(out, meta): X.append(e); Y.append(y); G.append(g); P.append(str(f))
        batch.clear(); meta.clear()
    n = 0
    for f, y, g in items():
        try: x = views(f)
        except Exception as e: print("illisible", f, e); continue
        if not keep(x[0]): continue
        batch.append(x); meta.append((f, y, g)); n += 1
        if len(batch) == 32: flush()
        if n % 500 == 0: print(n, flush=True)
    flush()
    np.savez(DATA / "emb.npz", X=np.array(X, np.float32), y=np.array(Y), g=np.array(G), p=np.array(P))
    print("images", len(Y), "positives", int(sum(Y)), "négatives", len(Y) - int(sum(Y)))
