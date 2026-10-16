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
// 言い回しの表の検査は下の S11 で行う
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

// ===== 言い回しのバリエーション(2026-10-16) =====
const NG = ['はじめまして', '初めまして', 'こんにちは', 'こんばんは', '拝見', '拝読', '読ませ', '読みました', '共感しました', '[。、，．！？!?]'];
const NG_RE = new RegExp(NG.join('|'));
const POLITE_END = /(です|ます|ました|でした|ません|ください|ございます|でしょう|ましょう|ますように)(か|ね|よ|よね|かな)?$/;
const POLITE_ANY = /(です|ます|ました|でした|ません|ください|ございます|でしょう|ましょう)/;
// 不自然・事実を作る言い回しの禁止パターン
const OSHITSUKE = /(ました|ます|です)よ$/;                      // 語尾「〜ましたよ」の押しつけ
const STATE_CLAIM = /心をつかまれ|楽しい気持ちに|嬉しくなっ|読み返したくなっ|心が軽く|気持ちが軽く|すっきり|やわらかくな|元気をもらい|元気が出|元気もらった|元気出た|勇気|反芻|引き込まれ|じんわり残る|温度が伝わ/; // 返信する人の状態を、根拠なく作る
const SELF_CLAIM = /同じ気持ちになり|覚えが|もそうでし|もそうだった|経験したことが|自分にもあり|自分にもあった|思い出し|重ね/; // 共感・経験を選んだときだけ許す
const THANKS_TEACH = /助かり|助かった|助かる|参考に|勉強に|学びに|役立|役に立|収穫|真似/;   // 教え・コツの投稿にだけ使ってよいお礼
const POS_ON_NEG = /好き|楽しい|楽しく|素敵|いい投稿|元気|引き込|嬉しい|よかった|参考になりました|勉強になりました/; // 重い気持ちをなぞる文に使ってはいけない
const HARD_VERB = /\{v\}(ところ|こと[をがはに])/;               // 動詞を「ところ・こと」で受ける硬い言い方(ほめる側の表)
const CASUAL_ANY = /ちゃ|じゃ|めっちゃ|ほんと|だよ|だね|ってる|ってた/;
// S11 表そのものの検査
const SLOT_KEYS = ['EMP', 'EMP2', 'REACT', 'CLOSE', 'EMO', 'VERB'];
function checkTable(tag, rows, ph) {
  ok(tag + ' >=4 variants', rows.length >= 4, rows.length);
  const flat = new Set();
  rows.forEach((tr, j) => {
    ok(tag + j + ' triple', Array.isArray(tr) && tr.length === 3 && tr.every(s => typeof s === 'string' && s.length > 0), tr);
    ok(tag + j + ' distinct across distances', new Set(tr).size === 3, tr);
    tr.forEach((s, d) => {
      ok(tag + j + 'd' + d + ' no NG/punct', !NG_RE.test(s), s);
      ok(tag + j + 'd' + d + ' no 〜ましたよ', !OSHITSUKE.test(s), s);
      ok(tag + j + 'd' + d + ' no state claim', !STATE_CLAIM.test(s), s);
      ok(tag + j + 'd' + d + ' placeholder', ph ? s.includes(ph) : !/\{|\}/.test(s), s);
      if (d < 2) ok(tag + j + 'd' + d + ' polite ending', POLITE_END.test(s), s);
      if (d === 0) ok(tag + j + 'd0 no casual', !CASUAL_ANY.test(s), s);
      if (d === 2) ok(tag + j + 'd2 no polite', !POLITE_ANY.test(s), s);
      flat.add(s);
    });
  });
}
const PH = (k) => k === 'REACT' ? '{w}' : k === 'EMO' ? '{e}' : k === 'VERB' ? '{v}' : '';
RD.FEELINGS.forEach((f, i) => SLOT_KEYS.forEach(k => {
  checkTable('S11 f' + i + k, f[k], PH(k));
  if (f.alt) checkTable('S11 f' + i + 'alt' + k, f.alt[k], PH(k));
  [f[k]].concat(f.alt ? [f.alt[k]] : []).forEach((rows, a) => rows.forEach((tr, j) => tr.forEach((s, d) => {
    if (i >= 1 && i <= 4) ok('S11 f' + i + (a ? 'alt' : '') + k + j + 'd' + d + ' no self claim', !SELF_CLAIM.test(s), s);
    if (k === 'VERB') ok('S11 f' + i + (a ? 'alt' : '') + 'VERB' + j + 'd' + d + ' no hard こと/ところ', !HARD_VERB.test(s), s);
    if (i === 1 && a === 1) ok('S11 f1alt ' + k + j + 'd' + d + ' no teach-only thanks', !THANKS_TEACH.test(s), s);
  })));
}));
['Q', 'QW', 'QA', 'QAW', 'QAN', 'QAWN', 'QA_TAIL', 'NUMLINE', 'VERB_OTHER', 'EMO_NEG', 'EMO_MIX', 'HEAVY1', 'HEAVY2', 'HEAVY3', 'JOY'].forEach(n => RD[n].forEach((tr, j) => tr.forEach((s, d) => {
  ok('S11 ' + n + j + 'd' + d + ' no 〜ましたよ', !OSHITSUKE.test(s), s); ok('S11 ' + n + j + 'd' + d + ' no state claim', !STATE_CLAIM.test(s), s);
  if (n !== 'QA' && n !== 'QAW') ok('S11 ' + n + j + 'd' + d + ' no self claim', !SELF_CLAIM.test(s) && !/同じ疑問|同じこと気になっ|実は私も|実は自分も/.test(s), s);
  if (/^HEAVY/.test(n)) ok('S11 ' + n + j + 'd' + d + ' not bright', !RD.POS_RE.test(s.replace('ありがとう', '')) && !/ぼちぼち|想像/.test(s), s);
  if (n === 'EMO_NEG') ok('S11 EMO_NEG' + j + 'd' + d + ' no positive echo', !POS_ON_NEG.test(s.replace('ありがとう', '')), s);
})));
checkTable('S11 Q', RD.Q, ''); checkTable('S11 QW', RD.QW, '{w}'); checkTable('S11 QA', RD.QA, ''); checkTable('S11 QAW', RD.QAW, '{w}');
checkTable('S11 QA_TAIL', RD.QA_TAIL, ''); checkTable('S11 EMO_NEG', RD.EMO_NEG, '{e}'); checkTable('S11 EMO_MIX', RD.EMO_MIX, '{e}'); checkTable('S11 QAN', RD.QAN, ''); checkTable('S11 QAWN', RD.QAWN, '{w}'); ['HEAVY1', 'HEAVY2', 'HEAVY3', 'JOY'].forEach(n => checkTable('S11 ' + n, RD[n], '')); checkTable('S11 NUMLINE', RD.NUMLINE, '{n}'); checkTable('S11 VERB_OTHER', RD.VERB_OTHER, '{v}');
eq('S11 SEEDS', RD.SEEDS, 12);

// S12 全組み合わせ(気持ち6×距離感3×巡回12×言葉×メモ×数量×気持ちの言葉×出来事×質問)
const MEMO = '私は先月 5キロ歩くのがやっとでした';
const first4 = (t) => Array.from(t.split('\n')[0]).slice(0, 4).join('');
const VERB_SETS = [['', ''], ['続けている', 'pos'], ['落ちた', 'other']];
let n12 = 0; const fails = []; const note = (tag, info) => { if (fails.length < 12) fails.push(tag + ' ' + JSON.stringify(info)); else fails.length === 12 && fails.push('...'); };
const stat = { consecSame: 0, consecTotal: 0, consecSameNoMemoP3: 0, bumpSame: 0, bumpTotal: 0, openerFallback: 0 };
for (let f = 0; f < 6; f++) for (let d = 0; d < 3; d++) for (const w of ['', '完走']) for (const memo of ['', MEMO]) for (const n of ['', '3km']) for (const [emo, et] of [['', ''], ['泣きそうになる', 'pos'], ['悔しい', 'neg']]) for (const [verb, vt] of VERB_SETS) for (const q of [false, true]) for (const teach of (f === 1 ? [false, true] : [false])) for (const short of (!w && !memo && !n && !emo && !verb ? [false, true] : [false])) {
  const prev = [];
  for (let seed = 0; seed < 12; seed++) {
    n12++;
    const o = { feeling: f, dist: d, word: w, num: n, memo, emo, emoTone: et, verb, verbTone: vt, question: q, teach, short, seed };
    const tag = `f${f}d${d}s${seed} w${w ? 1 : 0}m${memo ? 1 : 0}n${n ? 1 : 0}e${et || 0}v${vt || 0}q${q ? 1 : 0}t${teach ? 1 : 0}sh${short ? 1 : 0}`;
    const pl = RD.build(o), tx = pl.map(p => p.text);
    if (pl.length !== 3 || tx.some(x => !x)) { note(tag + ' empty', tx); continue; }
    if (new Set(tx).size !== 3) note(tag + ' same', tx);
    FORBID.forEach((re, i) => { if (tx.some(x => re.test(x))) note(tag + ' forbid' + i, tx); });
    if (tx.some(x => /,(?!\d)|(?<!\d),|\.(?=\s|$)|undefined|NaN|null/.test(x))) note(tag + ' ascii/undefined', tx);
    if (tx.some(x => NG_RE.test(memo ? x.replace(memo, '') : x))) note(tag + ' NG', tx);
    const op = tx.map(first4); if (new Set(op).size !== 3) { stat.openerFallback++; note(tag + ' opener', op); }
    if (tx.some(x => x.split('\n').length > 2)) note(tag + ' lines>2', tx);
    if (w && !(tx[0].includes('「完走」') && tx[1].includes('「完走」'))) note(tag + ' word', tx);
    if (!w && (tx[0].includes('「') || tx[1].includes('「'))) note(tag + ' brackets', tx);
    if (emo && !tx[0].includes(emo)) note(tag + ' emo', tx);
    if (verb && !tx.some(x => x.includes(verb))) note(tag + ' verb', tx);
    if (n && (f === 3 || f === 4) && !(memo && w && emo && verb) && !tx.some(x => x.includes('3km'))) note(tag + ' num', tx);
    if (!(n && (f === 3 || f === 4)) && tx.some(x => x.includes('3km'))) note(tag + ' num unexpected', tx);
    if (!emo && /泣きそうになる/.test(tx.join('\n'))) note(tag + ' emo unexpected', tx);
    if (!verb && /続けている|落ちた/.test(tx.join('\n'))) note(tag + ' verb unexpected', tx);
    if (memo ? !(tx[2].includes(MEMO) && !pl[2].needsMemo) : !pl[2].needsMemo) note(tag + ' memo', tx[2]);
    if (q && !(pl[1].type === '質問に反応する')) note(tag + ' qtype', pl[1].type);
    // 文体: メモの行は利用者の文なので除く
    const lines = tx.join('\n').split('\n').filter(l => l !== MEMO);
    if (d === 2 && lines.some(l => POLITE_ANY.test(l))) note(tag + ' close w/ polite', lines.filter(l => POLITE_ANY.test(l)));
    if (d < 2 && lines.some(l => !POLITE_END.test(l))) note(tag + ' polite lines', lines.filter(l => !POLITE_END.test(l)));
    if (d === 0 && lines.some(l => CASUAL_ANY.test(l))) note(tag + ' first w/ casual', lines.filter(l => CASUAL_ANY.test(l)));
    // 返信する人の状態を作らない / 共感・経験以外で自分の経験を言わない / 押しつけ語尾
    const bodyLines = tx.join('\n').split('\n').filter(l => l !== MEMO);
    if (bodyLines.some(l => STATE_CLAIM.test(l))) note(tag + ' state claim', bodyLines.filter(l => STATE_CLAIM.test(l)));
    if (bodyLines.some(l => OSHITSUKE.test(l))) note(tag + ' ましたよ', bodyLines.filter(l => OSHITSUKE.test(l)));
    if (f >= 1 && f <= 4 && bodyLines.some(l => SELF_CLAIM.test(l) || /同じ疑問|同じこと気になっ|実は私も|実は自分も/.test(l))) note(tag + ' self claim', bodyLines.filter(l => SELF_CLAIM.test(l)));
    if (f === 1 && !teach && bodyLines.some(l => THANKS_TEACH.test(l))) note(tag + ' teach-thanks on non-teach', bodyLines.filter(l => THANKS_TEACH.test(l)));
    if (f === 1 && teach && !(bodyLines.length)) note(tag + ' teach empty', tx);
    if (et === 'neg') { const el = bodyLines.filter(l => l.includes(emo)); if (!el.length || el.some(l => POS_ON_NEG.test(l.replace('ありがとう', '')))) note(tag + ' positive echo of heavy emotion', el); }
    if ((et === 'neg' || vt === 'other') && bodyLines.some(l => RD.POS_RE.test(l.replace('ありがとう', '')))) note(tag + ' bright phrase in gentle mode', bodyLines.filter(l => RD.POS_RE.test(l.replace('ありがとう', ''))));
    if (short && !memo && (tx[0].split('\n').length > 1 || tx[2].split('\n').length > 1)) note(tag + ' short post not one line', tx);
    // 連続するシードの変化
    if (prev.length) {
      for (let p = 0; p < 3; p++) { stat.consecTotal++; if (prev[p] === tx[p]) { stat.consecSame++; if (!(p === 2 && memo)) stat.consecSameNoMemoP3++; } }
      if (prev.join('\n') === tx.join('\n')) { if (et === 'neg' || vt === 'other') stat.gentleIdentical = (stat.gentleIdentical || 0) + 1; else note(tag + ' consecutive seeds identical', tx); }
    }
    prev.length = 0; tx.forEach(x => prev.push(x));
    // 案ごとの切り替え(bump)
    for (let i = 0; i < 3; i++) { const b = [0, 0, 0]; b[i] = 1; const t2 = RD.build(Object.assign({}, o, { bump: b }))[i].text; stat.bumpTotal++; if (t2 === tx[i]) stat.bumpSame++; }
  }
}
ok('S12 matrix ' + n12 + ' builds all pass', fails.length === 0, fails);
console.log('S12 stats', JSON.stringify(stat), 'builds', n12);
// 巡回: 12通りで案ごとに何種類の文が出るか(メモ・言葉なし/あり)
for (const [w, memo] of [['', ''], ['完走', ''], ['完走', MEMO]]) for (let f = 0; f < 6; f++) for (let d = 0; d < 3; d++) {
  const sets = [0, 1, 2].map(() => new Set());
  for (let s = 0; s < 12; s++) RD.build({ feeling: f, dist: d, word: w, num: '', memo, seed: s }).forEach((p, i) => sets[i].add(p.text));
  ok('S12 variety f' + f + 'd' + d + (w ? 'W' : '') + (memo ? 'M' : ''), sets[0].size >= 6 && sets[1].size >= 6 && sets[2].size >= (memo ? 4 : 6), sets.map(x => x.size));
}
// 1行の案と2行の案が混ざる(言葉なし・メモなしの基本形で、12通りのうち1行の案と2行の案がどの案にも出る)
for (let i = 0; i < 3; i++) { const ls = new Set(); for (let s = 0; s < 12; s++) ls.add(RD.build({ feeling: 0, dist: 1, word: '', num: '', memo: '', seed: s })[i].text.split('\n').length); ok('S12 line widths plan' + (i + 1), ls.has(1) && ls.has(2), [...ls]); }
// 同じシード・同じ入力なら必ず同じ(乱数を使っていない)
{ const o = { feeling: 2, dist: 1, word: '完走', num: '3km', memo: '', emo: '緊張する', verb: '始めた', verbTone: 'pos', seed: 7 }; eq('S12 deterministic', RD.build(o), RD.build(Object.assign({}, o))); }
eq('S12 seed wraps', RD.build({ feeling: 1, dist: 2, word: '', num: '', memo: '', seed: 13 }), RD.build({ feeling: 1, dist: 2, word: '', num: '', memo: '', seed: 1 }));
eq('S12 negative seed', RD.build({ feeling: 1, dist: 2, word: '', num: '', memo: '', seed: -1 }), RD.build({ feeling: 1, dist: 2, word: '', num: '', memo: '', seed: 11 }));
ok('S12 no Math.random in core', !/Math\.random/.test(m[1]));
// テンプレート記号や特殊文字が気持ち・動詞に入っても壊れない
{ const x = RD.build({ feeling: 4, dist: 0, word: '', num: '', memo: '', emo: '{e}$&', verb: '{v}', verbTone: 'pos', seed: 0 }).map(p => p.text).join('\n'); ok('S12 template marks in emo/verb', !/\{|\}/.test(x), x); }

// S13 気持ちの言葉・出来事・質問の拾い
const SG = (p) => RD.pickWords(p);
const EW = (p) => SG(p).emos.map(c => c.w), VW = (p) => SG(p).verbs.map(c => c.w + ':' + c.tone);
eq('S13 emo basic', EW('今日は嬉しかった'), ['嬉しい']);
eq('S13 emo hiragana', EW('うれしくて泣いた'), ['嬉しい', '泣いてしまう']);
eq('S13 emo cry soon', EW('泣きそうになった'), ['泣きそうになる']);
eq('S13 emo order of appearance', EW('不安で緊張して疲れた'), ['不安になる', '緊張する', '疲れる']);
eq('S13 emo max 3', EW('嬉しい 悔しい 不安 楽しい 疲れた').length, 3);
eq('S13 emo negation skipped', EW('疲れてない 嬉しくない'), []);
eq('S13 emo negation 2', EW('疲れていない'), []);
eq('S13 emo spicy food skipped', EW('辛いカレーを食べた'), []);
eq('S13 emo tsurai', EW('しんどかった つらい'), ['しんどい', 'つらい']);
eq('S13 emo forms', [EW('悔しくて'), EW('悔しさが残る'), EW('不安だった'), EW('楽しい時間'), EW('びっくりした'), EW('緊張する'), EW('ほっとした'), EW('安心した'), EW('ワクワク'), EW('寂しかった'), EW('怖くて'), EW('焦って'), EW('感動した'), EW('イライラ'), EW('迷っている'), EW('モヤモヤ'), EW('恥ずかしい')].map(a => a[0]),
  ['悔しい', '悔しい', '不安になる', '楽しい', 'びっくりする', '緊張する', 'ほっとする', '安心する', 'ワクワクする', '寂しい', '怖い', '焦る', '感動する', 'イライラする', '迷う', 'モヤモヤする', '恥ずかしい']);
eq('S13 emo none', EW('走って帰った'), []);
eq('S13 emo url mention removed', EW('@嬉しい さん https://example.com/嬉しい'), []);
eq('S13 verb basic', VW('3km走りきった'), ['走りきった:pos']);
eq('S13 verb continuing', VW('毎朝続けている'), ['続けている:pos']);
eq('S13 verb past', VW('3年続けた'), ['続けた:pos']);
eq('S13 verb neg tone', VW('試験に落ちた'), ['落ちた:other']);
eq('S13 verb quit', VW('会社をやめた'), ['やめた:other']);
eq('S13 verb quit2', VW('部活を辞めました'), ['やめた:other']);
eq('S13 verb passed', VW('試験に受かった'), ['受かった:pos']);
eq('S13 verb study', VW('毎日勉強している'), ['勉強している:pos']);
eq('S13 verb practice past', VW('練習した'), ['練習した:pos']);
eq('S13 verb order', VW('走りきったあと転んだ'), ['走りきった:pos', '転んだ:other']);
eq('S13 ambiguous verbs not picked', VW('今日も無事に終わった 休んだ 買った 決めた 引っ越した 通っている'), []);
eq('S13 mistake verbs', VW('金額を間違えた 連絡を忘れた'), ['間違えた:other', '忘れた:other']);
eq('S13 emo fall/shock', [EW('かなり落ち込んでいる'), EW('ショックだった'), EW('凹んだ')].map(a => a[0] + ':' + SG('落ち込んだ').emos[0].tone), ['落ち込む:neg', 'ショックを受ける:neg', '凹む:neg']);
eq('S13 verb negated skipped', VW('続けていない 始めなかった 落ちなかった'), []);
eq('S13 verb not match 初めて', VW('初めて行った'), []);
eq('S13 verb start', VW('ブログを始めた'), ['始めた:pos']);
eq('S13 verb max 3', VW('走りきった 始めた 続けている 頑張った 受かった').length, 3);
eq('S13 verb none', VW('おいしいコーヒー'), []);
eq('S13 question', [SG('どう思いますか').question, SG('これで合ってますか？').question, SG('どなたか教えてください').question, SG('どうすればいいでしょうか').question, SG('今日は楽しかった').question, SG('').question], [true, true, true, true, false, false]);
eq('S13 sample emo/verb', [SG('今日 初めて3kmを走りきった。走るのが苦手だったので「完走」できただけで泣きそうになった #ランニング初心者').emos.map(c => c.w), SG('今日 初めて3kmを走りきった。走るのが苦手だったので「完走」できただけで泣きそうになった #ランニング初心者').verbs.map(c => c.w)], [['泣きそうになる'], ['走りきった']]);
// レビュー指摘の回帰(願望・仮定・依頼・過去の否定・第三者・慣用句・打ち消し)
for (const s of ['仕事をやめたい', '辞めたいと思っている', '走ったことがない', '始めたい', '合格したい', '完走したい', '引っ越したい', '失敗したくない', '挑戦してみたい', '続けてください', '決めてください', '終わってほしい', '受かったら嬉しい', '落ちたら嫌だ', '転んでも大丈夫', '走ったことはなかった', 'やめたことがある'.replace('ある', 'ない')]) eq('S13 verb not wish/cond: ' + s, VW(s), []);
for (const s of ['不安なく使える', '不安にならない', '緊張しない', '迷いなく決めた', '安心して使えるツール', '辛いキムチを食べた', '辛さ控えめ', '焦る必要はない', '彼は嬉しいと言った', '友達が疲れたと言っていた', '怖いもの知らず', '楽しいわけがない']) eq('S13 emo not: ' + s, EW(s), []);
eq('S13 emo te-iru kept', [EW('迷っている'), EW('疲れている'), EW('焦っていた')].map(a => a[0]), ['迷う', '疲れる', '焦る']);
eq('S13 verb kept', [VW('走ったよ'), VW('3年続けてきた'), VW('受かった。嬉しい')].map(a => a[0]), ['走った:pos', '続けている:pos', '受かった:pos']);
eq('S13 question not ですから', [SG('忙しいですからね').question, SG('頑張りますから').question, SG('やってみませんか').question, SG('これで合ってますか').question], [false, false, false, true]);
eq('S13 emo tone', [SG('悔しい').emos[0].tone, SG('嬉しい').emos[0].tone, SG('不安だった').emos[0].tone], ['neg', 'pos', 'neg']);
eq('S13 teach', [SG('朝活のコツは早起きです').teach, SG('手順は3つです').teach, SG('おすすめは緑茶です').teach, SG('続けるコツを教えてください').teach, SG('今日は議事録をまとめた').teach, SG('ポイントカードを作った').teach, SG('解決方法が見つからなくて困っている').teach], [true, true, true, false, false, false, false]);
eq('S13 short', [SG('疲れたけど楽しかった').short, SG('あ'.repeat(24)).short, SG('あ'.repeat(25)).short, SG('').short, SG('   ').short], [true, true, false, false, false]);
eq('S13 emo tone heavy/neutral/pos', [SG('泣きそう').emos[0].tone, SG('緊張した').emos[0].tone, SG('嬉しい').emos[0].tone, SG('ほっとした').emos[0].tone, SG('楽しかった').emos[0].tone], ['mix', 'mix', 'pos', 'pos', 'pos']);
// お礼の言い回しは投稿の種類で変わる
{ const a = RD.build({ feeling: 1, dist: 1, word: '', num: '', memo: '', teach: true, seed: 0 }).map(p => p.text).join('|'), b = RD.build({ feeling: 1, dist: 1, word: '', num: '', memo: '', teach: false, seed: 0 }).map(p => p.text).join('|'); ok('S13 thanks tables differ by teach', a !== b && THANKS_TEACH.test(a.replace(/\|/g, '\n')) && !THANKS_TEACH.test(b), [a, b]); }
eq('S13 heavy', [SG('祖母が亡くなりました').heavy, SG('母が入院しました').heavy, SG('入院しなかった').heavy, SG('今日は走りきった').heavy], [true, true, false, false]);
eq('S13 joy', [SG('資格試験に合格した').joy, SG('娘が生まれました').joy, SG('お店を開業しました').joy, SG('合格しなかった').joy, SG('合格したい').joy, SG('疲れた').joy], [true, true, true, false, false, false]);
eq('S13 question words', [SG('受かったよ？信じられる？').question, SG('何を食べたらいいと思いますか').question, SG('今日はどう？ ご飯どこにする？').question], [false, true, true]);
// 重い話題: 質問も感想も作らない・明るい言い回しを使わない・1行ずつ
for (let f = 0; f < 6; f++) for (let d = 0; d < 3; d++) for (let s = 0; s < 12; s++) {
  const pl = RD.build({ feeling: f, dist: d, word: '完走', num: '3km', memo: '', emo: '悔しい', emoTone: 'neg', verb: '落ちた', verbTone: 'other', question: true, heavy: true, joy: true, seed: s }), tx = pl.map(x => x.text);
  ok('S14 heavy f' + f + 'd' + d + 's' + s, new Set(tx).size === 3 && tx.every(x => x.split('\n').length === 1 && !RD.POS_RE.test(x.replace('ありがとう', '')) && !/[「」?？]|おめでとう|想像|ぼちぼち|同じ疑問/.test(x)) && pl[1].type === 'ひとこと添える', tx);
}
// お祝い: お礼・感想・応援は plan1 に「おめでとう」。共感・質問・経験には入れない
for (let f = 0; f < 6; f++) for (let s = 0; s < 12; s++) {
  const tx = RD.build({ feeling: f, dist: 1, word: '開業', num: '', memo: '', joy: true, seed: s }).map(x => x.text);
  ok('S14 joy f' + f + 's' + s, [1, 3, 4].includes(f) ? tx[0].includes('お祝い') || tx[0].includes('おめでとう') : !/おめでとう|お祝い/.test(tx.join('\n')), tx);
}
// 共感・経験以外では、質問の投稿でも「同じ疑問」を言わない / 共感・経験では使える
for (let f = 0; f < 6; f++) for (let d = 0; d < 3; d++) for (let s = 0; s < 12; s++) for (const w of ['', '検算']) {
  const tx = RD.build({ feeling: f, dist: d, word: w, num: '', memo: '', question: true, seed: s }).map(x => x.text).join('\n');
  if (f >= 1 && f <= 4) ok('S14 question no claim f' + f + 'd' + d + 's' + s, !/同じ疑問|同じこと気になっ|実は私も|実は自分も/.test(tx), tx);
}
eq('S13 null', [RD.pickWords(null).emos, RD.pickWords(null).verbs, RD.pickWords(null).question], [[], [], false]);

// S9 静的チェック: 保存系・外部送信が無い
const noStrip = html.replace(/<script id="core">[\s\S]*?<\/script>/, '');
const noEmos = html.replace(/var EMOS = \[[\s\S]*?\n  \];/, '');
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
// 広告表現の禁止語は、気持ちの言葉の辞書(EMOS: 「安心する」など利用者の投稿の言葉が入る)だけを除いたページ全体(言い回しの表を含む)で見る
['バズる', '刺さる', '好かれる', '自然な', '失礼がない', '正しい敬語', '完璧', '安心'].forEach(k => ok('S9 forbidden word ' + k, !noEmos.includes(k), k));

console.log(`pass ${pass} / fail ${fail}`);
process.exit(fail ? 1 : 0);
