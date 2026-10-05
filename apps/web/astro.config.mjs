import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import path from 'node:path';

function honoDevPlugin() {
  return {
    name: 'hono-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api')) {
          return next();
        }
        try {
          const apiPath = path.resolve(server.config.root, '../api/src/index.ts');
          const apiModule = await server.ssrLoadModule(apiPath);
          const api = apiModule.default;

          const protocol = req.headers['x-forwarded-proto'] || 'http';
          const host = req.headers.host || 'localhost:3000';
          const url = new URL(req.url, `${protocol}://${host}`);

          let body = undefined;
          if (req.method !== 'GET' && req.method !== 'HEAD') {
            const chunks = [];
            for await (const chunk of req) {
              chunks.push(chunk);
            }
            body = Buffer.concat(chunks);
          }

          const headers = new Headers();
          for (const [key, value] of Object.entries(req.headers)) {
            if (value !== undefined) {
              if (Array.isArray(value)) {
                value.forEach((v) => headers.append(key, v));
              } else {
                headers.set(key, value);
              }
            }
          }

          const webReq = new Request(url.toString(), {
            method: req.method,
            headers,
            body,
          });

          const webRes = await api.fetch(webReq, { ENVIRONMENT: 'development' });

          res.statusCode = webRes.status;
          webRes.headers.forEach((val, key) => {
            res.setHeader(key, val);
          });

          const arrayBuffer = await webRes.arrayBuffer();
          res.end(Buffer.from(arrayBuffer));
        } catch (err) {
          console.error('[hono-dev-api error]:', err);
          next(err);
        }
      });
    },
  };
}

export default defineConfig({
  integrations: [react(), tailwind()],
  // Prefetch internal links on hover (P12: MPA nav was a full reload + refetch)
  prefetch: { prefetchAll: true },
  vite: {
    plugins: [honoDevPlugin()],
  },
});

