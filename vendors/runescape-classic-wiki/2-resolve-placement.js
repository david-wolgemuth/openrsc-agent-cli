#!/usr/bin/env node
/**
 * Stage 2: resolve-placement. No network calls — pure logic over stage 1's
 * output, so it's cheap to rerun if you want to change the tie-break rule.
 *
 * "Most specific" = deepest category path a page was found under. If a page
 * is tied for max depth under two different paths, we pick one
 * deterministically (alphabetically first path) but also log it to
 * ambiguous.json so you can manually override later if the auto-pick is wrong.
 *
 * Output (in ./state/):
 *   placement.json  - { pageTitle: { path: "Items/Bones", depth: 2 } }
 *   ambiguous.json  - pages where the top pick was a tie, with all tied paths
 */

'use strict';

const fs = require('fs/promises');
const path = require('path');
const { STATE_DIR } = require('./common');

// These categories are useful facets in the source wiki, but are too broad
// to be useful as a page's primary filesystem location. They remain in the
// crawled category tree and indexes; they are ignored only during placement.
const PLACEMENT_BLACKLIST = new Set([
  'Free-to-play items',
  "Members' items",
  'Tradeable items',
  'Untradeable items',
  'Quest items',
  'Items dropped by monster',
  'Items with spawns',
  'Items with transcripts',
  'Recipes that use a facility',
  'Recipes that require a tool',
  'Skill items',
  'Equipable items',
  'Stackable items',
  'Herblaw items',
  'Useless items',
  'Unobtainable items',
]);

function containsBlacklistedCategory(categoryPath) {
  const leaf = categoryPath.split('/').at(-1);
  return PLACEMENT_BLACKLIST.has(leaf) || leaf.toLowerCase().endsWith(' images');
}

async function main() {
  const raw = await fs.readFile(path.join(STATE_DIR, 'page-memberships.json'), 'utf8');
  const memberships = JSON.parse(raw);

  const placement = {};
  const ambiguous = {};

  for (const [pageTitle, candidates] of Object.entries(memberships)) {
    const deeperCandidates = candidates.filter((candidate) => candidate.depth > 1);
    const eligible = deeperCandidates.filter(
      (candidate) => !containsBlacklistedCategory(candidate.path)
    );
    // If every leaf is broad/faceted, retain the deepest source category
    // rather than flattening the page to the top-level root.
    const candidatesForPlacement = eligible.length > 0
      ? eligible
      : deeperCandidates.length > 0
        ? deeperCandidates
        : candidates;
    const maxDepth = Math.max(...candidatesForPlacement.map((c) => c.depth));
    const deepest = candidatesForPlacement
      .filter((c) => c.depth === maxDepth)
      .sort((a, b) => a.path.localeCompare(b.path));

    placement[pageTitle] = { path: deepest[0].path, depth: deepest[0].depth };

    if (deepest.length > 1) {
      ambiguous[pageTitle] = deepest;
    }
  }

  await fs.writeFile(path.join(STATE_DIR, 'placement.json'), JSON.stringify(placement, null, 2), 'utf8');
  await fs.writeFile(path.join(STATE_DIR, 'ambiguous.json'), JSON.stringify(ambiguous, null, 2), 'utf8');

  console.log(`Resolved placement for ${Object.keys(placement).length} pages.`);
  console.log(`${Object.keys(ambiguous).length} pages had tied depth — see state/ambiguous.json`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
