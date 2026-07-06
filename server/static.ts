import express, { type Express } from 'express';
import fs from 'fs';
import path from 'path';

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, 'public');

  if (!fs.existsSync(distPath)) {
    console.error(`Build directory not found: ${distPath}`);
    // Return a basic response for health checks even if build is missing
    app.use('*', (_req, res) => {
      res.status(503).json({ error: 'Application not built', path: distPath });
    });
    return;
  }

  const indexPath = path.resolve(distPath, 'index.html');
  if (!fs.existsSync(indexPath)) {
    console.error(`index.html not found in: ${distPath}`);
    app.use('*', (_req, res) => {
      res.status(503).json({ error: 'index.html not found' });
    });
    return;
  }

  // Serve static files.
  // - Hashed assets (/assets/*) are immutable: the filename changes when content
  //   changes, so they can be cached forever.
  // - index.html must always be revalidated, otherwise iPad Safari (especially
  //   home-screen web apps) keeps a stale index that references chunks from an
  //   old deploy — causing "Importing binding name ... is not found" errors.
  app.use(
    express.static(distPath, {
      index: false,
      setHeaders: (res, filePath) => {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    })
  );

  // A missing hashed asset means the client is on an old deploy. Return 404 so
  // the failed dynamic import triggers the client-side reload handler — never
  // serve index.html as if it were JavaScript.
  app.use('/assets', (_req, res) => {
    res.status(404).json({ error: 'Asset not found (new version deployed)' });
  });

  // Fall through to index.html for SPA routing
  app.use('*', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indexPath);
  });
}
