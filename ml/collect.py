"""Collecte le jeu d'images : frames de vidéos (positives GTA VI, négatives autres jeux et Miami),
images locales, miniatures YouTube variées. Tout va dans ml/data/ (hors Git : visuels Rockstar).
Lancer : python ml/collect.py"""
import json, os, subprocess, sys, urllib.request, concurrent.futures as cf
from pathlib import Path

ROOT = Path(__file__).parent / "data"
VID = ROOT / "videos"; FR = ROOT / "frames"; TH = ROOT / "thumbs"
for d in (VID, FR, TH): d.mkdir(parents=True, exist_ok=True)

# (id, label, secondes entre deux frames). Le "groupe" d'une image = sa vidéo : le test ne voit jamais une vidéo vue à l'entraînement.
VIDEOS = [
    ("ynlPxpaxpIc", 1, 3),   # GTA VI: An Extended Look, re-upload RAW (l'officiel tJbzMqJGH4k demande une connexion)
    ("QdBZY2fkU-0", 1, 1),   # Trailer 1
    ("VQRLujxTm3c", 1, 1),   # Trailer 2
    ("rz1B4B2yBZY", 1, 1),   # Launch Trailer
    ("8L0CzL2V72c", 1, 1),   # Features Trailer
    ("_yl5ELcmugI", 1, 1),   # Pre-Load
    ("hvoD7ehZPcM", 0, 1), ("QkkoHAzjnUs", 0, 1),            # GTA V
    ("eaW0tYpxyp0", 0, 1.5), ("F63h3v9QV7w", 0, 1.5),        # RDR2
    ("hf6tZ9OUswo", 0, 4, "*600-1800"),                     # Saints Row (2022), 20 min de gameplay (les trailers demandent une connexion)
    ("mxb0TYJRWys", 0, 6, "*300-2100"), ("sqr0nwlcqA8", 0, 6, "*300-1500"),  # GTA V gameplay : le négatif le plus proche
    ("fPdZUFa0zow", 0, 6, "*300-1500"),                     # GTA Online
    ("Rv7xLt5yNsM", 0, 1.5), ("FYH9n37B7Yw", 0, 1.5),        # Forza Horizon 5
    ("VbF6REQyel4", 0, 2), ("FeJ5lbFjQ3I", 0, 3),            # Far Cry 6
    ("Dmhws_sBEic", 0, 6),                                   # vrai Miami en drone
    ("8X2kIfS6fb8", 0, 1.5), ("qIcTM8WXFjk", 0, 2),          # Cyberpunk
    ("s2lGEhSlOTY", 0, 1), ("vfwfA_iTOng", 0, 1),            # Mafia
]
# Miniatures négatives : un peu de tout ce qu'on croise sur YouTube, dont d'autres jeux.
QUERIES = ["recette facile", "football highlights", "clip rap fr", "unboxing iphone", "vlog voyage", "minecraft survie",
    "fortnite", "call of duty warzone", "gta 5 rp", "gta san andreas", "red dead online", "the witcher 3", "elden ring",
    "valorant", "league of legends", "f1 highlights", "chat drôle", "tuto excel", "podcast", "miami vlog", "miami beach 4k",
    "voiture de sport review", "cyberpunk 2077 gameplay", "forza horizon 5", "watch dogs 2", "mafia 3", "saints row",
    "sleeping dogs", "just cause 4", "the crew motorfest", "documentaire espace", "musculation", "maquillage", "lofi"]

def sh(*a): return subprocess.run(a, capture_output=True, text=True)

def video(job):
    vid, label, step = job[:3]; section = job[3] if len(job) > 3 else None
    out = FR / f"{label}_{vid}"
    if out.exists() and any(out.iterdir()): return vid, "déjà là"
    out.mkdir(exist_ok=True)
    f = VID / f"{vid}.mp4"
    if not f.exists():
        extra = ["--download-sections", section] if section else []
        r = sh("yt-dlp", "-q", *extra, "-f", "bv*[height<=360][ext=mp4]/bv*[height<=360]", "-o", str(f), f"https://www.youtube.com/watch?v={vid}")
        if r.returncode: return vid, "échec yt-dlp " + r.stderr[-200:]
    r = sh("ffmpeg", "-loglevel", "error", "-i", str(f), "-vf", f"fps=1/{step},scale=-2:288", "-q:v", "3", str(out / "%05d.jpg"))
    return vid, f"{len(list(out.iterdir()))} frames" + (" " + r.stderr[-200:] if r.returncode else "")

def thumbs(q):
    r = sh("yt-dlp", "--flat-playlist", "--print", "%(id)s", f"ytsearch40:{q}")
    n = 0
    for vid in r.stdout.split():
        p = TH / f"{vid}.jpg"
        if p.exists(): n += 1; continue
        try:
            with urllib.request.urlopen(f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg", timeout=15) as resp: p.write_bytes(resp.read()); n += 1
        except Exception: pass
    return q, n

if __name__ == "__main__":
    with cf.ThreadPoolExecutor(4) as ex:
        for vid, msg in ex.map(video, VIDEOS): print("vidéo", vid, msg, flush=True)
    with cf.ThreadPoolExecutor(6) as ex:
        for q, n in ex.map(thumbs, QUERIES): print("miniatures", q, n, flush=True)
    print("fini", flush=True)
