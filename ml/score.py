"""Score d'images (URL ou fichier) avec la même chaîne que l'extension. Référence pour vérifier le JS.
Lancer : python ml/score.py <url|fichier> ..."""
import io, json, sys, urllib.request, numpy as np, onnxruntime as ort
from pathlib import Path
from PIL import Image
sys.path.insert(0, str(Path(__file__).parent))
from embed import views, sess, INP
M = Path(__file__).parent.parent / "model"; meta = json.loads((M / "head.json").read_text()); D, Hd = meta["dim"], meta["hidden"]
w = np.fromfile(M / "head.bin", "<f4"); W1 = w[:D * Hd].reshape(D, Hd); b1 = w[D * Hd:D * Hd + Hd]; w2 = w[D * Hd + Hd:D * Hd + 2 * Hd]; b2 = w[-1]
def score(src):
    data = urllib.request.urlopen(src, timeout=15).read() if src.startswith("http") else open(src, "rb").read()
    tmp = io.BytesIO(data); c, s = views(tmp)
    e = sess.run(None, {INP: np.stack([c, s])})[0]; e /= np.linalg.norm(e, axis=1, keepdims=True)
    h = np.maximum(e.reshape(-1) @ W1 + b1, 0); return float(1 / (1 + np.exp(-(h @ w2 + b2))))
if __name__ == "__main__":
    for a in sys.argv[1:]: print(f"{score(a):.4f} {a}")
