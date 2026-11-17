"""Miniatures du vrai domaine : positives (recherches GTA 6) et négatives difficiles (vraie Floride, jeux photoréalistes).
Lancer : python ml/collect_thumbs.py"""
import subprocess, urllib.request, concurrent.futures as cf
from pathlib import Path
ROOT = Path(__file__).parent / "data"
SETS = {
    "thumbs_pos": ["GTA 6 trailer", "GTA 6 gameplay", "GTA VI", "GTA 6 leak", "GTA 6 map", "GTA 6 Jason Lucia", "GTA 6 Vice City",
                   "GTA 6 extended look", "GTA 6 analyse", "GTA 6 news", "GTA 6 details", "GTA 6 voitures", "GTA 6 réaction trailer 2"],
    "thumbs_neg2": ["miami street walk 4k", "florida keys drive", "everglades airboat", "miami nightlife", "florida beach vlog",
                    "ocean drive miami", "key west vlog", "miami car meet", "cyberpunk 2077 phantom liberty", "gta 5 graphics mod",
                    "gta 5 natural vision", "gta online new dlc", "the crew motorfest hawaii", "forza horizon 5 photo mode",
                    "unreal engine 5 city demo", "matrix awakens demo", "test drive unlimited solar crown", "mafia the old country"],
}
def grab(args):
    folder, q = args; out = ROOT / folder; out.mkdir(exist_ok=True)
    ids = subprocess.run(["yt-dlp", "--flat-playlist", "--print", "%(id)s", f"ytsearch50:{q}"], capture_output=True, text=True).stdout.split()
    n = 0
    for vid in ids:
        p = out / f"{vid}.jpg"
        if p.exists(): n += 1; continue
        try:
            with urllib.request.urlopen(f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg", timeout=15) as r: p.write_bytes(r.read()); n += 1
        except Exception: pass
    return folder, q, n
if __name__ == "__main__":
    jobs = [(f, q) for f, qs in SETS.items() for q in qs]
    with cf.ThreadPoolExecutor(6) as ex:
        for f, q, n in ex.map(grab, jobs): print(f, q, n, flush=True)
