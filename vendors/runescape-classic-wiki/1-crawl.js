#!/usr/bin/env node
/**
 * Stage 1: crawl.
 *
 * Input: top-level category names, given as CLI args, e.g.
 *   CONTACT_EMAIL=you@example.com node 1-crawl.js Items Monsters Quests
 *
 * Each top-level category's subcategories are discovered automatically
 * (list=categorymembers, ns=14 entries), recursively. A category can appear
 * under more than one top-level tree, or more than once within the same
 * tree via a different path (diamond membership) — that's expected and
 * handled by resolve-placement.js later, not here. We only guard against
 * true cycles (a category being its own ancestor).
 *
 * Output (in ./state/):
 *   category-trees.json    - one tree per top-level category, titles only
 *   page-memberships.json  - { pageTitle: [ { path: "Items/Bones", depth: 2 }, ... ] }
 */

'use strict';

const fs = require('fs/promises');
const path = require('path');
const { requireContactEmail, mwApi, sleep, STATE_DIR, SLEEP_MS } = require('./common');

const USER_AGENT = requireContactEmail();

const topLevelCategories = process.argv.slice(2);
if (topLevelCategories.length === 0) {
  throw new Error('Usage: node 1-crawl.js <TopLevelCategory> [more categories...]');
}

// Cache so a category's members are only fetched once even if it's
// reachable via multiple paths in the tree(s).
const memberCache = new Map(); // categoryTitle -> { subcats: string[], pages: string[] }

async function getCategoryMembers(categoryTitle) {
  if (memberCache.has(categoryTitle)) return memberCache.get(categoryTitle);

  const subcats = [];
  const pages = [];
  let cmcontinue;

  do {
    const data = await mwApi(USER_AGENT, {
      action: 'query',
      list: 'categorymembers',
      cmtitle: `Category:${categoryTitle}`,
      cmlimit: '500',
      ...(cmcontinue ? { cmcontinue } : {}),
    });

    for (const member of data.query?.categorymembers ?? []) {
      if (member.ns === 14) {
        subcats.push(member.title.replace(/^Category:/, ''));
      } else if (member.ns === 6) {
        // File namespace pages are image-description records, not wiki
        // content pages. The binary assets are not part of this dump.
        continue;
      } else {
        pages.push(member.title);
      }
    }

    cmcontinue = data.continue?.cmcontinue;
    await sleep(SLEEP_MS);
  } while (cmcontinue);

  const result = { subcats, pages };
  memberCache.set(categoryTitle, result);
  return result;
}

// pageTitle -> array of { path: string[], depth: number }
const pageMemberships = new Map();

function recordMembership(pageTitle, categoryPathArr) {
  if (!pageMemberships.has(pageTitle)) pageMemberships.set(pageTitle, []);
  pageMemberships.get(pageTitle).push({
    path: categoryPathArr.join('/'),
    depth: categoryPathArr.length,
  });
}

/**
 * ancestors = path from a top-level root down to (not including) `title`,
 * used only to detect true cycles (title appearing as its own ancestor).
 */
async function buildTree(title, ancestors = []) {
  if (ancestors.includes(title)) {
    console.warn(`Cycle detected: ${[...ancestors, title].join(' -> ')} — stopping recursion here.`);
    return { title, subcats: [], cyclic: true };
  }

  const categoryPath = [...ancestors, title];
  console.log(`${'  '.repeat(ancestors.length)}Category: ${title}`);

  const { subcats, pages } = await getCategoryMembers(title);

  for (const pageTitle of pages) {
    recordMembership(pageTitle, categoryPath);
  }

  const subcatNodes = [];
  for (const sub of subcats) {
    subcatNodes.push(await buildTree(sub, categoryPath));
  }

  return { title, subcats: subcatNodes };
}

async function main() {
  await fs.mkdir(STATE_DIR, { recursive: true });

  const trees = [];
  for (const top of topLevelCategories) {
    trees.push(await buildTree(top));
  }

  await fs.writeFile(
    path.join(STATE_DIR, 'category-trees.json'),
    JSON.stringify(trees, null, 2),
    'utf8'
  );

  const membershipsObj = Object.fromEntries(pageMemberships);
  await fs.writeFile(
    path.join(STATE_DIR, 'page-memberships.json'),
    JSON.stringify(membershipsObj, null, 2),
    'utf8'
  );

  console.log(`\nWrote ${trees.length} top-level tree(s) and ${pageMemberships.size} page memberships to ${STATE_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
