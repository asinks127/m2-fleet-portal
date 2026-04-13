import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = __dirname;
const port = Number(process.env.PORT || 5173);

// Rate limiting store
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 100; // 100 requests per minute per IP

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitStore.get(ip) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW };
  
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + RATE_LIMIT_WINDOW;
  }
  
  entry.count++;
  rateLimitStore.set(ip, entry);
  
  return entry.count <= RATE_LIMIT_MAX;
}

// Security headers middleware
function addSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  // CSP for production
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Content-Security-Policy', 
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: https:; " +
      "font-src 'self' data:; " +
      "connect-src 'self' https://rrvvklsknrjzzfdhrrfo.supabase.co https://api.supabase.com;"
    );
  }
}

// Load environment variables from .env.local
const envPath = path.join(root, '.env.local');
try {
  const envContent = await fs.readFile(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.substring(0, eqIndex).trim();
    const value = trimmed.substring(eqIndex + 1).trim();
    if (key && value && !process.env[key]) {
      process.env[key] = value;
    }
  }
  console.log('Loaded environment from .env.local');
} catch (e) {
  console.warn('Could not load .env.local:', e.message);
}

const distPath = path.join(root, 'dist');

function json(res, status, payload) {
  if (!res.headersSent) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
  }
  res.end(JSON.stringify(payload));
}

async function serveStaticFile(filePath, res) {
  try {
    const content = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.jsx': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  } catch (e) {
    res.writeHead(404);
    res.end('Not found');
  }
}

async function runApiHandler(name, req, res, body) {
  try {
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
      return json(res, 404, { error: `API handler not found: ${name}` });
    }

    let mod;
    try {
      mod = await import(pathToFileURL(modPath).href + `?t=${Date.now()}`);
    } catch (error) {
      console.error(`Failed to import API handler ${name}:`, error);
      return json(res, 501, {
        error: `API handler unavailable: ${name}`,
        details: error?.message || 'Import failure'
      });
    }

    const handler = mod.default;
    if (typeof handler !== 'function') {
      return json(res, 500, { error: `Invalid API handler: ${name}` });
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
      return json(res, 500, { error: error?.message || 'Internal server error' });
    }
  } catch (error) {
    console.error(`Unexpected API failure for ${name}:`, error);
    return json(res, 500, { error: error?.message || 'Unexpected API error' });
  }
}

const server = http.createServer(async (req, res) => {
  // Apply security headers to all responses
  addSecurityHeaders(res);
  
  // Rate limiting
  const clientIP = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIP)) {
    return json(res, 429, { error: 'Too many requests. Please try again later.' });
  }
  
  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  // Handle API routes
  if (url.pathname.startsWith('/api/')) {
    const name = url.pathname.replace(/^\/api\//, '');
    let raw = '';

    req.on('data', chunk => { raw += chunk; });
    req.on('error', (error) => {
      console.error('Request stream error:', error);
      json(res, 400, { error: 'Invalid request stream' });
    });

    req.on('end', async () => {
      let body = {};
      if (raw) {
        try { body = JSON.parse(raw); } catch { body = raw; }
      }
      await runApiHandler(name, req, res, body);
    });
    return;
  }

  // Serve static files from dist
  let filePath = path.join(distPath, url.pathname === '/' ? 'index.html' : url.pathname);
  
  // If file doesn't exist and it's not a file with extension, serve index.html (SPA routing)
  try {
    await fs.access(filePath);
  } catch {
    // Check if it's a directory
    try {
      const stat = await fs.stat(filePath);
      if (stat.isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }
    } catch {
      // If not a file or directory, serve index.html for SPA routing
      if (!path.extname(url.pathname)) {
        filePath = path.join(distPath, 'index.html');
      }
    }
  }

  await serveStaticFile(filePath, res);
});

server.on('error', (error) => {
  console.error('HTTP server error:', error);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`M23 production server running on ${port}`);
});
