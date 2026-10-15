// 偽のOllamaサーバー(検算用)。本物のモデルは使わない。node source/fake-ollama.js で単体起動もできる
// - APIサーバー: /api/tags と /api/chat。許可するOriginは1つだけ(OLLAMA_ORIGINS の代わり)。違うOriginは本物と同じく CORS ヘッダーなしの403
// - ページサーバー: index.html の localhost:11434 を偽サーバーのポートに置き換えて配る(本物のOllamaに繋がないため)
const http = require('http'), fs = require('fs'), path = require('path');

// 偽の返事。SAMPLE(共感・初めて話す)で全案が合格する3案
const GOOD = ['「完走」できたというお話 その気持ち よく分かります\n3kmを走りきったのですね', '走りきったとき 一番うれしかったのはどこでしたか', '自分も同じ気持ちになったことがあります\nお話しくださってありがとうございます'];
const CHAT = {
  ok: () => ({ plans: GOOD }),
  // 2案が不合格(NG語・元にない数字) -> 再生成が走る
  bad2: () => ({ plans: ['こんにちは 完走おめでとうございます', '10kmも走ったのですね もう少し聞かせてください', GOOD[2]] }),
  // 1案だけ不合格 -> 再生成なし・その案だけルールベースに差し替え
  bad1: () => ({ plans: [GOOD[0], '10kmも走ったのですね もう少し聞かせてください', GOOD[2]] }),
  // 句読点・感嘆符・絵文字つき -> 取り除かれて合格
  punct: () => ({ plans: ['「完走」できたというお話！その気持ち、よく分かります。', '走りきったとき 一番うれしかったのはどこでしたか？🎉', '自分も同じ気持ちになったことがあります。\nお話しくださってありがとうございます!'] }),
  // 分からない言い回しの文字列 -> JSONとして読めない
  invalid: () => 'すみません うまく作れませんでした',
  fence: () => '```json\n' + JSON.stringify({ plans: GOOD }) + '\n```'
};

function makeApi(pageOrigin) {
  const ctl = { tags: 'ok', chat: ['ok'], tagsDelay: 0, chatDelay: 0, calls: [], tagsCalls: 0, closed: 0, last: null };
  const server = http.createServer((req, res) => {
    const origin = req.headers.origin;
    const allowed = origin === pageOrigin;
    const cors = { 'Access-Control-Allow-Origin': origin || '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Private-Network': 'true', 'Vary': 'Origin' };
    if (origin && !allowed) { res.writeHead(403); res.end(); return; } // 本物のOllamaと同じ: 許可していないOriginは403(CORSヘッダーなし)
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
    res.on('close', () => { if (!res.writableFinished) ctl.closed++; });
    if (req.url === '/api/tags') {
      ctl.tagsCalls++;
      const send = () => {
        if (ctl.tags === 'down') { req.socket.destroy(); return; }
        if (ctl.tags === 'forbid') { res.writeHead(403); res.end(); return; }
        if (ctl.tags === 'forbidcors') { res.writeHead(403, cors); res.end('forbidden'); return; }
        if (ctl.tags === 'empty') { res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, cors)); res.end('{"models":[]}'); return; }
        if (ctl.tags === 'garbage') { res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, cors)); res.end('not json'); return; }
        const models = ctl.tags === 'nodefault' ? ['gemma3:4b', 'qwen2.5:3b'] : ['llama3.2:3b', 'qwen2.5:7b', 'gemma3:4b', 'nomic-embed-text:latest'];
        res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, cors)); const extra = ctl.tags === 'nodefault' ? [{ name: 'a-cloud' }] : [{ name: 'gpt-oss:120b-cloud', remote_host: 'https://ollama.com:443' }, { name: 'x-remote', remote_model: 'x' }];
        res.end(JSON.stringify({ models: [{ name: 'a-cloud' }].concat(models.map(name => ({ name })), extra) }));
      };
      ctl.tagsDelay ? setTimeout(send, ctl.tagsDelay) : send();
      return;
    }
    if (req.url === '/api/chat' && req.method === 'POST') {
      let body = ''; req.on('data', c => body += c); req.on('end', () => {
        let b = {}; try { b = JSON.parse(body); } catch (e) { }
        ctl.calls.push(b);
        const mode = ctl.chat.length > 1 ? ctl.chat.shift() : ctl.chat[0];
        ctl.last = mode;
        const respond = () => {
          if (mode === 'hang') return; // 返事をしない(中止・タイムアウトの確認用)
          if (mode === 'status500') { res.writeHead(500, cors); res.end('boom'); return; }
          if (mode === 'status404') { res.writeHead(404, cors); res.end('{"error":"model not found"}'); return; }
          const r = CHAT[mode] ? CHAT[mode]() : CHAT.ok();
          const content = typeof r === 'string' ? r : JSON.stringify(r);
          res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, cors));
          res.end(JSON.stringify({ model: b.model, message: { role: 'assistant', content }, done: true }));
        };
        ctl.chatDelay && mode !== 'hang' ? setTimeout(respond, ctl.chatDelay) : respond();
      });
      return;
    }
    res.writeHead(404, cors); res.end();
  });
  return { server, ctl };
}
function makePage(apiPort) {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8').replace(/localhost:11434/g, 'localhost:' + apiPort);
  return http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html); });
}
const listen = (s, port) => new Promise(r => s.listen(port, '127.0.0.1', r));
async function start(apiPort, pagePort) {
  const { server, ctl } = makeApi('http://localhost:' + pagePort);
  const page = makePage(apiPort);
  await listen(server, apiPort); await listen(page, pagePort);
  return { ctl, pageUrl: 'http://localhost:' + pagePort + '/', apiServer: server, stop: () => { server.closeAllConnections && server.closeAllConnections(); page.closeAllConnections && page.closeAllConnections(); server.close(); page.close(); } };
}
module.exports = { start, GOOD, CHAT };
if (require.main === module) start(11435, 8123).then(s => console.log('page', s.pageUrl, 'api http://localhost:11435'));
