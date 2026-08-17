const axios = require("axios");
const cheerio = require("cheerio");

/* -------------------------------------------------- */
/* CONFIG */
/* -------------------------------------------------- */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/* -------------------------------------------------- */
/* CACHE */
/* -------------------------------------------------- */

const cache = new Map();

/* -------------------------------------------------- */
/* HELPERS */
/* -------------------------------------------------- */

function isBad(url = "") {
  return /logo|sprite|icon|placeholder|favicon|base64|ads|tracking/i.test(
    url
  );
}

function absoluteUrl(url, base) {
  try {
    return new URL(url, base).toString();
  } catch {
    return url;
  }
}

/* -------------------------------------------------- */
/* FETCH HTML (robust) */
/* -------------------------------------------------- */

async function fetchHtml(url) {
  try {
    const res = await axios.get(url, {
      headers: {
        "User-Agent": UA,
        "Accept-Language": "de-AT,de;q=0.9,en;q=0.8",
      },
      maxRedirects: 5,
      timeout: 15000,
    });

    return res.data;
  } catch {
    return null;
  }
}

/* -------------------------------------------------- */
/* OG IMAGE EXTRACTION (REAL METHOD) */
/* -------------------------------------------------- */

function extractOgImage(html, baseUrl) {
  if (!html) return null;

  const $ = cheerio.load(html);

  const selectors = [
    'meta[property="og:image"]',
    'meta[name="og:image"]',
    'meta[property="og:image:secure_url"]',
    'meta[name="twitter:image"]',
    'meta[name="twitter:image:src"]',
  ];

  for (const sel of selectors) {
    const content = $(sel).attr("content");
    if (content && !isBad(content)) {
      return absoluteUrl(content, baseUrl);
    }
  }

  return null;
}

/* -------------------------------------------------- */
/* FALLBACK: FIRST LARGE IMAGE IN DOM */
/* -------------------------------------------------- */

function extractLargestImage(html, baseUrl) {
  if (!html) return null;

  const $ = cheerio.load(html);

  let best = null;
  let bestScore = 0;

  $("img").each((_, el) => {
    const src =
      $(el).attr("src") ||
      $(el).attr("data-src") ||
      $(el).attr("data-lazy") ||
      "";

    if (!src || isBad(src)) return;

    const width = parseInt($(el).attr("width") || "0", 10);
    const height = parseInt($(el).attr("height") || "0", 10);

    const score = width * height;

    if (score > bestScore) {
      bestScore = score;
      best = src;
    }
  });

  if (!best) return null;

  return absoluteUrl(best, baseUrl);
}

/* -------------------------------------------------- */
/* MAIN FUNCTION */
/* -------------------------------------------------- */

async function fetchOgImage(input) {
  if (!input) return null;

  if (cache.has(input)) return cache.get(input);

  let url = input;

  const html = await fetchHtml(url);

  if (!html) {
    cache.set(input, null);
    return null;
  }

  /* 1. OG IMAGE (BEST CASE) */
  let image = extractOgImage(html, url);

  /* 2. FALLBACK IMAGE */
  if (!image) {
    image = extractLargestImage(html, url);
  }

  if (image && !isBad(image)) {
    cache.set(input, image);
    return image;
  }

  cache.set(input, null);
  return null;
}

/* -------------------------------------------------- */
/* EXPORT */
/* -------------------------------------------------- */

module.exports = {
  fetchOgImage,
};