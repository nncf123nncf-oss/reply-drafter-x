// 生成部分(script#core)だけを取り出して検算する。node source/run-checks.js
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const m = html.match(/<script id="core">([\s\S]*?)<\/script>/);
const RD = new Function(m[1] + '; return RD;')();
let pass = 0, fail = 0;
function eq(name, got, exp) {
  const ok = JSON.stringify(got) === JSON.stringify(exp);
  if (ok) pass++; else { fail++; console.log('NG', name, 'got', JSON.stringify(got), 'exp', JSON.stringify(exp)); }
}
function ok(name, cond, info) { if (cond) pass++; else { fail++; console.log('NG', name, info === undefined ? '' : JSON.stringify(info)); } }
const W = (p) => RD.pickWords(p).cands.map(c => c.w);
const N = (p) => RD.pickWords(p).num;

// S1 拾い
eq('S1 quote', W('今日は「完走」できた'), ['完走']);
eq('S1 quote 2', W('『ありがとう』と「またね」'), ['ありがとう', 'またね']);
eq('S1 tag', W('走った #ランニング初心者'), ['ランニング初心者']);
eq('S1 tag fullwidth', W('朝活 ＃早起き'), ['早起き', '朝活']);
eq('S1 noun katakana', W('今日はコーヒーを淹れた'), ['コーヒー']);
eq('S1 noun english', W('Notionで整理した'), ['Notion', '整理']);
eq('S1 noun kanji longest', W('資料作成と確認をした'), ['資料作成', '確認']);
eq('S1 stopwords', W('今日は最近よりも本当に自分で一番'), []);
eq('S1 empty', W(''), []);
eq('S1 null', RD.pickWords(null).cands, []);
eq('S1 short', W('うれしい'), []);
eq('S1 short kana word', W('ねむい'), []);
eq('S1 quote too long', W('「' + 'あ'.repeat(25) + '」と言った').length, 0);
eq('S1 quote 24 ok', W('「' + 'あ'.repeat(24) + '」と言った').length, 1);
eq('S1 quote 1 char skip', W('「の」だけ'), []);
eq('S1 quote with punct', W('「走る、そして休む」と決めた'), ['走る そして休む']);
eq('S1 dedupe', W('「完走」して完走した #完走'), ['完走']);
eq('S1 noun inside quote not repeated', W('「資料作成」を終えた'), ['資料作成']);
eq('S1 max 5', W('「あい」「うえ」「おか」「きく」「けこ」「さし」「すせ」').length, 5);
eq('S1 url removed', W('見て https://example.com/abc で Notion'), ['Notion']);
eq('S1 mention removed', W('@someone さん'), []);
eq('S1 order quote > tag > noun', W('コーヒー「朝」「完走」 #早起き'), ['完走', '早起き', 'コーヒー']);
// 数量
eq('S1 num km', N('今日3kmを走った'), '3km');
eq('S1 num fullwidth', N('１００人が来た'), '100人');
eq('S1 num comma', N('1,000円だった'), '1,000円');
eq('S1 num decimal', N('3.5kgやせた'), '3.5kg');
eq('S1 num year4 skip', N('2026年に始めた'), '');
eq('S1 num year2 ok', N('3年続けた'), '3年');
eq('S1 num date skip', N('10月15日に行った'), '');
eq('S1 num none', N('数字はない'), '');
eq('S1 num no unit', N('3だけ'), '');
eq('S1 num after hash skip', N('#3人で'), '');
eq('S1 num letter unit follows', N('3months'), '');
eq('S1 num first only', N('2回と5回'), '2回');
eq('S1 num hours', N('2時間かかった'), '2時間');

// S2 全組み合わせ
const FORBID = [/[。、，．]/, /\{|\}/, /「」/, /[ ]{2,}/, /\n\n/, /^\s|\s$/, /　/];
function checkPlans(tag, plans, extra) {
  ok(tag + ' 3 plans', plans.length === 3, plans.length);
  const texts = plans.map(p => p.text);
  ok(tag + ' nonempty', texts.every(t => t.length > 0));
  ok(tag + ' distinct', new Set(texts).size === 3, texts);
  FORBID.forEach((re, i) => ok(tag + ' forbid' + i, texts.every(t => !re.test(t)), texts.filter(t => re.test(t))));
  ok(tag + ' no ascii comma/period misuse', texts.every(t => !/,(?!\d)|(?<!\d),/.test(t) && !/\.(?=\s|$)/.test(t)), texts);
  ok(tag + ' no undefined/NaN', texts.every(t => !/undefined|NaN|null/.test(t)), texts);
  ok(tag + ' label', plans.every(p => p.type && p.type.length > 0));
  if (extra) extra(plans);
}
let combos = 0;
for (let f = 0; f < 6; f++) for (let d = 0; d < 3; d++) for (const w of ['', '完走']) for (const memo of ['', '私は先月 5キロ歩くのがやっとでした']) for (const n of ['', '3km']) {
  combos++;
  const plans = RD.build({ feeling: f, dist: d, word: w, num: n, memo });
  checkPlans('S2 f' + f + 'd' + d + (w ? 'W' : '') + (memo ? 'M' : '') + (n ? 'N' : ''), plans, (ps) => {
    if (w) { ok('S2 word in plan1', ps[0].text.includes('「完走」'), ps[0].text); ok('S2 word in plan2', ps[1].text.includes('「完走」'), ps[1].text); }
    else { ok('S2 no word no brackets', !ps[0].text.includes('「') && !ps[1].text.includes('「'), ps.map(p => p.text)); }
    ok('S2 memo in plan3', memo ? ps[2].text.includes('私は先月 5キロ歩くのがやっとでした') && !ps[2].needsMemo : ps[2].needsMemo, ps[2]);
    const hasN = ps[0].text.includes('3km');
    ok('S2 num only feeling 3/4', hasN === (!!n && (f === 3 || f === 4)), ps[0].text);
  });
}
eq('S2 combos', combos, 144);
// 作ったデータの欠け: 部品の全文字列に句読点が無い
RD.FEELINGS.forEach((f, i) => ['EMP', 'EMP2', 'REACT', 'CLOSE'].forEach(k => f[k].forEach((t, d) => ok('S2 part ' + i + k + d, !/[。、，．]/.test(t) && t.length > 0, t))));
eq('S2 feelings count', RD.FEELINGS.length, 6);
eq('S2 dists count', RD.DISTS.length, 3);

// S3 句読点の除去
let t = RD.build({ feeling: 0, dist: 0, word: '', num: '', memo: '朝は走る、夜は休む。たまに,迷う.' })[2].text;
ok('S3 memo punct removed', !/[。、，．]/.test(t) && !/,/.test(t) && !/\.(?=\s|$)/.test(t), t);
ok('S3 memo split to lines', t.includes('朝は走る 夜は休む\nたまに 迷う'), t);
t = RD.build({ feeling: 0, dist: 1, word: '走る、そして休む。', num: '', memo: '' })[0].text;
ok('S3 word punct removed', !/[。、，．]/.test(t) && t.includes('「走る そして休む」'), t);
eq('S3 keep 1,000', RD.clean('価格は1,000円と3.5kg'), '価格は1,000円と3.5kg');
eq('S3 keep fullwidth comma in number', RD.clean('1，000人'), '1,000人');
eq('S3 clean newline', RD.clean('a。b。。\n\n c'), 'a\nb\nc');
eq('S3 clean spaces', RD.clean('a 、 b　　c'), 'a b c');
eq('S3 clean ascii period end', RD.clean('Node.js and end.'), 'Node.js and end');
eq('S3 clean idempotent', RD.clean(RD.clean('朝は、夜は。3.5,000')), RD.clean('朝は、夜は。3.5,000'));
// $ や特殊パターンが入っても壊れない
t = RD.build({ feeling: 1, dist: 2, word: "$& $1 $' {n} {w}", num: '', memo: '' })[0].text;
ok('S3 special chars word', t.includes("「$& $1 $' {n} {w}」") || t.includes("$&"), t);

// S4 手入力・言葉なし(UI側のactiveWordに相当: wordが空なら差し込みなし)
let a = RD.build({ feeling: 2, dist: 1, word: '   ', num: '', memo: '' });
ok('S4 blank word = no word', !a[0].text.includes('「') && !a[1].text.includes('「'), a.map(p => p.text));
eq('S4 oneLine multiline', RD.oneLine('a\nb。c'), 'a b c');

// S5 ユニット数(Pythonのunicodedataで作った固定サンプル)
const fx = JSON.parse(fs.readFileSync(path.join(__dirname, 'units-fixture.json'), 'utf8'));
let bad = 0;
fx.forEach((c, i) => { const u = RD.units(c.s), n = RD.chars(c.s); if (u !== c.u || n !== c.c) { bad++; console.log('NG units', i, JSON.stringify(c.s), 'got', u, n, 'exp', c.u, c.c); } });
ok('S5 units fixture ' + fx.length, bad === 0, bad); if (bad === 0) pass += 0;
eq('S5 units basic', [RD.units('abc'), RD.units('あいう'), RD.units('a\nあ'), RD.units('')], [3, 6, 4, 0]);
eq('S5 chars emoji', RD.chars('😀a'), 2);

// S6 警告境界(280)
eq('S6 limit', RD.LIMIT, 280);
eq('S6 280 chars', RD.units('a'.repeat(280)), 280);
eq('S6 140 zenkaku', RD.units('あ'.repeat(140)), 280);
eq('S6 141 zenkaku over', RD.units('あ'.repeat(141)) > RD.LIMIT, true);

// S7 距離感で文が変わる・長さの順
let sum = [0, 0, 0], same = 0;
for (let f = 0; f < 6; f++) {
  const T = [0, 1, 2].map(d => RD.build({ feeling: f, dist: d, word: '完走', num: '3km', memo: '私は先月 5キロ歩くのがやっとでした' }));
  for (let p = 0; p < 3; p++) { if (new Set([T[0][p].text, T[1][p].text, T[2][p].text]).size < 3) same++; }
  for (let d = 0; d < 3; d++) sum[d] += T[d].reduce((s, x) => s + RD.units(x.text), 0);
}
eq('S7 all distances differ', same, 0);
ok('S7 length order (avg units: first > repeat > close)', sum[0] > sum[1] && sum[1] > sum[2], sum);

// 例: サンプル(スクリーンショット用)
const sp = RD.pickWords('今日 初めて3kmを走りきった。走るのが苦手だったので「完走」できただけで泣きそうになった #ランニング初心者');
eq('sample picks', [sp.cands.map(c => c.w), sp.num], [['完走', 'ランニング初心者', '苦手'], '3km']);

// S9 静的チェック: 保存系・外部送信が無い
const noStrip = html.replace(/<script id="core">[\s\S]*?<\/script>/, '');
['localStorage', 'sessionStorage', 'indexedDB', 'download', 'navigator.share', 'XMLHttpRequest', 'fetch(', 'innerHTML', 'insertAdjacentHTML', 'eval(', 'document.write', 'location.hash', 'history.'].forEach(k => ok('S9 no ' + k, !html.includes(k), k));
ok('S9 clipboard only writeText', (html.match(/clipboard\.\w+/g) || []).every(x => x === 'clipboard.writeText'), html.match(/clipboard\.\w+/g));
ok('S9 no short url', !/(forms\.gle|lin\.ee|bit\.ly|t\.co\/)/.test(html));
ok('S9 no href=#', !/href="#"/.test(html));
['バズる', '刺さる', '好かれる', '自然な', '失礼がない', '正しい敬語', '完璧', '安心'].forEach(k => ok('S9 forbidden word ' + k, !html.includes(k), k));

console.log(`pass ${pass} / fail ${fail}`);
process.exit(fail ? 1 : 0);
