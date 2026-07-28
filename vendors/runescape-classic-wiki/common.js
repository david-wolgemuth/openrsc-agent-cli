'use strict';

const path = require('path');

const BASE = 'https://classic.runescape.wiki';
const API_URL = `${BASE}/api.php`;

const SLEEP_MS = 500;
const STATE_DIR = path.resolve(__dirname, 'state');
const OUT_DIR = path.resolve(__dirname, 'output');

function requireContactEmail() {
  const email = process.env.CONTACT_EMAIL;
  if (!email) {
    throw new Error(
      'CONTACT_EMAIL env var is required (MediaWiki API etiquette wants a ' +
      'reachable contact in the User-Agent). Example:\n' +
      '  CONTACT_EMAIL=you@example.com node 1-crawl.js Items Monsters'
    );
  }
  return `wiki-dump-script/1.0 (contact: ${email})`;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** GET api.php with the given query params, using the given User-Agent. */
async function mwApi(userAgent, params) {
  const url = new URL(API_URL);
  url.search = new URLSearchParams({ format: 'json', ...params }).toString();

  const res = await fetch(url, { headers: { 'User-Agent': userAgent } });
  if (!res.ok) {
    throw new Error(`API request failed: ${res.status} ${res.statusText} (${url})`);
  }
  return res.json();
}

/** Filesystem-safe slug for a page/category title. */
function slugify(title) {
  return title
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .trim();
}

module.exports = {
  BASE,
  API_URL,
  SLEEP_MS,
  STATE_DIR,
  OUT_DIR,
  requireContactEmail,
  sleep,
  mwApi,
  slugify,
};
