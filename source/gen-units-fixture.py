# ユニット数の固定サンプル(期待値はPythonのunicodedataで計算)。実行: python source/gen-units-fixture.py
import unicodedata, json, os, random
def units(s): return sum(2 if unicodedata.east_asian_width(c) in ('W','F','A') else 1 for c in s)
samples = ['', 'a', 'abc 123', 'こんにちは', 'Hello、世界。', '＃タグ １２３', '・×○△※', 'ｱｲｳ', 'é ü ñ', 'α β γ', 'Привет', '😀 emoji 🎉', 'a\nb\n\nc', '全角　スペース', '～〜…—', '㈱①②', '①②③ ABC', '→←↑↓', '♪♥', '한글', 'ℹ︎', '≠≒', '€£¥', ' nbsp', 'ｶﾀｶﾅ', '🇯🇵', '𠮷野家', '〒123-4567', 'ー', '“quote”', '‘a’', '°C', '㎏㎡']
random.seed(7)
pool = [chr(c) for c in list(range(0x20,0x7f)) + list(range(0xA0,0x250)) + list(range(0x370,0x400)) + list(range(0x2000,0x2100)) + list(range(0x2190,0x2200)) + list(range(0x2460,0x2500)) + list(range(0x3000,0x3100)) + list(range(0x4E00,0x4E80)) + list(range(0xFF00,0xFFF0)) + list(range(0x1F300,0x1F340))]
for _ in range(60):
    samples.append(''.join(random.choice(pool) for _ in range(random.randint(1, 30))))
out = [{'s': s, 'u': units(s), 'c': len(s)} for s in samples]
json.dump(out, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'units-fixture.json'), 'w', encoding='utf-8'), ensure_ascii=False)
print(len(out), 'cases')
