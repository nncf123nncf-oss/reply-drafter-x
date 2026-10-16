// Ollama強化モードの画面確認(偽のOllamaサーバー + Chrome headless)。実行: node source/ui-check-ollama.js [--skip-timeout]
// 本物のモデルは使わない。ページは偽サーバーのポートに向けた写しを http://localhost:18123 で配る
const path = require('path');
const { launch } = require('./cdp');
const { start, GOOD } = require('./fake-ollama');
const SKIP_TIMEOUT = process.argv.includes('--skip-timeout');
const API = 18435, PAGEPORT = 18123;
let pass = 0, fail = 0;
const ok = (name, c, info) => { if (c) pass++; else { fail++; console.log('NG', name, info === undefined ? '' : JSON.stringify(info)); } };
const OUT = process.env.SHOT_DIR || '';
(async () => {
  const srv = await start(API, PAGEPORT), ctl = srv.ctl;
  const b = await launch(9392);
  const net = [], errs = [];
  await b.send('Network.enable');
  b.on(m => {
    if (m.method === 'Network.requestWillBeSent') net.push(m.params.request.url);
    if (m.method === 'Runtime.exceptionThrown') errs.push(JSON.stringify(m.params.exceptionDetails).slice(0, 200));
  });
  const q = (s) => b.ev(s);
  const waitFor = async (expr, ms = 4000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await q(expr)) return true; await b.sleep(50); } return false; };
  const setInput = (id, v) => q(`(()=>{const e=document.getElementById(${JSON.stringify(id)});e.value=${JSON.stringify(v)};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  const cards = () => q(`[...document.querySelectorAll('#results .card')].map(c=>({badge:!!c.querySelector('.badge'),badgeText:(c.querySelector('.badge')||{}).textContent||'',note:(c.querySelector('.ai-note')||{}).textContent||'',text:c.querySelector('textarea').value,h3:c.querySelector('h3').textContent,stats:c.querySelector('.stats').textContent}))`);
  let shot = 0;
  async function snap(label, w) {
    if (!OUT) return;
    const h = await q(`document.documentElement.scrollHeight`);
    await b.shot(path.join(OUT, `${label}-${w}.png`), { x: 0, y: 0, width: w, height: Math.min(h, 3200) });
  }

  for (const [w, label] of [[375, 'mobile'], [1000, 'desktop']]) {
    const fresh = async (tags, chat) => {
      ctl.tags = tags || 'ok'; ctl.chat = chat || ['ok']; ctl.calls.length = 0; ctl.closed = 0; ctl.tagsDelay = 0; ctl.chatDelay = 0;
      await b.open(srv.pageUrl, w, 900, 1, w < 700);
      await waitFor(`!document.getElementById('ai-box').hidden || !document.getElementById('ai-guide').hidden`, 4000);
    };
    const goBtn = () => q(`(()=>{const g=document.getElementById('ai-go');return {hidden:g.hidden,disabled:g.disabled,h:g.getBoundingClientRect().height}})()`);
    const state = () => q(`document.getElementById('ai-state').textContent`);
    const status = () => q(`document.getElementById('status').textContent`);
    const noScroll = async (tag) => { const ov = await q(`({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth})`); ok(`${label} ${tag} no horizontal scroll`, ov.sw <= ov.cw, ov); };

    // ---- A. 検出 -> ボタン表示 ----
    await fresh('ok');
    ok(label + ' A box shown', await q(`!document.getElementById('ai-box').hidden`));
    ok(label + ' A guide hidden', await q(`document.getElementById('ai-guide').hidden`));
    ok(label + ' A models (embed filtered)', await q(`[...document.querySelectorAll('#ai-model option')].map(o=>o.value).join('|')`) === 'llama3.2:3b|qwen2.5:7b|gemma3:4b');
    ok(label + ' A cloud/remote models hidden', !(await q('document.getElementById("ai-model").textContent')).match(/cloud|remote/));
    ok(label + ' A default qwen2.5:7b', await q(`document.getElementById('ai-model').value`) === 'qwen2.5:7b');
    ok(label + ' A disabled when post empty', (await goBtn()).disabled === true && (await state()) === '相手の投稿を貼ると使えます', await state());
    ok(label + ' A initial 3 rule cards no badge', (await cards()).length === 3 && (await cards()).every(c => !c.badge));
    ok(label + ' A privacy note', (await q(`document.getElementById('ai-box').textContent`)).includes('このPCの中のOllamaにだけ送られます。インターネットには送られません'));
    await q(`document.getElementById('sample').click()`);
    const g1 = await goBtn();
    ok(label + ' A enabled after post', g1.disabled === false && g1.h >= 44, g1);
    const before = await cards();
    await noScroll('A');
    await snap('A-ready', w);

    // ---- B. 生成 -> 表示 ----
    ctl.chatDelay = 1400;
    await q(`document.getElementById('ai-go').click()`);
    await waitFor(`document.getElementById('ai-state').textContent.includes('作成中')`, 1500);
    const mid = await state();
    ok(label + ' B progress shown (secs)', /作成中（qwen2\.5:7b）\d+秒/.test(mid), mid);
    const stopV = await q(`(()=>{const s=document.getElementById('ai-stop');return {hidden:s.hidden,h:s.getBoundingClientRect().height,goHidden:document.getElementById('ai-go').hidden}})()`);
    ok(label + ' B stop button shown', stopV.hidden === false && stopV.h >= 44 && stopV.goHidden === true, stopV);
    await b.sleep(1200); // 1秒ごとの表示更新を1回以上またぐ
    ok(label + ' B elapsed updates', /作成中（qwen2\.5:7b）[1-9]\d*秒/.test(await state()), await state());
    await noScroll('B-progress');
    await snap('B-progress', w);
    await waitFor(`document.querySelectorAll('#results .badge').length>0`, 5000);
    const c1 = await cards();
    ok(label + ' B 3 AI cards', c1.length === 3 && c1.every(c => c.badge && c.badgeText === 'AIの案'), c1.map(c => c.badgeText));
    ok(label + ' B AI texts', c1.map(c => c.text).join('||') === GOOD.join('||'), c1.map(c => c.text));
    ok(label + ' B notice text', c1.every(c => c.note === 'このPCのOllamaが作った案です。事実と違う点がないか、送る前に読んでください'));
    ok(label + ' B types kept', c1[0].h3.includes('共感を重ねる') && c1[1].h3.includes('質問を返す') && c1[2].h3.includes('自分の体験を一行足す'), c1.map(c => c.h3));
    ok(label + ' B stats present', c1.every(c => /文字数 \d+文字 ／ ユニット数 \d+ユニット/.test(c.stats)), c1.map(c => c.stats));
    ok(label + ' B request shape', ctl.calls.length === 1 && ctl.calls[0].model === 'qwen2.5:7b' && ctl.calls[0].stream === false && ctl.calls[0].messages[0].role === 'system' && ctl.calls[0].messages[1].content.includes('今日 初めて3kmを走りきった') && ctl.calls[0].messages[0].content.includes('共感したい'), ctl.calls[0] && Object.keys(ctl.calls[0]));
    const fin = await state();
    ok(label + ' B summary', /^AIの案 3件 ／ ルールベースの案 0件（\d+秒）$/.test(fin) && (await status()) === fin, fin);
    ok(label + ' B buttons restored', (await q(`document.getElementById('ai-stop').hidden`)) && !(await goBtn()).hidden && !(await goBtn()).disabled);
    // 編集とカウントは既存の仕組み
    await q(`(()=>{const t=document.getElementById('plan1');t.value='あ'.repeat(141);t.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    ok(label + ' B edit counts', (await q(`document.querySelector('#results .stats').textContent`)).includes('141文字') && (await q(`document.querySelector('#results .warn').hidden`)) === false);
    await q(`document.querySelector('#results .card button').click()`); await b.sleep(300);
    ok(label + ' B copy works', /案1を(コピーしました|選択しました)/.test(await status()), await status());
    await noScroll('B-result');
    // card h3 がカード内に収まる
    ok(label + ' B h3 inside card', await q(`[...document.querySelectorAll('#results .card')].every(c=>{const a=c.getBoundingClientRect(),h=c.querySelector('h3').getBoundingClientRect();return h.right<=a.right+0.5&&h.left>=a.left-0.5})`));
    await snap('B-result', w);
    // 条件を変えると案は作り直され(ルールベースへ戻り)、バッジは消える
    await q(`document.querySelectorAll('#feelings button')[1].click()`);
    ok(label + ' B condition change resets to rule cards', (await cards()).every(c => !c.badge) && (await cards()).length === 3);
    // 再度作れる
    await q(`document.getElementById('ai-go').click()`); await waitFor(`document.querySelectorAll('#results .badge').length>0`, 5000);
    ok(label + ' B second run ok (お礼 sent to prompt)', ctl.calls.length === 2 && ctl.calls[1].messages[0].content.includes('お礼を伝えたい') && ctl.calls[1].messages[0].content.includes('3案すべてに必ず込める'));

    // ---- C. 後処理: 句読点つき・不合格・再生成 ----
    await fresh('ok', ['punct']); await q(`document.getElementById('sample').click()`); ctl.chatDelay = 0;
    await q(`document.getElementById('ai-go').click()`); await waitFor(`document.querySelectorAll('#results .badge').length>0`, 5000);
    const cp = await cards();
    ok(label + ' C punct/emoji stripped', cp.length === 3 && cp.every(c => c.badge && !/[。、！？!?🎉]/u.test(c.text)), cp.map(c => c.text));
    ok(label + ' C stripped text still 合格', cp[0].text.startsWith('「完走」できたというお話\nその気持ち よく分かります'), cp[0].text);

    await fresh('ok', ['bad1']); await q(`document.getElementById('sample').click()`);
    await q(`document.getElementById('ai-go').click()`); await waitFor(`/AIの案 \\d件/.test(document.getElementById('ai-state').textContent)`, 5000);
    const cb1 = await cards(), rule = await q(`RD.build({feeling:0,dist:0,word:'完走',num:'3km',memo:'',emo:'泣きそうになる',emoTone:'mix',verb:'走りきった',verbTone:'pos',question:false,teach:false,short:false,seed:0}).map(p=>p.text)`);
    ok(label + ' C bad1: no retry', ctl.calls.length === 1, ctl.calls.length);
    ok(label + ' C bad1: 2 AI + 1 rule (card 2 replaced, no badge)', cb1.map(c => c.badge).join() === 'true,false,true' && cb1[1].text === rule[1], { b: cb1.map(c => c.badge), t: cb1[1].text, r: rule[1] });
    const sb1 = await state();
    ok(label + ' C bad1: summary with reason', /^AIの案 2件 ／ ルールベースの案 1件（\d+秒）。差し替えた理由: 案2＝元にない数字\(10\)$/.test(sb1), sb1);
    ok(label + ' C bad1: replaced card has no AI note', cb1[1].note === '');
    await q(`document.getElementById('again').click()`);
    const ca = await cards();
    ok(label + ' C again after AI: back to rule cards with another phrasing', ca.length === 3 && ca.every(c => !c.badge) && ca.some((c, i) => c.text !== rule[i]) && new Set(ca.map(c => c.text)).size === 3, ca.map(c => c.text));

    await fresh('ok', ['bad2', 'ok']); await q(`document.getElementById('sample').click()`);
    await q(`document.getElementById('ai-go').click()`); await waitFor(`/AIの案 \\d件/.test(document.getElementById('ai-state').textContent)`, 6000);
    const cb2 = await cards();
    ok(label + ' C bad2: retried once', ctl.calls.length === 2, ctl.calls.length);
    ok(label + ' C bad2: all 3 AI after retry (plan3 from 1st, 1-2 from 2nd)', cb2.every(c => c.badge) && cb2.map(c => c.text).join('||') === GOOD.join('||'), cb2.map(c => c.text));

    await fresh('ok', ['bad2', 'bad2']); await q(`document.getElementById('sample').click()`);
    await q(`document.getElementById('ai-go').click()`); await waitFor(`/AIの案 \\d件/.test(document.getElementById('ai-state').textContent)`, 6000);
    const cb3 = await cards(), s3 = await state();
    ok(label + ' C bad2x2: exactly 2 calls (retry only once)', ctl.calls.length === 2, ctl.calls.length);
    ok(label + ' C bad2x2: only plan3 stays AI, rest rule-based', cb3.map(c => c.badge).join() === 'false,false,true' && cb3[0].text === rule[0] && cb3[1].text === rule[1], cb3.map(c => c.badge));
    ok(label + ' C bad2x2: summary', /^AIの案 1件 ／ ルールベースの案 2件（\d+秒）。差し替えた理由: 案1＝NG語「こんにちは」 ／ 案2＝元にない数字\(10\)$/.test(s3), s3);

    await fresh('ok', ['invalid']); await q(`document.getElementById('sample').click()`);
    await q(`document.getElementById('ai-go').click()`); await waitFor(`/AIの案 \\d件/.test(document.getElementById('ai-state').textContent)`, 6000);
    const ci = await cards();
    ok(label + ' C invalid json: 2 calls, all rule-based', ctl.calls.length === 2 && ci.every(c => !c.badge) && ci.map(c => c.text).join('||') === rule.join('||'), { n: ctl.calls.length });
    ok(label + ' C invalid json: summary', /^AIの案 0件 ／ ルールベースの案 3件/.test(await state()), await state());

    await fresh('ok', ['fence']); await q(`document.getElementById('sample').click()`);
    await q(`document.getElementById('ai-go').click()`); await waitFor(`document.querySelectorAll('#results .badge').length>0`, 5000);
    ok(label + ' C code-fenced JSON accepted', (await cards()).every(c => c.badge));

    // ---- D. エラー表示 ----
    for (const [mode, re] of [['status500', /Ollamaがエラーを返しました（500）/], ['status404', /このモデルが見つかりません/]]) {
      await fresh('ok', [mode]); await q(`document.getElementById('sample').click()`);
      await q(`document.getElementById('ai-go').click()`); await waitFor(`document.getElementById('ai-go').hidden===false && !document.getElementById('ai-state').textContent.includes('作成中')`, 5000);
      ok(label + ' D ' + mode, re.test(await state()) && re.test(await status()) && (await cards()).every(c => !c.badge), await state());
      ok(label + ' D ' + mode + ' button usable again', !(await goBtn()).disabled);
    }

    // ---- E. 中止 ----
    await fresh('ok', ['hang']); await q(`document.getElementById('sample').click()`);
    await q(`document.getElementById('ai-go').click()`); await b.sleep(1300);
    ok(label + ' E running', /作成中/.test(await state()));
    await q(`document.getElementById('ai-stop').click()`); await b.sleep(300);
    ok(label + ' E stopped message', (await state()) === '中止しました。ルールベースの案のままです' && (await status()) === '中止しました。ルールベースの案のままです', await state());
    ok(label + ' E rule cards kept', (await cards()).length === 3 && (await cards()).every(c => !c.badge));
    ok(label + ' E server saw closed connection', ctl.closed === 1, ctl.closed);
    ok(label + ' E buttons restored', (await q(`document.getElementById('ai-stop').hidden`)) && !(await goBtn()).hidden && !(await goBtn()).disabled);
    await b.sleep(1500);
    ok(label + ' E elapsed timer stopped', (await state()) === '中止しました。ルールベースの案のままです');
    // 中止後に再実行できる
    ctl.chat = ['ok']; await q(`document.getElementById('ai-go').click()`); await waitFor(`document.querySelectorAll('#results .badge').length>0`, 5000);
    ok(label + ' E rerun after stop', (await cards()).every(c => c.badge));

    // 条件変更で中止
    await fresh('ok', ['hang']); await q(`document.getElementById('sample').click()`);
    await q(`document.getElementById('ai-go').click()`); await b.sleep(500);
    await q(`document.querySelectorAll('#dists button')[1].click()`); await b.sleep(300);
    ok(label + ' E cond change aborts', (await state()) === '条件が変わったため、AIの作成を中止しました' && !(await goBtn()).hidden && ctl.closed === 1, await state());
    // 投稿を消すとボタンが無効に
    await q(`document.getElementById('clear').click()`);
    ok(label + ' E clear disables button', (await goBtn()).disabled === true && (await state()) === '相手の投稿を貼ると使えます', await state());

    // ---- F. 403 / 接続失敗 / Ollamaなし ----
    for (const mode of ['forbid', 'forbidcors', 'down', 'garbage', 'empty']) {
      await fresh(mode);
      ok(label + ' F ' + mode + ': guide shown, no button', await q(`!document.getElementById('ai-guide').hidden && document.getElementById('ai-box').hidden`));
      ok(label + ' F ' + mode + ': cards unchanged (3 rule cards)', (await cards()).length === 3 && (await cards()).every(c => !c.badge));
    }
    await fresh('forbid');
    const gtxt = await q(`document.getElementById('ai-guide').textContent`);
    ok(label + ' F guide: summary collapsed by default', await q(`document.getElementById('ai-guide').open===false`));
    ok(label + ' F guide: windows+mac+origin+restart', /Windows/.test(gtxt) && /Mac/.test(gtxt) && gtxt.includes('OLLAMA_ORIGINS') && gtxt.includes('https://nncf123nncf-oss.github.io') && gtxt.includes('起動し直す'));
    ok(label + ' F guide: only this page, no wildcard instruction', gtxt.includes('このページのアドレスだけ') && !/OLLAMA_ORIGINS[^\n]*\*/.test(gtxt) && !gtxt.includes('OLLAMA_ORIGINS=*') && !gtxt.includes('"*"'));
    await q(`document.getElementById('ai-guide').open=true`);
    await noScroll('F-guide-open'); await snap('F-guide', w);
    ok(label + ' F guide: code blocks wrap in viewport', await q(`[...document.querySelectorAll('#ai-guide .code')].every(e=>{const r=e.getBoundingClientRect();return r.right<=document.documentElement.clientWidth+0.5&&r.left>=-0.5})`));
    ok(label + ' F guide: recheck button >=44', (await q(`document.getElementById('ai-recheck').getBoundingClientRect().height`)) >= 44);
    // 許可設定後に「もう一度調べる」
    ctl.tags = 'ok';
    await q(`document.getElementById('ai-recheck').click()`); await waitFor(`!document.getElementById('ai-box').hidden`, 3000);
    ok(label + ' F recheck success -> box shown, guide hidden', await q(`!document.getElementById('ai-box').hidden && document.getElementById('ai-guide').hidden`));
    // 遅い応答(2秒で打ち切り)
    await fresh('ok'); ctl.tags = 'ok'; ctl.tagsDelay = 3500;
    await b.open(srv.pageUrl, w, 900, 1, w < 700); await waitFor(`!document.getElementById('ai-guide').hidden`, 4500);
    ok(label + ' F slow tags (>2s) -> guide', await q(`!document.getElementById('ai-guide').hidden && document.getElementById('ai-box').hidden`));
    ctl.tagsDelay = 0;
    await fresh('nodefault');
    ok(label + ' F nodefault -> first model', await q(`document.getElementById('ai-model').value`) === 'gemma3:4b');
    // 再確認で失敗したときの表示
    await fresh('forbid'); await q(`document.getElementById('ai-recheck').click()`); await waitFor(`document.getElementById('ai-recheck-state').textContent.includes('まだ使えません')`, 3000);
    ok(label + ' F recheck failure msg', (await q(`document.getElementById('ai-recheck-state').textContent`)).includes('まだ使えません'));
    ok(label + ' no page errors so far', errs.length === 0, errs);
  }

  // ---- G. 60秒で打ち切り(デスクトップ幅で1回) ----
  if (!SKIP_TIMEOUT) {
    ctl.tags = 'ok'; ctl.chat = ['hang']; ctl.calls.length = 0; ctl.closed = 0;
    await b.open(srv.pageUrl, 1000, 900, 1, false); await waitFor(`!document.getElementById('ai-box').hidden`, 3000);
    await q(`document.getElementById('sample').click()`);
    const t0 = Date.now();
    await q(`document.getElementById('ai-go').click()`);
    await b.sleep(30000);
    ok('G still running at 30s', /作成中（qwen2\.5:7b）(29|30|31)秒/.test(await q(`document.getElementById('ai-state').textContent`)), await q(`document.getElementById('ai-state').textContent`));
    await waitFor(`!document.getElementById('ai-state').textContent.includes('作成中')`, 40000);
    const dt = (Date.now() - t0) / 1000;
    const ts = await q(`document.getElementById('ai-state').textContent`);
    ok('G timeout at ~60s', dt >= 59.5 && dt <= 63, dt);
    ok('G timeout message', ts === '60秒で終わらなかったため打ち切りました。初回はモデルの読み込みで長くかかることがあります。もう一度押してみてください。ルールベースの案のままです', ts);
    ok('G no retry after timeout, connection closed', ctl.calls.length === 1 && ctl.closed === 1, { calls: ctl.calls.length, closed: ctl.closed });
    ok('G rule cards kept, button back', (await cards()).length === 3 && (await cards()).every(c => !c.badge) && !(await q(`document.getElementById('ai-go').hidden`)));
  }

  // ---- H. 送信先の確認(全リクエスト) ----
  const hosts = [...new Set(net.map(u => { try { const x = new URL(u); return x.host; } catch (e) { return u; } }))].sort();
  const allowedHosts = ['localhost:' + PAGEPORT, 'localhost:' + API, 'static.cloudflareinsights.com', 'cloudflareinsights.com'];
  ok('H all requests only to test page, fake api, existing analytics beacon', hosts.every(h => allowedHosts.includes(h)), hosts);
  ok('H no request to real Ollama port or other hosts', !hosts.includes('localhost:11434'), hosts);
  ok('H api paths only /api/tags and /api/chat', net.filter(u => u.includes(':' + API)).every(u => /\/api\/(tags|chat)$/.test(u)), [...new Set(net.filter(u => u.includes(':' + API)))]);
  ok('H no page exceptions', errs.length === 0, errs);
  console.log('hosts:', hosts.join(', '), '/ tags calls', ctl.tagsCalls);
  console.log(`ollama ui pass ${pass} / fail ${fail}`);
  b.close(); srv.stop(); setTimeout(() => process.exit(fail ? 1 : 0), 300);
})().catch(e => { console.error(e); process.exit(2); });
