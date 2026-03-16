import { createServer as createViteServer } from 'vite';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = __dirname;
const port = Number(process.env.PORT || 5173);

function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

async function runApiHandler(name, req, res, body) {
  const candidates = [
    path.join(root, `${name}.js`),
    path.join(root, `${name}.ts`),
  ];

  let modPath = null;
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      modPath = candidate;
      break;
    } catch {}
  }

  if (!modPath) {
    json(res, 404, { error: `API handler not found: ${name}` });
    return;
  }

  const mod = await import(pathToFileURL(modPath).href + `?t=${Date.now()}`);
  const handler = mod.default;
  if (typeof handler !== 'function') {
    json(res, 500, { error: `Invalid API handler: ${name}` });
    return;
  }

  req.body = body;
  req.query = Object.fromEntries(new URL(req.url, `http://${req.headers.host}`).searchParams.entries());

  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    if (!res.headersSent) res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(payload));
    return res;
  };
  res.send = (payload) => {
    if (typeof payload === 'object' && payload !== null) {
      if (!res.headersSent) res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(payload));
    } else {
      res.end(payload ?? '');
    }
    return res;
  };

  try {
    await handler(req, res);
  } catch (error) {
    console.error(`API ${name} failed:`, error);
    json(res, 500, { error: error.message || 'Internal server error' });
  }
}

async function start() {
  const vite = await createViteServer({
    root,
    server: { middlewareMode: true },
    appType: 'spa',
  });

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);

    if (url.pathname.startsWith('/api/')) {
      const name = url.pathname.replace(/^\/api\//, '');
      let raw = '';
      req.on('data', chunk => { raw += chunk; });
      req.on('end', async () => {
        let body = {};
        if (raw) {
          try { body = JSON.parse(raw); } catch { body = raw; }
        }
        await runApiHandler(name, req, res, body);
      });
      return;
    }

    vite.middlewares(req, res, () => {
      if (!res.writableEnded) {
        res.statusCode = 404;
        res.end('Not found');
      }
    });
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`M23 server running on ${port}`);
  });
}

start();
