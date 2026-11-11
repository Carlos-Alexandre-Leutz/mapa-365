// Simula o Gemini (:55999) e a Graph API da Meta e registra o que a API envia. Usado por run.sh.
const http = require('http');
const log = [];
http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    if (req.url === '/_log') { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify(log)); }
    const json = body ? JSON.parse(body) : {};
    if (req.url.includes(':generateContent')) {
      const last = json.contents.at(-1).parts[0].text;
      log.push({ to: 'gemini', turns: json.contents.length, last, systemPromptStart: json.systemInstruction.parts[0].text.slice(0, 40) });
      const answer = /humano|Alexandre/i.test(last) ? 'Vou chamar o Alexandre. [[HUMANO]]' : `Resposta simulada para: ${last}`;
      res.setHeader('content-type', 'application/json');
      return res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: answer }] } }] }));
    }
    if (req.url.endsWith('/messages')) {
      log.push({ to: 'meta', auth: req.headers.authorization, number: json.to, text: json.text.body });
      res.setHeader('content-type', 'application/json');
      return res.end(JSON.stringify({ messages: [{ id: 'wamid.fake' }] }));
    }
    res.statusCode = 404; res.end();
  });
}).listen(55999, '127.0.0.1');
