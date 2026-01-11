import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  
  if (!fs.existsSync(distPath)) {
    console.error(`Build directory not found: ${distPath}`);
    // Return a basic response for health checks even if build is missing
    app.use("*", (_req, res) => {
      res.status(503).json({ error: "Application not built", path: distPath });
    });
    return;
  }

  const indexPath = path.resolve(distPath, "index.html");
  if (!fs.existsSync(indexPath)) {
    console.error(`index.html not found in: ${distPath}`);
    app.use("*", (_req, res) => {
      res.status(503).json({ error: "index.html not found" });
    });
    return;
  }

  // Serve static files
  app.use(express.static(distPath));

  // Fall through to index.html for SPA routing
  app.use("*", (_req, res) => {
    res.sendFile(indexPath);
  });
}
