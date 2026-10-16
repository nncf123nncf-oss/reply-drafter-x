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
    const allText = () => q(`[...document.querySelectorAll('#results textarea')].map(t=>t.value).join('\\n')`);
    ok(label + ' num on', (await allText()).includes('3km'));
    await q(`document.querySelectorAll('#cands button')[4].click()`);
    ok(label + ' num off', !(await allText()).includes('3km'));
    await q(`document.querySelectorAll('#cands button')[4].click()`);
    // 気持ち・距離感
    await q(`document.querySelectorAll('#feelings button')[3].click()`);
    await q(`document.querySelectorAll('#dists button')[2].click()`);
    ok(label + ' feel/dist pressed', await q(`document.querySelectorAll('#feelings button')[3].getAttribute('aria-pressed')==='true' && document.querySelectorAll('#dists button')[2].getAttribute('aria-pressed')==='true' && document.querySelectorAll('#feelings button[aria-pressed=true]').length===1`));
    ok(label + ' label changed', (await q(`document.querySelector('#results .card h3').textContent`)).includes('感想をひとこと'));
    ok(label + ' num line', /3km(って数字 すごいね|って数字から 頑張りが伝わるよ|って聞くと 重みあるね|は すごいね)/.test(await allText()), await allText());
    // メモ(句読点は除去)
    await q(`(()=>{const m=document.getElementById('memo');m.value='朝は走る、夜は休む。';m.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    const p3 = await q(`document.getElementById('plan3').value`);
    ok(label + ' memo in plan3 no punct', p3.includes('朝は走る 夜は休む') && !/[。、]/.test(p3), p3);
    ok(label + ' no memo hint after memo', !(await q(`document.querySelector('#results').textContent`)).includes('一言メモを書くと'));
    // 気持ち・出来事・質問の拾いと「別の言い方で」
    await q(`document.getElementById('clear').click()`); await q(`document.getElementById('sample').click()`);
    const sigs = () => q(`[...document.querySelectorAll('#sigs button')].map(b=>b.firstChild.textContent+(b.getAttribute('aria-pressed')==='true'?'*':''))`);
    ok(label + ' sigs sample', JSON.stringify(await sigs()) === JSON.stringify(['「泣きそうになる」*', '気持ちの言葉を入れない', '「走りきった」*', '出来事を入れない', '教え・コツの投稿として返す']), await sigs());
    ok(label + ' sig-picked', (await q(`document.getElementById('sig-picked').textContent`)).includes('気持ちの言葉 1件') && (await q(`document.getElementById('sig-picked').textContent`)).includes('質問の形: なし'));
    ok(label + ' emo in plan1', (await q(`document.getElementById('plan1').value`)).includes('泣きそうになる'));
    await q(`document.querySelectorAll('#sigs button')[1].click()`);
    ok(label + ' emo off', !(await allText()).includes('泣きそうになる') && (await q(`document.querySelectorAll('#sigs button')[1].getAttribute('aria-pressed')`)) === 'true');
    await q(`document.querySelectorAll('#sigs button')[0].click()`);
    ok(label + ' emo back', (await allText()).includes('泣きそうになる'));
    await q(`document.querySelectorAll('#sigs button')[3].click()`);
    ok(label + ' verb off', !(await allText()).includes('走りきった'));
    await q(`document.querySelectorAll('#sigs button')[2].click()`);
    ok(label + ' verb back', (await allText()).includes('走りきった'));
    // 質問の投稿
    await q(`(()=>{const p=document.getElementById('post');p.value='このやり方で合っていますか？ 「検算」が不安です';p.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    ok(label + ' question detected', (await q(`document.getElementById('sig-picked').textContent`)).includes('質問の形: あり') && (await q(`document.querySelector('#results .card:nth-child(2) h3').textContent`)).includes('質問に反応する'), await sigs());
    await q(`[...document.querySelectorAll('#sigs button')].find(b=>b.firstChild.textContent==='質問への返事の形にしない').click()`);
    ok(label + ' question off', (await q(`document.querySelector('#results .card:nth-child(2) h3').textContent`)).includes('質問を返す'));
    // お礼: 教え・コツの投稿と報告で言い回しが変わる / 短い投稿 / 気持ちは最後に出てきたものが既定
    await q(`document.getElementById('clear').click()`);
    await q(`document.querySelectorAll('#feelings button')[1].click()`);
    await q(`(()=>{const p=document.getElementById('post');p.value='朝活を続けるコツは 前の晩に服を決めておくこと';p.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    ok(label + ' teach auto', /助かり|参考|勉強|学び|役立|役に立/.test(await allText()) && (await q(`document.getElementById('sig-picked').textContent`)).includes('教え・コツ型'), await allText());
    await q(`[...document.querySelectorAll('#sigs button')].find(b=>b.firstChild.textContent==='教え・コツの投稿として返す').click()`);
    ok(label + ' teach off -> no teach-only thanks', !/助かり|助かった|助かる|参考に|勉強に|学びに|役立|役に立|収穫|真似/.test(await allText()), await allText());
    await q(`document.getElementById('clear').click()`);
    await q(`(()=>{const p=document.getElementById('post');p.value='疲れたけど楽しかった';p.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    ok(label + ' short post: last emotion default', JSON.stringify(await sigs()).includes('「楽しい」*') && JSON.stringify(await sigs()).includes('「疲れる」'), await sigs());
    ok(label + ' short post: plan1/plan3 one line', (await q(`document.getElementById('plan1').value`)).split('\n').length === 1 && (await q(`document.getElementById('plan3').value`)).split('\n').length === 1);
    await q(`document.getElementById('clear').click()`); await q(`document.getElementById('sample').click()`);
    // 別の言い方(3案まとめて): 毎回変わり、12回で元に戻る(乱数なし)
    const snap3 = () => q(`[...document.querySelectorAll('#results textarea')].map(t=>t.value).join('|')`);
    const s0 = await snap3(); const seen = [s0];
    for (let i = 0; i < 12; i++) { await q(`document.getElementById('again').click()`); seen.push(await snap3()); }
    ok(label + ' again changes every press', seen.slice(1).every((x, i) => x !== seen[i]), seen.length);
    ok(label + ' again returns after 12', seen[12] === s0, 'cycle');
    ok(label + ' again note', (await q(`document.getElementById('again-n').textContent`)).includes('言い回し 1/12'), await q(`document.getElementById('again-n').textContent`));
    await q(`document.getElementById('again').click()`);
    ok(label + ' again status', (await q(`document.getElementById('status').textContent`)).includes('別の言い方'), await q(`document.getElementById('status').textContent`));
    // 案ごと: 押した案だけ変わり、手で直したほかの案は残る
    await q(`(()=>{const t=document.getElementById('plan3');t.value='手で直した案3';t.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    const b1 = await q(`[...document.querySelectorAll('#results textarea')].map(t=>t.value)`);
    await q(`document.querySelectorAll('#results .again-one')[1].click()`);
    const b2 = await q(`[...document.querySelectorAll('#results textarea')].map(t=>t.value)`);
    ok(label + ' per-card changes only that card', b2[0] === b1[0] && b2[1] !== b1[1] && b2[2] === '手で直した案3' && new Set(b2).size === 3, { b1, b2 });
    ok(label + ' per-card keeps focus', await q(`document.activeElement && document.activeElement.classList.contains('again-one') && document.activeElement.closest('.card') === document.querySelectorAll('#results .card')[1]`));
    ok(label + ' per-card status', (await q(`document.getElementById('status').textContent`)).includes('案2だけ別の言い方'));
    ok(label + ' per-card stats updated', (await q(`document.querySelectorAll('#results .card')[1].querySelector('.stats').textContent`)).includes('文字'));
    for (let i = 0; i < 14; i++) { await q(`document.querySelectorAll('#results .again-one')[0].click()`); }
    const b3 = await q(`[...document.querySelectorAll('#results textarea')].map(t=>t.value)`);
    ok(label + ' per-card many presses distinct', new Set(b3).size === 3 && b3.every(x => x.length > 0), b3);
    let dupOpen = 0;
    for (let i = 0; i < 30; i++) { await q(`document.querySelectorAll('#results .again-one')[${i % 3}].click()`); const ts = await q(`[...document.querySelectorAll('#results textarea')].map(t=>Array.from(t.value.split('\\n')[0]).slice(0,4).join(''))`); if (new Set(ts).size < 3) dupOpen++; }
    ok(label + ' per-card openers stay distinct (<=2 of 30 presses)', dupOpen <= 2, dupOpen);
    await q(`document.getElementById('sigs').querySelector('button').focus(); document.getElementById('sigs').querySelector('button').click()`);
    ok(label + ' sigs focus kept', await q(`document.activeElement && document.activeElement.closest('#sigs') !== null`));
    ok(label + ' no punct after again', b3.every(x => !/[。、，．]/.test(x)));
    ok(label + ' again button size', await q(`[...document.querySelectorAll('#again, .again-one')].every(b=>b.getBoundingClientRect().height>=44)`));
    const ov2 = await q(`({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth})`);
    ok(label + ' again no horizontal scroll', ov2.sw <= ov2.cw, ov2);
    await q(`document.getElementById('clear').click()`);
    ok(label + ' clear resets seed', (await q(`document.getElementById('again-n').textContent`)).includes('言い回し 1/12'));
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
