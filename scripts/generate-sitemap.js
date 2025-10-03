#!/usr/bin/env node

/**
 * Dynamic Sitemap Generator for CD3 Project
 *
 * This script generates a sitemap.xml file based on the actual generated
 * static HTML files in the out/ directory after SSG build.
 *
 * Usage: node scripts/generate-sitemap.js
 */

const fs = require("fs");
const path = require("path");

const BASE_URL = "https://www.chundan.xyz";
const OUT_DIR = path.join(__dirname, "..", "out");
const SITEMAP_PATH = path.join(OUT_DIR, "sitemap.xml");

// Priority mapping for different page types
const PAGE_PRIORITIES = {
  "/": 1.0,
  "/dashboard": 0.9,
  "/marketcaps": 0.8,
  "/marketcap": 0.8,
  "/per": 0.8,
  "/pbr": 0.8,
  "/eps": 0.8,
  "/bps": 0.8,
  "/div": 0.8,
  "/dps": 0.8,
  "/company": 0.7,
  "/security": 0.6,
  "/screener": 0.5,
};

// Change frequency mapping
const CHANGE_FREQUENCIES = {
  "/": "daily",
  "/dashboard": "daily",
  "/marketcaps": "daily",
  "/marketcap": "daily",
  "/per": "daily",
  "/pbr": "daily",
  "/eps": "daily",
  "/bps": "daily",
  "/div": "daily",
  "/dps": "daily",
  "/company": "daily",
  "/security": "daily",
  "/screener": "weekly",
};

// Get priority for a URL path
function getPriority(urlPath) {
  // Check for exact matches first
  if (PAGE_PRIORITIES[urlPath]) {
    return PAGE_PRIORITIES[urlPath];
  }

  // Check for pattern matches
  for (const [pattern, priority] of Object.entries(PAGE_PRIORITIES)) {
    if (urlPath.startsWith(pattern + "/")) {
      return priority;
    }
  }

  // Default priority
  return 0.5;
}

// Get change frequency for a URL path
function getChangeFrequency(urlPath) {
  // Check for exact matches first
  if (CHANGE_FREQUENCIES[urlPath]) {
    return CHANGE_FREQUENCIES[urlPath];
  }

  // Check for pattern matches
  for (const [pattern, frequency] of Object.entries(CHANGE_FREQUENCIES)) {
    if (urlPath.startsWith(pattern + "/")) {
      return frequency;
    }
  }

  // Default frequency
  return "monthly";
}

// Recursively find all HTML files
function findHtmlFiles(dir, baseDir = dir) {
  const files = [];
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...findHtmlFiles(fullPath, baseDir));
    } else if (item.endsWith(".html")) {
      // Convert file path to URL path
      const relativePath = path.relative(baseDir, fullPath);
      let urlPath = "/" + relativePath.replace(/\\/g, "/");

      // Handle index.html files
      if (urlPath.endsWith("/index.html")) {
        urlPath = urlPath.replace("/index.html", "/");
      } else if (urlPath.endsWith(".html")) {
        urlPath = urlPath.replace(".html", "");
      }

      // Clean up root path
      if (urlPath === "/index") {
        urlPath = "/";
      }

      files.push(urlPath);
    }
  }

  return files;
}

// Generate sitemap XML with image support
function generateSitemap(urls) {
  const now = new Date().toISOString();

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n';
  xml +=
    '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n';

  // Sort URLs for consistent output
  const sortedUrls = urls.sort();

  for (const url of sortedUrls) {
    const priority = getPriority(url);
    const changefreq = getChangeFrequency(url);
    const fullUrl = BASE_URL + url;

    xml += "  <url>\n";
    xml += `    <loc>${fullUrl}</loc>\n`;
    xml += `    <lastmod>${now}</lastmod>\n`;
    xml += `    <changefreq>${changefreq}</changefreq>\n`;
    xml += `    <priority>${priority.toFixed(1)}</priority>\n`;

    // Add image information for main pages
    if (url === "/") {
      xml += "    <image:image>\n";
      xml +=
        "      <image:loc>https://www.chundan.xyz/opengraph-image.png</image:loc>\n";
      xml +=
        "      <image:title>천하제일 단타대회 - 한국 주식 시장 투자 정보</image:title>\n";
      xml += "    </image:image>\n";
    }

    xml += "  </url>\n";
  }

  xml += "</urlset>\n";

  return xml;
}

// Main function
function main() {
  console.log(
    "🚀 Starting dynamic sitemap generation for 천하제일 단타대회..."
  );

  // Check if out directory exists
  if (!fs.existsSync(OUT_DIR)) {
    console.error("❌ Error: out/ directory not found. Run the build first.");
    process.exit(1);
  }

  try {
    // Find all HTML files
    console.log("📁 Scanning for HTML files in out/ directory...");
    const urls = findHtmlFiles(OUT_DIR);

    console.log(`📊 Found ${urls.length} pages:`);
    urls.slice(0, 10).forEach((url) => console.log(`   ${url}`));
    if (urls.length > 10) {
      console.log(`   ... and ${urls.length - 10} more pages`);
    }

    // Generate sitemap
    console.log("🔧 Generating sitemap.xml...");
    const sitemapXml = generateSitemap(urls);

    // Write sitemap
    fs.writeFileSync(SITEMAP_PATH, sitemapXml, "utf8");

    console.log(`✅ Sitemap generated successfully!`);
    console.log(`📄 Location: ${SITEMAP_PATH}`);
    console.log(`🔗 Total URLs: ${urls.length}`);

    // Show some statistics
    const stats = {};
    urls.forEach((url) => {
      const segment = url.split("/")[1] || "root";
      stats[segment] = (stats[segment] || 0) + 1;
    });

    console.log("\n📈 Page statistics:");
    Object.entries(stats)
      .sort(([, a], [, b]) => b - a)
      .forEach(([segment, count]) => {
        console.log(`   ${segment}: ${count} pages`);
      });
  } catch (error) {
    console.error("❌ Error generating sitemap:", error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { generateSitemap, findHtmlFiles, getPriority };
