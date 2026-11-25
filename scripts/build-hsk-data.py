import json
import os
import re
import unicodedata
import urllib.request

OUT_DIR = r"D:\Projects\hsk-web\public\data"
os.makedirs(OUT_DIR, exist_ok=True)


def fetch_text(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="replace")


def strip_tones(s: str) -> str:
    s = s.replace("ü", "v").replace("ǖ", "v").replace("ǘ", "v").replace("ǚ", "v").replace("ǜ", "v")
    nfkd = unicodedata.normalize("NFKD", s)
    return "".join(c for c in nfkd if not unicodedata.combining(c)).lower()


print("1. Fetching Sino-Vietnamese character mappings...")
kviet: dict[str, list[str]] = {}
try:
    kviet = json.loads(fetch_text("https://raw.githubusercontent.com/phucbm/xue-hanzi/main/src/data/kVietnamese.json"))
    overrides = json.loads(
        fetch_text("https://raw.githubusercontent.com/phucbm/xue-hanzi/main/src/data/sinoViet-overrides.json")
    )
    kviet.update(overrides)
    print(f"   Loaded {len(kviet)} kVietnamese + override entries.")
except Exception as e:
    print("   Warning kVietnamese:", e)

print("2. Fetching HSK Sino-Vietnamese character insights & mnemonics...")
char_insights: dict[str, dict] = {}
try:
    chars_raw = json.loads(
        fetch_text("https://raw.githubusercontent.com/binhbuithithanh/hanzi-sino-vietnamese/main/data/characters.json")
    )
    for item in chars_raw:
        hz = item.get("hanzi")
        if not hz:
            continue
        rads = []
        for r in item.get("radicals", []) or []:
            if isinstance(r, dict):
                rads.append(
                    {
                        "r": r.get("radical", ""),
                        "m": r.get("meaningVi") or r.get("meaning") or "",
                        "h": r.get("hook") or "",
                    }
                )
        char_insights[hz] = {
            "p": item.get("pinyin", ""),
            "hv": (item.get("sinoViet") or "").lower(),
            "vi": item.get("meaningVi", ""),
            "sc": item.get("strokeCount", 0),
            "mn": item.get("mnemonic", ""),
            "sh": item.get("strokeHint", ""),
            "rad": rads,
        }
        if item.get("sinoViet") and hz not in kviet:
            kviet[hz] = [item["sinoViet"].lower()]
    print(f"   Loaded {len(char_insights)} character insights.")
except Exception as e:
    print("   Warning char_insights:", e)

print("3. Fetching CVDICT Vietnamese meanings...")
cv_map: dict[str, str] = {}
try:
    raw_cv = fetch_text("https://raw.githubusercontent.com/phucbm/xue-hanzi/main/src/data/cvdict.json")
    if raw_cv.strip().startswith("{"):
        parsed_cv = json.loads(raw_cv)
        for k, v in parsed_cv.items():
            if isinstance(v, dict) and v.get("vi"):
                cv_map[k] = v["vi"]
            elif isinstance(v, str):
                cv_map[k] = v
        print(f"   Loaded {len(cv_map)} entries from cvdict.json.")
    else:
        raise ValueError("cvdict.json might be Git LFS pointer")
except Exception as e:
    print("   cvdict.json fallback to CVDICT.u8:", e)
    raw_u8 = fetch_text("https://raw.githubusercontent.com/ph0ngp/CVDICT/main/CVDICT.u8")
    line_re = re.compile(r"^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+/(.+)/")
    for line in raw_u8.splitlines():
        if not line or line.startswith("#"):
            continue
        m = line_re.match(line)
        if m:
            trad, simp, py, defs = m.groups()
            clean_defs = [
                d.strip()
                for d in defs.split("/")
                if d.strip() and not d.strip().startswith("CL:") and "variant of" not in d
            ]
            if clean_defs and simp not in cv_map:
                cv_map[simp] = "; ".join(clean_defs[:4])
    print(f"   Loaded {len(cv_map)} entries from CVDICT.u8.")


def clean_vi_meaning(text: str) -> str:
    parts = [p.strip() for p in re.split(r"[;/]", text) if p.strip()]
    filtered = []
    for p in parts:
        if p.startswith("CL:") or p.startswith("cũng viết") or "biến thể của" in p.lower():
            continue
        p = re.sub(r"\s*\[[^\]]*\]", "", p).strip()
        if p and p not in filtered:
            filtered.append(p)
    return "; ".join(filtered[:4]) if filtered else text


def get_word_hanviet(word: str) -> str:
    out = []
    for ch in word:
        if ch in char_insights and char_insights[ch].get("hv"):
            hv = char_insights[ch]["hv"].split(",")[0].split("/")[0].strip().lower()
            out.append(hv)
        elif ch in kviet and kviet[ch]:
            out.append(kviet[ch][0].strip().lower())
    return " ".join(out)


print("4. Fetching all 6 HSK levels (5,000 words)...")
vocab = []
seen_hanzi: set[str] = set()
uid = 1

for level in range(1, 7):
    url = f"https://raw.githubusercontent.com/clem109/hsk-vocabulary/master/hsk-vocab-json/hsk-level-{level}.json"
    items = json.loads(fetch_text(url))
    for entry in items:
        hz = entry["hanzi"].strip()
        # Strip parenthetical disambiguations if any
        hz_clean = re.sub(r"（.*?）|\(.*?\)", "", hz).strip() or hz
        if hz_clean in seen_hanzi:
            continue
        seen_hanzi.add(hz_clean)

        py = entry.get("pinyin", "").strip()
        en_list = [
            t.strip()
            for t in entry.get("translations", [])
            if t.strip() and not t.strip().startswith("CL:") and "variant of" not in t
        ]
        en_str = "; ".join(en_list[:3])

        vi_raw = cv_map.get(hz_clean, "")
        if not vi_raw and len(hz_clean) == 1 and hz_clean in char_insights:
            vi_raw = char_insights[hz_clean].get("vi", "")
        vi_str = clean_vi_meaning(vi_raw) if vi_raw else en_str

        hv_str = get_word_hanviet(hz_clean)

        # Ensure every character in HSK words has at least basic hv entry in char_insights
        for ch in hz_clean:
            if "\u4e00" <= ch <= "\u9fff" and ch not in char_insights:
                hv_ch = kviet.get(ch, [""])[0].lower() if ch in kviet and kviet[ch] else ""
                vi_ch = clean_vi_meaning(cv_map.get(ch, "")) if ch in cv_map else ""
                char_insights[ch] = {
                    "p": "",
                    "hv": hv_ch,
                    "vi": vi_ch,
                    "sc": 0,
                    "mn": "",
                    "sh": "",
                    "rad": [],
                }

        vocab.append(
            {
                "id": uid,
                "l": level,
                "h": hz_clean,
                "p": py,
                "pn": strip_tones(py).replace(" ", ""),
                "hv": hv_str,
                "vi": vi_str,
                "en": en_str,
            }
        )
        uid += 1
    print(f"   Level {level}: cumulative {len(vocab)} words")

vocab_path = os.path.join(OUT_DIR, "hsk-vocab.json")
chars_path = os.path.join(OUT_DIR, "char-insights.json")

with open(vocab_path, "w", encoding="utf-8") as f:
    json.dump(vocab, f, ensure_ascii=False, separators=(",", ":"))

with open(chars_path, "w", encoding="utf-8") as f:
    json.dump(char_insights, f, ensure_ascii=False, separators=(",", ":"))

vi_covered = sum(1 for w in vocab if w["vi"] and w["vi"] != w["en"])
hv_covered = sum(1 for w in vocab if w["hv"])
print(f"DONE! Total words: {len(vocab)} | VI coverage: {vi_covered}/{len(vocab)} | HV coverage: {hv_covered}/{len(vocab)}")
print(f"Sizes: hsk-vocab.json={os.path.getsize(vocab_path)//1024}KB, char-insights.json={os.path.getsize(chars_path)//1024}KB")
