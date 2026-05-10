import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = __dirname;
const port = Number(process.env.PORT || 57484);

// Load environment variables from .env.local
const envPath = path.join(root, ".env.local");
try {
  const envContent = await fs.readFile(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) continue;
    const key = trimmed.substring(0, eqIndex).trim();
    const value = trimmed.substring(eqIndex + 1).trim();
    if (key && value && !process.env[key]) {
      process.env[key] = value;
    }
  }
  console.log("Loaded environment from .env.local");
} catch (e) {
  console.warn("Could not load .env.local:", e);
}

const app = new Hono();

// Enable CORS for all routes
app.use("*", cors());
app.use("*", logger());

// Rate limiting middleware
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 100; // 100 requests per minute per IP

app.use("*", async (c, next) => {
  const clientIP = c.req.header("x-forwarded-for")?.split(",")[0] || 
                   c.req.header("x-real-ip") || 
                   "unknown";
  const now = Date.now();
  const entry = rateLimitStore.get(clientIP) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW };
  
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + RATE_LIMIT_WINDOW;
  }
  
  entry.count++;
  rateLimitStore.set(clientIP, entry);
  
  if (entry.count > RATE_LIMIT_MAX) {
    return c.json({ error: "Too many requests. Please try again later." }, 429);
  }
  
  await next();
});

// Security headers
app.use("*", async (c, next) => {
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("X-XSS-Protection", "1; mode=block");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  await next();
});

// API routes - dynamically load handlers from /api folder
app.all("/api/*", async (c) => {
  const apiPath = c.req.path.replace(/^\/api\//, "");
  const [handlerName, ...restPath] = apiPath.split("/");
  
  // Try to load the handler
  const candidates = [
    path.join(root, "api", `${handlerName}.ts`),
    path.join(root, "api", `${handlerName}.js`),
  ];

  let modPath: string | null = null;
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      modPath = candidate;
      break;
    } catch {}
  }

  if (!modPath) {
    return c.json({ error: `API handler not found: ${handlerName}` }, 404);
  }

  try {
    const mod = await import(pathToFileURL(modPath).href + `?t=${Date.now()}`);
    const handler = mod.default;
    
    if (typeof handler !== "function") {
      return c.json({ error: `Invalid API handler: ${handlerName}` }, 500);
    }

    // Create Express-like req/res objects for compatibility
    const req: any = {
      method: c.req.method,
      url: c.req.url,
      path: c.req.path,
      headers: Object.fromEntries(c.req.raw.headers),
      body: await c.req.json().catch(() => ({})),
      query: Object.fromEntries(c.req.query()),
      params: {},
    };

    const res: any = {
      statusCode: 200,
      headersSent: false,
      _headers: {} as Record<string, string>,
      status: function(code: number) {
        this.statusCode = code;
        return this;
      },
      json: function(payload: any) {
        this._body = JSON.stringify(payload);
        this._headers["Content-Type"] = "application/json";
        return this;
      },
      send: function(payload: any) {
        if (typeof payload === "object" && payload !== null) {
          this._body = JSON.stringify(payload);
          this._headers["Content-Type"] = "application/json";
        } else {
          this._body = payload ?? "";
        }
        return this;
      },
      setHeader: function(name: string, value: string) {
        this._headers[name] = value;
      },
      end: function(data?: string) {
        this._body = data ?? this._body ?? "";
      },
    };

    await handler(req, res);
    
    // Return the response
    return new Response(res._body, {
      status: res.statusCode,
      headers: res._headers,
    });
  } catch (error: any) {
    console.error(`API ${handlerName} failed:`, error);
    return c.json({ error: error?.message || "Internal server error" }, 500);
  }
});

// Serve static files from dist folder (production build)
const distPath = path.join(root, "dist");
app.use("/*", serveStatic({ root: distPath }));

// SPA fallback - serve index.html for client-side routing
app.get("*", async (c) => {
  const indexPath = path.join(distPath, "index.html");
  try {
    const indexContent = await fs.readFile(indexPath, "utf-8");
    return c.html(indexContent);
  } catch {
    return c.text("Not found - please run `bun run build` first", 404);
  }
});

// Start the server
console.log(`M2 Fleet Portal running on port ${port}`);
export default {
  port,
  fetch: app.fetch,
};
