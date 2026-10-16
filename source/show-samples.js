// 架空の投稿での出力を一覧にする(画面と同じ既定の選び方: 拾った言葉・気持ち・出来事は先頭を選ぶ)。node source/show-samples.js [シード...]
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const RD = new Function(html.match(/<script id="core">([\s\S]*?)<\/script>/)[1] + '; return RD;')();
const seeds = process.argv.slice(2).map(Number); if (!seeds.length) seeds.push(0);
const POSTS = [
  ['嬉しい報告', '資格試験に受かった。3か月毎日勉強してきたので本当に嬉しい #資格勉強', 1, 1],
  ['悩み', '転職するか迷っている。今の仕事は安定しているけど、やりたいことから遠ざかっている気がして不安です', 0, 1],
  ['質問', 'ブログを続けるコツってありますか？3日で止まってしまいます', 2, 0],
  ['仕事の話', '今日はお客様向けの資料をNotionで作り直した。引き継ぎが楽になりそうで少しほっとしている', 3, 1],
  ['数字入り', '今朝は5時に起きて10kmを走りきった。先月は3kmがやっとだったので、成長を感じて泣きそうになった', 4, 2],
  ['短文', '疲れたけど楽しかった', 3, 2],
  ['落ち込み', '第一志望の面接に落ちた。悔しいけど、また次に向けて頑張る', 5, 1],
  ['近況', '最近 朝の散歩を日課にしている。歩くと頭が整理されて、仕事の段取りが前よりうまくいく気がする', 3, 1],
  ['コツの紹介', '朝活を続けるコツは、前の晩に着る服を決めておくこと。これだけで起きるのがかなり楽になった', 1, 1],
  ['短いつぶやき', '今日も無事に終わった', 4, 2],
  ['仕事の失敗', '今日は取引先に送る見積書の金額を間違えて、あとで訂正の連絡をした。かなり落ち込んでいる', 0, 0],
  ['お祝い', '本日、ついに自分のお店を開業しました。ここまで来られたのは、応援してくれた皆さんのおかげです', 4, 1],
  ['お知らせ', '来月から、毎週土曜の夜にオンラインの読書会を始めます。初めての方も気軽に参加してください', 2, 1],
  ['悲しい知らせ', '祖母が亡くなりました。まだ気持ちの整理がつきません', 0, 0],
  ['出産の報告', '先週、娘が生まれました。母子ともに元気です', 4, 1],
  ['質問の依頼', '何を食べたらいいと思いますか？ 最近 夕食がマンネリで困っています', 4, 2],
  ['ライブ前', '明日のライブ、ドキドキしてる', 3, 2],
  ['検診の結果', '癌検診に行ってきた。結果は問題なしでほっとした', 3, 1],
  ['結婚式の準備', '結婚式の準備で疲れ果てている', 3, 1],
  ['長文', '週末に初めてキャンプへ行ってきた。テントを立てるのに2時間もかかったし、火起こしも失敗したけど、夜に飲んだコーヒーが本当においしかった。帰り道では緊張がほどけてぐっすり眠ってしまった。また行きたいと思っている #キャンプ初心者', 0, 2]
];
function run(post, f, d, seed, memo) {
  const pk = RD.pickWords(post), em = pk.emos[pk.emos.length - 1], vb = pk.verbs[0]; // 画面の既定: 気持ちは最後に出てきたもの・短い投稿は言葉なし
  return { pk, plans: RD.build({ feeling: f, dist: d, word: pk.cands[0] && !pk.short ? pk.cands[0].w : '', num: pk.num, memo: memo || '', emo: em ? em.w : '', emoTone: em ? em.tone : '', verb: vb ? vb.w : '', verbTone: vb ? vb.tone : '', question: pk.question, teach: pk.teach, short: pk.short, heavy: pk.heavy, joy: pk.joy, seed }) };
}
console.log('## 架空の投稿8種(気持ち・距離感は投稿に合わせて1つ選択。メモなし)');
for (const [name, post, f, d] of POSTS) {
  console.log('\n### ' + name + '（' + RD.FEELINGS[f].name + ' / ' + RD.DISTS[d].name + '）');
  console.log('投稿: ' + post);
  const pk = RD.pickWords(post);
  console.log('拾い: 言葉=' + pk.cands.map(c => c.w).join(',') + ' 数量=' + pk.num + ' 気持ち=' + pk.emos.map(c => c.w).join(',') + ' 出来事=' + pk.verbs.map(c => c.w + '(' + c.tone + ')').join(',') + ' 質問=' + pk.question);
  for (const s of seeds) { console.log('-- 言い回し ' + (s + 1) + '/12'); run(post, f, d, s).plans.forEach((p, i) => console.log('[案' + (i + 1) + ' ' + p.type + '] ' + p.text.replace(/\n/g, ' / '))); }
}
console.log('\n## 6気持ち×3距離感(サンプル投稿・メモなし・言い回し ' + (seeds[0] + 1) + '/12)');
const SAMPLE = '今日 初めて3kmを走りきった。走るのが苦手だったので「完走」できただけで泣きそうになった #ランニング初心者';
for (let f = 0; f < 6; f++) for (let d = 0; d < 3; d++) {
  console.log('\n[' + RD.FEELINGS[f].name + ' / ' + RD.DISTS[d].name + ']');
  run(SAMPLE, f, d, seeds[0]).plans.forEach((p, i) => console.log('  案' + (i + 1) + ': ' + p.text.replace(/\n/g, ' / ')));
}
