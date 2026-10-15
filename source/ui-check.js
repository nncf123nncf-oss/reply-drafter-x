// 実ブラウザ(Chrome headless / CDP)で画面の動きを確かめる。実行: node source/ui-check.js
const path = require('path');
const { launch } = require('./cdp');
const PAGE = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');
let pass = 0, fail = 0;
const ok = (name, c, info) => { if (c) pass++; else { fail++; console.log('NG', name, info === undefined ? '' : JSON.stringify(info)); } };
(async () => {
  const b = await launch(9382);
  const errs = [];
  for (const [w, label] of [[375, 'mobile'], [1000, 'desktop']]) {
    await b.open(PAGE, w, 900, 1, w < 700);
    const q = (s) => b.ev(s);
    // 初期: 投稿が空でも3案が出る
    ok(label + ' initial 3 cards', await q(`document.querySelectorAll('#results .card').length`) === 3);
    ok(label + ' initial no punct', await q(`[...document.querySelectorAll('#results textarea')].every(t=>!/[。、，．]/.test(t.value))`));
    ok(label + ' picked msg', (await q(`document.getElementById('picked').textContent`)).includes('投稿を貼ると'));
    // サンプル
    await q(`document.getElementById('sample').click()`);
    ok(label + ' sample cands', await q(`[...document.querySelectorAll('#cands button')].map(b=>b.firstChild.textContent).join('|')`) === '「完走」|「ランニング初心者」|「苦手」|言葉を入れない|数量「3km」の一言を入れない');
    ok(label + ' sample in plan1', (await q(`document.getElementById('plan1').value`)).includes('「完走」'));
    // 候補を切り替え・言葉を入れない
    await q(`document.querySelectorAll('#cands button')[1].click()`);
    ok(label + ' switch cand', (await q(`document.getElementById('plan2').value`)).includes('「ランニング初心者」'));
    await q(`document.querySelectorAll('#cands button')[3].click()`);
    ok(label + ' none cand', !(await q(`document.getElementById('plan1').value+document.getElementById('plan2').value`)).includes('「'));
    // 手入力が優先
    await q(`(()=>{const m=document.getElementById('manual');m.value='ゴール';m.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    ok(label + ' manual wins', (await q(`document.getElementById('plan1').value`)).includes('「ゴール」'));
    ok(label + ' manual deselects cands', await q(`[...document.querySelectorAll('#cands button')].filter(b=>b.getAttribute('aria-pressed')==='true').length`) === 0);
    await q(`(()=>{const m=document.getElementById('manual');m.value='   ';m.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    ok(label + ' manual blank ignored', !(await q(`document.getElementById('plan1').value`)).includes('「'));
    // 数量の一言を外す
    await q(`document.querySelectorAll('#feelings button')[3].click()`);
    ok(label + ' num on', (await q(`document.getElementById('plan1').value`)).includes('3km'));
    await q(`document.querySelectorAll('#cands button')[4].click()`);
    ok(label + ' num off', !(await q(`document.getElementById('plan1').value`)).includes('3km'));
    await q(`document.querySelectorAll('#cands button')[4].click()`);
    // 気持ち・距離感
    await q(`document.querySelectorAll('#feelings button')[3].click()`);
    await q(`document.querySelectorAll('#dists button')[2].click()`);
    ok(label + ' feel/dist pressed', await q(`document.querySelectorAll('#feelings button')[3].getAttribute('aria-pressed')==='true' && document.querySelectorAll('#dists button')[2].getAttribute('aria-pressed')==='true' && document.querySelectorAll('#feelings button[aria-pressed=true]').length===1`));
    ok(label + ' label changed', (await q(`document.querySelector('#results .card h3').textContent`)).includes('感想をひとこと'));
    ok(label + ' num line', (await q(`document.getElementById('plan1').value`)).includes('3kmってすごいね'));
    // メモ(句読点は除去)
    await q(`(()=>{const m=document.getElementById('memo');m.value='朝は走る、夜は休む。';m.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    const p3 = await q(`document.getElementById('plan3').value`);
    ok(label + ' memo in plan3 no punct', p3.includes('朝は走る 夜は休む') && !/[。、]/.test(p3), p3);
    ok(label + ' no memo hint after memo', !(await q(`document.querySelector('#results').textContent`)).includes('一言メモを書くと'));
    // XSS: 投稿とメモにタグを入れてもHTMLにならない
    await q(`(()=>{const p=document.getElementById('post');p.value='<img src=x onerror="window.__x=1"> <script>window.__x=2<\\/script> 「<b>太字</b>」';p.dispatchEvent(new Event('input',{bubbles:true}));const m=document.getElementById('memo');m.value='<img src=x onerror="window.__x=3">';m.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await b.sleep(200);
    ok(label + ' xss no exec', await q(`window.__x===undefined`));
    ok(label + ' xss no img in main', await q(`document.querySelectorAll('main img').length`) === 0);
    // 編集でカウント更新・警告(280超)
    await q(`(()=>{const t=document.getElementById('plan1');t.value='あ'.repeat(141);t.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    const card = await q(`(()=>{const c=document.querySelector('#results .card');return {stats:c.querySelector('.stats').textContent,warn:c.querySelector('.warn').hidden,w:c.querySelector('.warn').textContent}})()`);
    ok(label + ' warn shown', card.warn === false && card.stats.includes('141文字') && card.stats.includes('282ユニット') && card.w.includes('2超えて'), card);
    await q(`(()=>{const t=document.getElementById('plan1');t.value='あ'.repeat(140);t.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    ok(label + ' warn hidden at 280', await q(`document.querySelector('#results .warn').hidden`));
    // 横スクロール・はみ出し
    await q(`(()=>{const p=document.getElementById('post');p.value='あ'.repeat(2000);p.dispatchEvent(new Event('input',{bubbles:true}));const m=document.getElementById('manual');m.value='ア'.repeat(24);m.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    const ov = await q(`({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth})`);
    ok(label + ' no horizontal scroll', ov.sw <= ov.cw, ov);
    // コピー(権限が無い環境ではフォールバックの案内が出る)
    await q(`document.querySelector('#results .card button').click()`); await b.sleep(400);
    const stt = await q(`document.getElementById('status').textContent`);
    ok(label + ' copy status', /案1を(コピーしました|選択しました)/.test(stt), stt);
    // 全部消す
    await q(`document.getElementById('clear').click()`);
    ok(label + ' clear', await q(`document.getElementById('post').value===''&&document.getElementById('memo').value===''&&document.querySelectorAll('#results .card').length===3`));
    // 保存系
    ok(label + ' no storage', await q(`(()=>{try{return localStorage.length===0&&sessionStorage.length===0}catch(e){return true}})()`));
  }
  console.log(`ui pass ${pass} / fail ${fail}`);
  b.close(); setTimeout(() => process.exit(fail ? 1 : 0), 300);
})().catch(e => { console.error(e); process.exit(2); });
