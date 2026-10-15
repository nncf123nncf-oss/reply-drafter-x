// 投稿カード用の実画面を撮る(Chrome headless / CDP)。実行: node source/shoot.js <出力フォルダ> [YYYY-MM-DD]
const fs = require('fs'), path = require('path');
const { launch } = require('./cdp');
const OUT = path.resolve(process.argv[2]); const DATE = process.argv[3] || '2026-10-15';
const PAGE = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');
fs.mkdirSync(OUT, { recursive: true });
const set = (b, id, v) => b.ev(`(()=>{const e=document.getElementById(${JSON.stringify(id)});e.value=${JSON.stringify(v)};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
const click = (b, sel, i) => b.ev(`document.querySelectorAll(${JSON.stringify(sel)})[${i}].click()`);
// Card2の入力(すべて架空): 別の気持ち・距離感・投稿。一言メモは空
const POST2 = '煮物のコツは「火を止めて30分置く」こと。味が染みて、家族に好評だった #作り置き';
(async () => {
  const b = await launch(9383);
  const rect = sel => b.ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;const r=e.getBoundingClientRect();return {top:r.top+scrollY,bottom:r.bottom+scrollY,left:r.left,right:r.right,h:r.height}})()`);
  // Card1: デスクトップ1000px・2カラム。サンプル投稿・共感したい・何度か話した・一言メモあり
  await b.open(PAGE, 1000, 1300, 2, false);
  await b.ev(`document.getElementById('sample').click()`);
  await click(b, '#feelings button', 0); await click(b, '#dists button', 1);
  await set(b, 'memo', '私は先月 5キロ歩くのがやっとでした'); await b.sleep(400);
  const lay = await rect('.layout'), out = await rect('.sticky'), inp = await rect('.layout > div:first-child');
  console.log('card1', JSON.stringify({ lay, out, inp }));
  await b.shot(path.join(OUT, 'source-desktop-full.png'), { x: 0, y: 0, width: 1000, height: await b.ev('document.documentElement.scrollHeight') });
  // Card2: 375px・DPR2。お礼を伝えたい・初めて話す・別の投稿・一言メモは空
  await b.open(PAGE, 375, 900, 2, true);
  await set(b, 'post', POST2); await click(b, '#feelings button', 1); await click(b, '#dists button', 0); await b.sleep(400);
  const h2 = await rect('#out-h'), res = await rect('#results');
  console.log('card2', JSON.stringify({ h2, res, texts: await b.ev(`[...document.querySelectorAll('#results textarea')].map(t=>t.value)`) }));
  await b.shot(path.join(OUT, 'source-mobile375-full.png'), { x: 0, y: 0, width: 375, height: await b.ev('document.documentElement.scrollHeight') });
  b.close(); setTimeout(() => process.exit(0), 300);
})().catch(e => { console.error(e); process.exit(2); });
