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


// レビュー①の反映の確認
let r1 = RD.build({ feeling: 0, dist: 0, word: '', num: '', memo: '私も｡良かった､ね {x} 「」 {n}{w}' })[2].text;
ok('R1 halfwidth punct/braces removed', !/[｡､{}]/.test(r1) && !/「」/.test(r1), r1);
r1 = RD.build({ feeling: 0, dist: 0, word: '{n}', num: '3km', memo: '' });
ok('R2 template marks in word', r1.every(p => !/「」|\{|\}/.test(p.text)), r1.map(p => p.text));
r1 = RD.build({ feeling: 3, dist: 0, word: '完走', num: '{w}', memo: '' })[0].text;
ok('R2 template marks in num', !/\{|\}/.test(r1), r1);
eq('R3 jp mention removed', W('@田中太郎 さん @タナカ さんへ コーヒー'), ['コーヒー']);
eq('R3 mention fullwidth at', W('＠タナカ です'), []);
eq('R5 long num skipped', N('1' + '0'.repeat(30) + '人'), '');
eq('R6 prolonged mark alone', W('すごーーーい'), []);
eq('R6 english stop', W('This is a great day'), ['great', 'day']);

// 例: サンプル(スクリーンショット用)
const sp = RD.pickWords('今日 初めて3kmを走りきった。走るのが苦手だったので「完走」できただけで泣きそうになった #ランニング初心者');
eq('sample picks', [sp.cands.map(c => c.w), sp.num], [['完走', 'ランニング初心者', '苦手'], '3km']);

// S10 Ollamaモードの後処理(不合格例・境界例)
const SRC = '今日 初めて3kmを走りきった。「完走」できた #ランニング初心者 私は先月 5キロ歩くのがやっとでした';
const J = (raw, o) => RD.judge(raw, Object.assign({ dist: 1, source: SRC }, o || {}));
const rs = (r) => r.reasons.join('|');
eq('S10 sanitize punct', RD.sanitizeAI('すごいですね！頑張りましょう。応援してます、ね?'), 'すごいですね\n頑張りましょう\n応援してます ね');
eq('S10 sanitize emoji', RD.sanitizeAI('おめでとう🎉🎉 すごい😀'), 'おめでとう すごい');
eq('S10 sanitize label', RD.sanitizeAI('案1: 完走おめでとうございます\n- 次も楽しみです'), '完走おめでとうございます\n次も楽しみです');
eq('S10 sanitize quotes md', RD.sanitizeAI('**完走**したんですね "すごい"'), '完走 したんですね すごい');
ok('S10 clean pass', J('「完走」のところ 励みになりました\nありがとうございます').ok, J('「完走」のところ 励みになりました\nありがとうございます'));
ok('S10 punct removed in text', !/[。、！？!?]/.test(J('「完走」できたのですね！すごいです。').text), J('「完走」できたのですね！すごいです。').text);
['はじめまして 完走おめでとうございます', '初めまして 完走おめでとうございます', 'こんにちは 完走おめでとうございます', '拝見しました 完走おめでとうございます', '拝読しました 完走おめでとうございます', '読ませていただきました 完走おめでとうございます', '読みました 完走おめでとうございます'].forEach((t, i) => ok('S10 NG word ' + i, !J(t).ok && /NG語/.test(rs(J(t))), J(t)));
// 事実ガード: 数字
ok('S10 number ok (3km)', J('3kmも走ったのですね すごいです').ok, J('3kmも走ったのですね すごいです'));
ok('S10 number fullwidth ok', J('３kmも走ったのですね すごいです').ok);
ok('S10 number 5 from memo ok', J('先月は5キロがやっとだったのですね すごいです').ok);
ok('S10 number invented ng', !J('10kmも走ったのですね すごいです').ok && /元にない数字\(10\)/.test(rs(J('10kmも走ったのですね すごいです'))));
ok('S10 number 30 vs 3 ng', !J('30分も走ったのですね すごいです').ok);
eq('S10 sanitize keeps leading decimal', RD.sanitizeAI('3.5kmも走った\n2. 次の案'), '3.5kmも走った\n次の案');
ok('S10 decimal ng', !J('3.5kmも走ったのですね すごいです').ok);
ok('S10 comma number', J('1,000人の話ですね すごいです', { source: '1000人が来た' }).ok, J('1,000人の話ですね すごいです', { source: '1000人が来た' }));
ok('S10 no numbers in source, number in output ng', !J('2人で走ったのですね すごいです', { source: '走った' }).ok);
// 事実ガード: 「」の語
ok('S10 quote in source ok', J('「完走」できたのですね すごいです').ok);
ok('S10 quote not in source ng', !J('「優勝」できたのですね すごいです').ok && /元にない「」の語\(優勝\)/.test(rs(J('「優勝」できたのですね すごいです'))));
ok('S10 quote spaced tolerant', J('「完 走」できたのですね すごいです').ok);
ok('S10 quote from memo ok', J('「5キロ歩く」ところから始めたのですね すごいです').ok);
ok('S10 quote from word ok', J('「ゴール」までよく走りましたね すごいです', { source: '走った\nゴール' }).ok);
ok('S10 quote double-bracket ng', !J('『優勝』できたのですね すごいです').ok);
// 長さ
const L = (n) => 'あ'.repeat(n);
ok('S10 empty ng', !J('').ok && !J('   ').ok && !J('！？。').ok && rs(J('')) === '空');
ok('S10 len 120 ok', J(L(120)).ok, J(L(120)).reasons);
ok('S10 len 121 ng', !J(L(121)).ok && /長すぎる/.test(rs(J(L(121)))));
ok('S10 len 10 ok', J(L(10)).ok);
ok('S10 len 9 ng', !J(L(9)).ok && /短すぎる/.test(rs(J(L(9)))));
ok('S10 len counts after cleaning', J(L(120) + '。。。').ok);
// 距離感
const T1 = '完走おめでとうございます\n頑張りましたね\nありがとうございます';
ok('S10 close w/ polite ng', !J(T1, { dist: 2 }).ok && /距離感/.test(rs(J(T1, { dist: 2 }))));
ok('S10 close w/ casual ok', J('「完走」すごいね\n頑張ったんだね\n本当に励みになったよ', { dist: 2 }).ok, J('「完走」すごいね\n頑張ったんだね\n本当に励みになったよ', { dist: 2 }));
ok('S10 first w/ casual ng', !J('完走したんだね\n頑張ったんだね\n励みになったよ', { dist: 0 }).ok);
ok('S10 first w/ polite ok', J('完走されたのですね\n励みになりました\nありがとうございます', { dist: 0 }).ok);
ok('S10 mid accepts both', J('完走したんだね\n励みになりました', { dist: 1 }).ok && J('完走されたのですね\n励みになりました', { dist: 1 }).ok);
ok('S10 close boundary 1 of 2 polite ng (any polite line)', !J('完走すごいね\n励みになりました', { dist: 2 }).ok);
ok('S10 close all casual ok', J('完走すごいね\n励みになったよ', { dist: 2 }).ok);
ok('S10 lines 3 ok / 4 ng', J('完走すごいね\n頑張ったね\n励みになったよ', { dist: 2 }).ok && !J('完走すごいね\n頑張ったね\n励みになったよ\nまたね', { dist: 2 }).ok);
ok('S10 15 short lines ng', !J(Array(15).fill('完走').join('\n'), { dist: 1 }).ok && /行が多い/.test(rs(J(Array(15).fill('完走').join('\n'), { dist: 1 }))));
ok('S10 url / mention ng', !J('完走のお話 https://example.com 励みです').ok && !J('@someone 完走のお話 励みです').ok && !J('＠タナカ 完走のお話 励みです').ok);
ok('S10 kanji numeral invented ng', !J('三日続けたのですね 励みになりました').ok && /元にない漢数字\(三日\)/.test(rs(J('三日続けたのですね 励みになりました'))));
ok('S10 kanji numeral in source ok', J('三日続けたのですね 励みになりました', { source: '三日続けた' }).ok);
ok('S10 common kanji words not flagged', J('一番うれしいのは 一緒に走れたことですね 一言だけ').ok);
ok('S10 close boundary 2 of 3 polite ng', !J('完走すごいです\n励みになりました\nありがとう', { dist: 2 }).ok);
ok('S10 first boundary 1 of 2 casual ok', J('完走されたのですね\n励みになったよ', { dist: 0 }).ok);
ok('S10 ambiguous endings not flagged', J('完走おめでとう\n頑張ったよ\nありがとう', { dist: 0 }).ok, J('完走おめでとう\n頑張ったよ\nありがとう', { dist: 0 }));
// parsePlans
eq('S10 parse plain', RD.parsePlans('{"plans":["a","b","c"]}'), ['a', 'b', 'c']);
eq('S10 parse fence', RD.parsePlans('```json\n{"plans":["a","b","c"]}\n```'), ['a', 'b', 'c']);
eq('S10 parse prefix text', RD.parsePlans('はい こちらです {"plans":["a","b","c"]} 以上'), ['a', 'b', 'c']);
eq('S10 parse array', RD.parsePlans('["a","b","c"]'), ['a', 'b', 'c']);
eq('S10 parse object keys', RD.parsePlans('{"1":"a","2":"b","3":"c"}'), ['a', 'b', 'c']);
eq('S10 parse objs with text', RD.parsePlans('{"plans":[{"text":"a"},{"text":"b"},{"text":"c"}]}'), ['a', 'b', 'c']);
eq('S10 parse 4 to 3', RD.parsePlans('{"plans":["a","b","c","d"]}'), ['a', 'b', 'c']);
eq('S10 parse 2', RD.parsePlans('{"plans":["a","b"]}'), ['a', 'b']);
eq('S10 parse invalid', RD.parsePlans('これはJSONではありません'), null);
eq('S10 parse truncated json keeps the strings', RD.parsePlans('{"plans":["a","b"'), ['a', 'b']);
eq('S10 parse real malformed output (newline mark outside string)', RD.parsePlans('{"plans":["x1"],\\n"x2",\\n"x3"]}'), ['x1', 'x2', 'x3']);
eq('S10 parse escaped newline inside', RD.parsePlans('{"plans":["a\\nb","c"]}'), ['a\nb', 'c']);
eq('S10 parse empty/null/{}', [RD.parsePlans(''), RD.parsePlans(null), RD.parsePlans('{}')], [null, null, null]);
eq('S10 parse non-string item', RD.parsePlans('{"plans":[1,null,"c"]}'), ['', '', 'c']);
// evaluate / pickBest
const CT = { dist: 1, source: '今日 初めて3kmを走りきった。「完走」できた' };
const good = ['「完走」のところ 励みになりました', '3kmも走ったのですね もう少し教えてください', 'ありがとうございます\n励みになりました'];
let ev = RD.evaluate(good, CT);
eq('S10 evaluate all ok', ev.map(e => e.ok), [true, true, true]);
eq('S10 failCount 0', RD.failCount(ev), 0);
ev = RD.evaluate([good[0], good[0], 'はじめまして 励みになりました'], CT);
eq('S10 evaluate dup + NG', ev.map(e => e.ok), [true, false, false]);
ok('S10 dup reason', /他の案と同じ/.test(rs(ev[1])), ev[1]);
ev = RD.evaluate(['「完走」のところ 励みになりました'], CT);
eq('S10 evaluate missing', ev.map(e => e.ok), [true, false, false]);
eq('S10 failCount 2', RD.failCount(ev), 2);
eq('S10 evaluate null list', RD.evaluate(null, CT).map(e => e.ok), [false, false, false]);
const e1 = RD.evaluate([good[0], 'こんにちは 励みになりました', '10kmも走りましたね すごいです'], CT), e2 = RD.evaluate(['拝見しました 励みになりました', good[1], good[2]], CT);
eq('S10 pickBest combine', RD.pickBest([e1, e2]), [good[0], good[1], good[2]]);
eq('S10 pickBest fallback null', RD.pickBest([e1]), [good[0], null, null]);
eq('S10 pickBest none', RD.pickBest([]), [null, null, null]);
eq('S10 pickBest no dup across attempts', RD.pickBest([RD.evaluate([good[0], 'x', 'x'], CT), RD.evaluate([good[0], good[1], good[2]], CT)]), [good[0], good[1], good[2]]);
// buildPrompt
const BP = RD.buildPrompt({ feeling: 1, dist: 2, post: '今日 3kmを走った', word: '完走', num: '3km', memo: '' });
ok('S10 prompt: feeling required in all 3', BP.system.includes('お礼を伝えたい') && BP.system.includes('3案すべてに必ず込める') && BP.system.includes('感謝'), BP.system);
ok('S10 prompt style close', BP.system.includes('タメ口'));
ok('S10 prompt: no invented memo when empty', BP.system.includes('自分の体験は書かず') && !BP.user.includes('自分の一言'));
ok('S10 prompt user has post/word', BP.user.includes('今日 3kmを走った') && BP.user.includes('触れてほしい言葉: 完走'));
const BP2 = RD.buildPrompt({ feeling: 0, dist: 0, post: 'x', word: '', num: '', memo: '朝は走る、夜は休む。' });
ok('S10 prompt memo cleaned', BP2.system.includes('「朝は走る 夜は休む」') && BP2.user.includes('自分の一言: 朝は走る 夜は休む') && !BP2.user.includes('触れてほしい言葉'), BP2.user);
ok('S10 prompt post cap 2000', RD.buildPrompt({ feeling: 0, dist: 0, post: 'あ'.repeat(5000), word: '', num: '', memo: '' }).user.length < 2200);
for (let f = 0; f < 6; f++) for (let d = 0; d < 3; d++) { const p = RD.buildPrompt({ feeling: f, dist: d, post: 'p', word: '', num: '', memo: '' }); ok('S10 prompt f' + f + 'd' + d, p.system.includes(RD.FEELINGS[f].name) && p.user.includes(RD.DISTS[d].name)); }

// S9 静的チェック: 保存系・外部送信が無い
const noStrip = html.replace(/<script id="core">[\s\S]*?<\/script>/, '');
['localStorage', 'sessionStorage', 'indexedDB', 'download', 'navigator.share', 'XMLHttpRequest', 'innerHTML', 'insertAdjacentHTML', 'eval(', 'document.write', 'location.hash', 'history.'].forEach(k => ok('S9 no ' + k, !html.includes(k), k));
// S9b 通信先: fetch は localhost:11434 だけ(Ollamaモード)。それ以外の外部送信を足していない
ok('S9b fetch only via OLLAMA base', (html.match(/fetch\(([^,)]*)/g) || []).every(x => /fetch\(OLLAMA \+ '\/api\/(tags|chat)'$/.test(x)), html.match(/fetch\(([^,)]*)/g));
eq('S9b fetch count', (html.match(/fetch\(/g) || []).length, 2);
ok('S9b OLLAMA const is localhost:11434', html.includes("var OLLAMA = 'http://localhost:11434';"));
const urls = [...new Set((html.match(/https?:\/\/[^\s"'<>)）、。]+/g) || []).map(u => u.replace(/\/+$/, '')))].sort();
eq('S9b all urls', urls, ['http://localhost:11434', 'https://michi-portfolio.vercel.app', 'https://nncf123nncf-oss.github.io', 'https://static.cloudflareinsights.com/beacon.min.js']);
ok('S9b no wildcard origin advice', !/OLLAMA_ORIGINS[^\n]*\*/.test(html.replace(/すべてを許可する設定（\*）/g, '')), 'wildcard');
ok('S9b no sendBeacon/WebSocket/EventSource', !/sendBeacon|WebSocket|EventSource|importScripts/.test(html));
ok('S9 clipboard only writeText', (html.match(/clipboard\.\w+/g) || []).every(x => x === 'clipboard.writeText'), html.match(/clipboard\.\w+/g));
ok('S9 no short url', !/(forms\.gle|lin\.ee|bit\.ly|t\.co\/)/.test(html));
ok('S9 no href=#', !/href="#"/.test(html));
['バズる', '刺さる', '好かれる', '自然な', '失礼がない', '正しい敬語', '完璧', '安心'].forEach(k => ok('S9 forbidden word ' + k, !html.includes(k), k));

console.log(`pass ${pass} / fail ${fail}`);
process.exit(fail ? 1 : 0);
