// 本物のOllamaで数パターン試し、後処理の通過率と所要時間を記録する。実行: node source/real-model-check.js [モデル名 ...]
// ブラウザを通さず Node から Origin なしで呼ぶ(Ollamaの設定は変更しない)。画面と同じ buildPrompt / parsePlans / evaluate を使う
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const RD = new Function(html.match(/<script id="core">([\s\S]*?)<\/script>/)[1] + '; return RD;')();
const MODELS = process.argv.slice(2).length ? process.argv.slice(2) : ['qwen2.5:7b', 'gemma3:4b'];
const PATTERNS = [
  { post: '今日 初めて3kmを走りきった。走るのが苦手だったので「完走」できただけで泣きそうになった #ランニング初心者', feeling: 0, dist: 0, memo: '' },
  { post: '今日 初めて3kmを走りきった。走るのが苦手だったので「完走」できただけで泣きそうになった #ランニング初心者', feeling: 1, dist: 2, memo: '' },
  { post: '煮物のコツは「火を止めて30分置く」こと。味が染みて、家族に好評だった #作り置き', feeling: 1, dist: 0, memo: '' },
  { post: '煮物のコツは「火を止めて30分置く」こと。味が染みて、家族に好評だった #作り置き', feeling: 2, dist: 1, memo: '' },
  { post: '資料作成が終わらず、夜まで残業になった。明日こそ早く帰りたい', feeling: 4, dist: 1, memo: '私も今週は残業続きでした' },
  { post: '新しいノートアプリのNotionに引っ越した。タグ付けが楽になった', feeling: 5, dist: 2, memo: '' }
];
async function call(model, prompt) {
  const t0 = Date.now();
  const r = await fetch('http://localhost:11434/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(120000),
    body: JSON.stringify({ model, stream: false, messages: [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }], options: { temperature: 0.6, num_predict: 500 } }) });
  const j = await r.json();
  return { ms: Date.now() - t0, text: (j.message && j.message.content) || '' };
}
(async () => {
  for (const model of MODELS) {
    let plansTotal = 0, plansOk = 0, calls = 0, ms = 0, retryNeeded = 0, allPass = 0; const reasons = {}, samples = [];
    for (const [i, p] of PATTERNS.entries()) {
      const word = (RD.pickWords(p.post).cands[0] || {}).w || '';
      const prompt = RD.buildPrompt({ feeling: p.feeling, dist: p.dist, post: p.post, word, num: '', memo: p.memo });
      const ctx = { dist: p.dist, source: [p.post, p.memo, word].join('\n') };
      let res; try { res = await call(model, prompt); } catch (e) { console.log(model, 'pattern', i, 'ERROR', e.message); continue; }
      const parsed = RD.parsePlans(res.text), ev = RD.evaluate(parsed, ctx);
      calls++; ms += res.ms; plansTotal += 3; plansOk += ev.filter(e => e.ok).length;
      if (RD.failCount(ev) >= 2) retryNeeded++; if (RD.failCount(ev) === 0) allPass++;
      ev.forEach(e => e.reasons.forEach(r => { const k = r.replace(/\(.*\)/, ''); reasons[k] = (reasons[k] || 0) + 1; }));
      samples.push({ pattern: i, feeling: RD.FEELINGS[p.feeling].name, dist: RD.DISTS[p.dist].name, sec: Math.round(res.ms / 100) / 10, parsed: !!parsed, plans: ev.map(e => ({ ok: e.ok, text: e.text, reasons: e.reasons })) });
    }
    console.log('=== ' + model + ' ===');
    console.log(JSON.stringify({ calls, avgSec: calls ? Math.round(ms / calls / 100) / 10 : null, plansOk: plansOk + '/' + plansTotal, allThreePass: allPass + '/' + calls, retryWouldRun: retryNeeded + '/' + calls, reasons }));
    samples.forEach(s => console.log(JSON.stringify(s)));
  }
})();
