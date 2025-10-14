import * as express from "express";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

type Express = express.Express;
import { type Server } from "http";
import { nanoid } from "nanoid";
import { logger } from './utils/logger';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Vite and its logger are only needed in development. We'll import them dynamically
// inside setupVite to prevent requiring 'vite' at runtime in production bundles.
let viteLogger: any = null;

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  logger.info(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  if (process.env.NODE_ENV === 'production') return;

  let createViteServer: any;
  let createLogger: any;
  let viteConfig: any;
  
  try {
    const viteModule = await import('vite');
    createViteServer = viteModule.createServer;
    createLogger = viteModule.createLogger;
    
    try {
      const configModule = await import('../vite.config.ts');
      viteConfig = configModule;
    } catch (configErr) {
      logger.warn({ context: configErr }, 'Could not load vite.config.ts, using default config:');
      viteConfig = { default: {} };
    }
  } catch (err) {
    logger.error({ error: err }, 'Error importing Vite:');
    throw err;
  }

  viteLogger = createLogger();

  const port = parseInt(process.env.PORT || '5000', 10);
  
  // Correctly shape Vite's server options for development
  const serverOptions = {
    middlewareMode: true,
    hmr: {
      port: 24678,
      host: 'localhost',
    },
    host: 'localhost',
  };

  const vite = await createViteServer({
    ...(viteConfig.default || {}),
    configFile: false,
    // Merge existing server config (from vite.config.ts) so we don't lose fs/hmr defaults
    server: { ...((viteConfig.default as any)?.server || {}), ...serverOptions },
    customLogger: {
      ...viteLogger,
      error: (msg: any, options: any) => {
        viteLogger.error(msg, options);
        // Don't exit on Vite errors in development
        logger.error({ error: msg }, 'Vite error (non-fatal):');
      },
    },
    appType: "custom",
  });

  // HMR will use its own port (24678) to avoid conflicts with WebSocket services
  logger.info(`[vite-dev] HMR configured on separate port: 24678`);

  // Development-time diagnostic: log server address and HMR config so we
  // can verify the WebSocket URL generation and detect misconfiguration
  try {
    const serverAddress: any = (server as any).address ? (server as any).address() : null;
    const boundPort = serverAddress && serverAddress.port ? serverAddress.port : process.env.PORT || vite?.config?.server?.port || 'unknown';
    const hmrCfg: any = vite?.config?.server?.hmr;
    const hmrStatus = hmrCfg?.server ? 'parent-server' : (hmrCfg?.port ?? 'auto');
    logger.info(`[vite-dev] HTTP server bound port: ${boundPort}, vite.hmr: ${hmrStatus}`);
  } catch (e) {
    // non-fatal; continue silently if introspection fails
  }

  app.use(vite.middlewares);
  // Lightweight request logger to help diagnose asset vs SPA routing issues
  app.use((req, res, next) => {
    const ext = path.extname(req.path);
    const accept = String(req.headers['accept'] || '');
    log(`dev request: ${req.method} ${req.originalUrl} ext='${ext}' accept='${accept}'`, 'vite-dev');
    next();
  });
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    // If the request looks like it's for a static asset (has a file extension)
    // or the client does not accept HTML, skip serving the SPA index and let
    // the vite middlewares (or other handlers) handle it. This prevents
    // returning index.html for JS module requests (which causes MIME type errors).
    const ext = path.extname(url);
    const accept = String(req.headers['accept'] || '');
    if (ext && ext !== '') return next();
    if (!accept.includes('text/html')) return next();

    try {
      const clientTemplate = path.resolve(
        __dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  // The Vite build writes files to <repo-root>/dist/public (see vite.config.ts outDir).
  // Serve from that directory (one level up from server folder).
  const distPath = path.resolve(__dirname, "..", "dist", "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Serve static files with smarter caching and precompressed support
  // Log asset requests to help debug missing files or incorrect fallback behavior
  app.use((req, res, next) => {
    const ext = path.extname(req.path);
    if (ext && ext !== '') {
      const filePath = path.join(distPath, req.path);
      const exists = fs.existsSync(filePath);
      log(`static request: ${req.method} ${req.path} -> exists=${exists}`, 'serve-static');
    }
    next();
  });
  // Set long cache TTL for fingerprinted assets but prevent caching for index.html
  app.use((req, res, next) => {
    const url = req.path;
    if (url === "/" || url.endsWith("index.html")) {
      // Don't cache HTML entry points
      res.setHeader("Cache-Control", "no-store, must-revalidate");
    } else {
      // Cache other static assets for 1 year (immutable)
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    }
    next();
  });

  // Middleware to serve precompressed assets when available
  app.use((req, res, next) => {
    const acceptEncoding = req.headers["accept-encoding"] || "";
    const tryServeCompressed = (filePath: string) => {
      if (fs.existsSync(filePath)) {
        return filePath;
      }
      return null;
    };

    // Only for GET requests
    if (req.method !== "GET") return next();

    const originalUrl = req.path;
    // Only handle requests for static asset files (has an extension)
    if (!path.extname(originalUrl)) return next();

    const uncompressedPath = path.join(distPath, originalUrl);

    // Helper to serve a file with proper headers and conditional GET
    const serveFileWithHeaders = (fileOnDisk: string, encoding?: string) => {
      try {
        const stat = fs.statSync(fileOnDisk);

        // Conditional GET support
        const ifModifiedSince = req.headers['if-modified-since'];
        if (ifModifiedSince) {
          const since = new Date(ifModifiedSince as string);
          if (!isNaN(since.getTime()) && stat.mtime <= since) {
            res.status(304).end();
            return true;
          }
        }

        if (encoding) res.setHeader('Content-Encoding', encoding);
        // Indicate that encoding selection may vary
        res.setHeader('Vary', 'Accept-Encoding');

        // Content-Type based on extension
        const contentType = require('mime-types').lookup(path.extname(fileOnDisk)) || 'application/octet-stream';
        res.setHeader('Content-Type', contentType as string);
        res.setHeader('Content-Length', String(stat.size));
        res.setHeader('Last-Modified', stat.mtime.toUTCString());

        res.sendFile(fileOnDisk);
        return true;
      } catch (e) {
        return false;
      }
    };

    // Prefer Brotli
    if (acceptEncoding.includes("br")) {
      const brPath = uncompressedPath + ".br";
      if (fs.existsSync(brPath)) {
        if (serveFileWithHeaders(brPath, 'br')) return;
      }
    }

    // Then gzip
    if (acceptEncoding.includes("gzip")) {
      const gzPath = uncompressedPath + ".gz";
      if (fs.existsSync(gzPath)) {
        if (serveFileWithHeaders(gzPath, 'gzip')) return;
      }
    }

    next();
  });

  // Serve static files fallback
  app.use(express.static(distPath));

  // Handle API routes first
  app.use("/api", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      next();
    }
  });

  // Handle client-side routing - serve index.html for routes without file extensions.
  // For requests that include an extension (likely an asset), return 404 so
  // the client doesn't receive HTML where it expects JS/CSS (avoids MIME errors).
  app.get("*", (req, res) => {
    const ext = path.extname(req.path);
    if (ext && ext !== '') {
      // Asset not found in dist; return 404 instead of index.html
      return res.status(404).end();
    }
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
