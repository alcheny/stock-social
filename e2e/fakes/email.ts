// In-repo email sink for e2e: accepts the app's one HTTPS-style POST and serves the last message on GET /last.
import { createServer, type Server } from 'node:http';

export function startEmailFake(port: number): Promise<{ server: Server; base: string }> {
  let last: unknown = null;
  const server = createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/send') {
      let body = ''; for await (const c of req) body += c;
      last = JSON.parse(body);
      res.writeHead(202); return res.end();
    }
    if (req.url === '/last') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(last)); }
    res.writeHead(404); res.end();
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, base: `http://127.0.0.1:${port}` })));
}
