#!/usr/bin/env node
/**
 * Stage 3: fetch all resolved pages into a flat, resumable content pool.
 *
 * This stage deliberately does not build the category tree. The network work
 * happens once here; stage 4 can then rebuild different trees using only local
 * files.
 *
 * Input:
 *   state/placement.json
 *
 * Output, by default under ./flat/:
 *   pages/             - one wikitext file per page
 *   manifest.json      - page title -> flat file and revision metadata
 *   failures.json      - missing pages or pages with no readable content
 *
 * Usage:
 *   CONTACT_EMAIL=you@example.com node 3-fetch-content.js
 *   CONTACT_EMAIL=you@example.com node 3-fetch-content.js ./flat-rsc
 *
 * Existing files recorded in manifest.json are skipped. The script never
 * overwrites an existing page file with different content.
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const {
  BASE,
  requireContactEmail,
  mwApi,
  slugify,
  sleep,
  STATE_DIR,
  SLEEP_MS,
} = require('./common');

const USER_AGENT = requireContactEmail();
const PAGE_BATCH_SIZE = 50;
const DEFAULT_FLAT_DIR = path.resolve(__dirname, 'flat');
const FLAT_DIR = path.resolve(process.argv[2] || DEFAULT_FLAT_DIR);
const PAGES_DIR = path.join(FLAT_DIR, 'pages');
const MANIFEST_PATH = path.join(FLAT_DIR, 'manifest.json');
const FAILURES_PATH = path.join(FLAT_DIR, 'failures.json');

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') return false;
    throw err;
  }
}

async function readJsonIfPresent(filePath, fallback) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return fallback;
    throw err;
  }
}

async function writeJsonAtomic(filePath, value) {
  const temporaryPath = `${filePath}.tmp-${process.pid}`;
  await fs.writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await fs.rename(temporaryPath, filePath);
}

function shortHash(value) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 12);
}

function flatFilename(page) {
  const pageId = Number.isInteger(page.pageid) ? String(page.pageid) : shortHash(page.title);
  const readable = slugify(page.title).slice(0, 140) || 'page';
  return `${pageId}-${readable}.wikitext`;
}

function extractCurrentRevision(page) {
  const revision = page.revisions?.[0];
  const slot = revision?.slots?.main;

  return {
    content: slot?.['*'] ?? null,
    revisionId: revision?.revid ?? null,
    parentRevisionId: revision?.parentid ?? null,
    timestamp: revision?.timestamp ?? null,
    contentModel: slot?.contentmodel ?? null,
    contentFormat: slot?.contentformat ?? null,
  };
}

async function fetchPageBatch(requestedTitles) {
  const data = await mwApi(USER_AGENT, {
    action: 'query',
    prop: 'revisions',
    rvprop: 'ids|timestamp|content|contentmodel',
    rvslots: 'main',
    titles: requestedTitles.join('|'),
  });

  if (data.error) {
    throw new Error(`MediaWiki API error ${data.error.code}: ${data.error.info}`);
  }

  const normalizedTitle = new Map(requestedTitles.map((title) => [title, title]));
  for (const item of data.query?.normalized ?? []) {
    normalizedTitle.set(item.from, item.to);
  }
  for (const item of data.query?.converted ?? []) {
    normalizedTitle.set(item.from, item.to);
  }

  const pagesByTitle = new Map();
  for (const page of Object.values(data.query?.pages ?? {})) {
    pagesByTitle.set(page.title, page);
  }

  const result = new Map();
  for (const requestedTitle of requestedTitles) {
    const canonicalTitle = normalizedTitle.get(requestedTitle) ?? requestedTitle;
    result.set(requestedTitle, pagesByTitle.get(canonicalTitle) ?? null);
  }

  return result;
}

async function writePageFileWithoutReplacing(filePath, content) {
  try {
    await fs.writeFile(filePath, content, { encoding: 'utf8', flag: 'wx' });
    return;
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }

  const existing = await fs.readFile(filePath, 'utf8');
  if (existing !== content) {
    throw new Error(
      `Refusing to overwrite an existing flat file with different content: ${filePath}`
    );
  }
}

async function main() {
  const placementPath = path.join(STATE_DIR, 'placement.json');
  const placement = JSON.parse(await fs.readFile(placementPath, 'utf8'));
  const allTitles = Object.keys(placement).sort((a, b) => a.localeCompare(b));

  await fs.mkdir(PAGES_DIR, { recursive: true });

  const manifest = await readJsonIfPresent(MANIFEST_PATH, {
    version: 1,
    site: BASE,
    createdAt: new Date().toISOString(),
    updatedAt: null,
    pages: {},
  });
  manifest.version = 1;
  manifest.site = BASE;
  manifest.pages ??= {};

  const failures = await readJsonIfPresent(FAILURES_PATH, {});
  const pendingTitles = [];

  for (const title of allTitles) {
    const entry = manifest.pages[title];
    if (entry?.file && await fileExists(path.join(FLAT_DIR, entry.file))) {
      continue;
    }
    pendingTitles.push(title);
  }

  console.log(`Pages in placement: ${allTitles.length}`);
  console.log(`Already present: ${allTitles.length - pendingTitles.length}`);
  console.log(`To fetch: ${pendingTitles.length}`);
  console.log(`Flat output: ${FLAT_DIR}`);

  for (let offset = 0; offset < pendingTitles.length; offset += PAGE_BATCH_SIZE) {
    const titles = pendingTitles.slice(offset, offset + PAGE_BATCH_SIZE);
    const last = offset + titles.length;
    console.log(`Fetching ${offset + 1}-${last} of ${pendingTitles.length}`);

    const pages = await fetchPageBatch(titles);

    for (const requestedTitle of titles) {
      const page = pages.get(requestedTitle);
      if (!page || page.missing !== undefined) {
        failures[requestedTitle] = {
          reason: 'missing',
          checkedAt: new Date().toISOString(),
        };
        console.warn(`  Missing: ${requestedTitle}`);
        continue;
      }

      const revision = extractCurrentRevision(page);
      if (revision.content == null) {
        failures[requestedTitle] = {
          reason: 'no-readable-current-revision',
          pageId: page.pageid ?? null,
          checkedAt: new Date().toISOString(),
        };
        console.warn(`  No readable current revision: ${requestedTitle}`);
        continue;
      }

      const filename = flatFilename(page);
      const relativeFile = path.posix.join('pages', filename);
      const absoluteFile = path.join(PAGES_DIR, filename);
      await writePageFileWithoutReplacing(absoluteFile, revision.content);

      manifest.pages[requestedTitle] = {
        title: page.title,
        pageId: page.pageid ?? null,
        namespace: page.ns ?? null,
        revisionId: revision.revisionId,
        parentRevisionId: revision.parentRevisionId,
        timestamp: revision.timestamp,
        contentModel: revision.contentModel,
        contentFormat: revision.contentFormat,
        file: relativeFile,
      };
      delete failures[requestedTitle];
    }

    manifest.updatedAt = new Date().toISOString();
    await writeJsonAtomic(MANIFEST_PATH, manifest);
    await writeJsonAtomic(FAILURES_PATH, failures);
    await sleep(SLEEP_MS);
  }

  manifest.updatedAt = new Date().toISOString();
  await writeJsonAtomic(MANIFEST_PATH, manifest);
  await writeJsonAtomic(FAILURES_PATH, failures);

  const completed = allTitles.filter((title) => manifest.pages[title]).length;
  const failed = allTitles.filter((title) => failures[title]).length;

  console.log('');
  console.log(`Flat export complete: ${completed}/${allTitles.length} pages available.`);
  console.log(`Failures recorded: ${failed}`);
  console.log(`Manifest: ${MANIFEST_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
