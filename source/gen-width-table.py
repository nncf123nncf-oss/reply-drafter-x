# 文字の重み(ユニット)の表を作る。east_asian_width が W/F/A の文字を2、それ以外を1とする(プロジェクトの計算式)。
# 実行: python source/gen-width-table.py  -> 2ユニットになる範囲を JS の配列で標準出力に出す
import unicodedata
ranges = []
start = None
for cp in range(0, 0x40000):
    c = chr(cp)
    if 0xD800 <= cp <= 0xDFFF:
        w = False
    else:
        w = unicodedata.east_asian_width(c) in ('W', 'F', 'A')
    if w and start is None:
        start = cp
    if not w and start is not None:
        ranges.append((start, cp - 1)); start = None
if start is not None:
    ranges.append((start, 0x3FFFF))
flat = []
for a, b in ranges:
    flat += [a, b]
print(len(ranges), 'ranges', 'python', __import__('sys').version.split()[0], 'unicodedata', unicodedata.unidata_version, file=__import__('sys').stderr)
print('[' + ','.join('0x%X' % x for x in flat) + ']')
