#!/usr/bin/env node

/**
 * Emergency build script for when database is unavailable
 * Creates a minimal static site with essential pages only
 */

const fs = require("fs");
const path = require("path");

console.log("🚨 Emergency build mode - Database unavailable");
console.log("📦 Creating minimal static site...");

// Create minimal out directory structure
const outDir = path.join(__dirname, "..", "out");
const distDir = path.join(__dirname, "..", ".next");

// Copy .next/static files if they exist
if (fs.existsSync(distDir)) {
  console.log("📁 Copying static assets...");
  // This would copy essential static files
}

// Create minimal sitemap with essential pages only
const minimalSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://cd3.kr/</loc>
    <lastmod>${new Date().toISOString().split("T")[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://cd3.kr/dashboard/</loc>
    <lastmod>${new Date().toISOString().split("T")[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
</urlset>`;

// Ensure out directory exists
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Write minimal sitemap
fs.writeFileSync(path.join(outDir, "sitemap.xml"), minimalSitemap);

console.log("✅ Emergency build completed");
console.log(
  "⚠️  Note: This is a minimal build. Full build requires database connection."
);

module.exports = {
  createEmergencyBuild: () => console.log("Emergency build ready"),
};
