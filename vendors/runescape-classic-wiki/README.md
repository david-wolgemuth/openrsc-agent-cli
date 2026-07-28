# MediaWiki category dump pipeline

This produces a browsable local directory tree of RuneScape Classic Wiki
content. Each category is a directory; each page is a `.wikitext` file; and
each category directory has an `index.json` describing its direct children.

Requires Node.js 18 or newer.

## What the final output looks like

The generated tree has this shape:

```text
tree-output-v1/
├── index.json
├── locations.json
├── manifest.json
├── Items/
│   ├── index.json
│   ├── Equipment/
│   │   ├── index.json
│   │   └── Armour/
│   │       ├── index.json
│   │       └── Bronze_armour.wikitext
│   └── Skill_items/
│       └── Crafting_items/
│           ├── index.json
│           └── Jewellery/
│               ├── index.json
│               └── Amulets/
│                   ├── index.json
│                   └── Amulet_of_accuracy.wikitext
├── NPCs/
│   ├── index.json
│   └── Goblins/
│       ├── index.json
│       └── Goblin.wikitext
├── Locations/
├── Shops/
└── Guides/
```

The exact pages and directories depend on the current wiki categories. The
standard top-level roots are `Categories`, `Items`, `NPCs`, `Locations`,
`Shops`, and `Guides`. `Equipment` is intentionally nested under `Items`, and
the source category `Non-player characters` is written as `NPCs`.

Every category `index.json` contains:

- `title`, `path`, and `parent`
- `subcategories`: direct child category directories
- `pages`: page files directly in the current directory

`index.json` is the navigation map. It is not recursive: follow each entry in
`subcategories` and read that child directory's `index.json` to walk deeper.
The `pages` array similarly lists only files directly in that directory.

The root-level files have different purposes:

- `locations.json` maps each page title to its chosen primary directory
- `manifest.json` maps each page to its exact copied file and revision metadata
- `index.json` lists the top-level roots and total page counts

## A page can belong to multiple categories

The wiki is not a strict tree. A page can be listed in several categories at
once, such as `Items/Free-to-play items`, `Items/Tradeable items`, and
`Items/Recipes that use a facility`. The export copies the page only once,
under one primary location, while preserving all discovered memberships in
`state/page-memberships.json`.

Use these files for different questions:

- All source categories for a page: `state/page-memberships.json`
- The selected primary placement: `state/placement.json`
- The copied output file: root `locations.json` or `manifest.json`

## Examples of the generated files

An `index.json` is a small directory manifest:

```json
{
  "title": "Amulets",
  "path": "/Items/Skill_items/Crafting_items/Jewellery/Amulets",
  "parent": "/Items/Skill_items/Crafting_items/Jewellery",
  "subcategories": [],
  "pages": [
    {
      "title": "Amulet of accuracy",
      "file": "Amulet_of_accuracy.wikitext"
    }
  ]
}
```

The corresponding `locations.json` entry is:

```json
{
  "Amulet of accuracy": "/Items/Skill_items/Crafting_items/Jewellery/Amulets"
}
```

A `.wikitext` file contains the page's original MediaWiki source, not rendered
HTML. For example, an item page may begin like this:

```wikitext
{{Infobox Item
|name = Amulet of accuracy
|members = No
|quest = [[Imp catcher]]
|tradeable = Yes
|equipable = Yes
|id = 235
}}
The '''Amulet of accuracy''' is an [[item]] obtained from [[Wizard Mizgog]].
```

The flat and tree manifests contain machine-readable metadata. A typical page
entry includes the page ID, revision ID, timestamp, and relative file path:

```json
{
  "title": "Amulet of accuracy",
  "pageId": 3058,
  "revisionId": 157937,
  "timestamp": "2026-04-15T02:23:24Z",
  "file": "/Items/Skill_items/Crafting_items/Jewellery/Amulets/Amulet_of_accuracy.wikitext"
}
```

## Run the pipeline

Use a reachable email address in `CONTACT_EMAIL`. It is sent in the API
`User-Agent`; it is not written to the output files.

```bash
CONTACT_EMAIL='you@example.com' node 1-crawl.js \
  Categories Items 'Non-player characters' Locations Shops Guides
node 2-resolve-placement.js
CONTACT_EMAIL='you@example.com' node 3-fetch-content.js ./flat
node 4-build-tree.js --source ./flat --destination ./tree-output-v1 --dry-run
node 4-build-tree.js --source ./flat --destination ./tree-output-v1
```

`Equipment` is intentionally not a top-level crawl root. It is discovered as
`Items/Equipment`. The source category `Non-player characters` is written to
the output directory `NPCs`.

## Stage 1: crawl categories

```bash
CONTACT_EMAIL='you@example.com' node 1-crawl.js Items Locations
```

The script recursively follows category members and writes:

- `state/category-trees.json`: the category hierarchy
- `state/page-memberships.json`: every page and all category paths where it
  was found

MediaWiki `File:` namespace pages are skipped. These are image-description
pages containing wikitext metadata, not the actual PNG or other binary asset.

The category tree may contain broad or overlapping categories. That is useful
source information and is retained even when a category is not selected as a
page's primary location.

## Category membership versus primary placement

A wiki page can belong to several categories at once. For example, an item
might be listed under all of these source categories:

```text
Items/Free-to-play items
Items/Tradeable items
Items/Recipes that use a facility
```

These categories are facets or alternate classifications, not necessarily a
single nested taxonomy. The crawler preserves all of those memberships in
`state/page-memberships.json`, but the filesystem tree needs one location for
the page file. Stage 2 chooses that primary location and writes it to
`state/placement.json`.

The page is copied once into the chosen primary directory. It is not duplicated
under every source category. The other category paths remain visible in the
crawled category tree and can be used to understand alternate memberships.

This means the following two questions have different answers:

- “Which categories contain this page in the wiki?” — inspect
  `state/page-memberships.json`.
- “Where did the export place the page file?” — inspect `locations.json` or
  `state/placement.json`.

## Stage 2: resolve primary placement

```bash
node 2-resolve-placement.js
```

For each page, the resolver prefers the deepest available category path under
the selected roots. Broad facet categories are ignored when a more useful
leaf category exists. The blacklist currently includes categories such as:

- `Free-to-play items`, `Members' items`, `Tradeable items`, and
  `Untradeable items`
- `Quest items`, `Items dropped by monster`, and `Items with spawns`
- recipe, skill/property, and image categories
- `Useless items` and `Unobtainable items`

The blacklist applies only to the final category in a path. For example,
`Items/Skill items/Magic items/Runes` remains valid because `Runes` is the
meaningful leaf. If every available leaf is broad, the deepest source path is
used so pages do not unnecessarily fall directly under `/Items`.

When multiple deepest paths tie, the resolver chooses alphabetically and
records the tie in `state/ambiguous.json`. The complete selected mapping is in
`state/placement.json`.

## Stage 3: fetch page content

```bash
CONTACT_EMAIL='you@example.com' node 3-fetch-content.js ./flat
```

Pages are downloaded in batches into a flat, resumable pool:

- `flat/pages/`: one `.wikitext` file per page
- `flat/manifest.json`: page IDs, revisions, timestamps, and file paths
- `flat/failures.json`: pages that could not be fetched

Existing manifest entries whose files still exist are skipped. The script does
not overwrite an existing file with different content.

## Stage 4: build the category tree

Validate first:

```bash
node 4-build-tree.js \
  --source ./flat \
  --destination ./tree-output-v1 \
  --dry-run
```

Then build:

```bash
node 4-build-tree.js \
  --source ./flat \
  --destination ./tree-output-v1
```

The destination must not already exist. Stage 4 is local-only: it copies
files, never moves them, leaves `flat/` unchanged, and assembles the output in
a temporary directory before completing the build.

Each category directory contains an `index.json` with:

- `title`, `path`, and `parent`
- `subcategories`: direct child category directories
- `pages`: pages directly stored in that directory, with their filenames

For example, an index might look like this:

```json
{
  "title": "Jewellery",
  "path": "/Items/Skill_items/Crafting_items/Jewellery",
  "parent": "/Items/Skill_items/Crafting_items",
  "subcategories": [
    {"title": "Amulets", "path": "/Items/Skill_items/Crafting_items/Jewellery/Amulets"}
  ],
  "pages": [
    {"title": "Amulet mould", "file": "Amulet_mould.wikitext"}
  ]
}
```

`subcategories` tells you which child directories exist. `pages` tells you
which page files are directly inside the current directory. It does not list
pages recursively. To walk the complete subtree, read the current index,
follow each `subcategories[].path`, and read each child `index.json` in turn.

An `index.json` can have both `pages` and `subcategories`, only one of them,
or neither. An empty category index is still meaningful: it means the source
category exists in the crawled hierarchy but has no directly placed pages or
child categories in this export.

The tree root also contains:

- `index.json`: top-level roots and page counts
- `locations.json`: page title to primary directory
- `manifest.json`: copied-file paths and revision metadata

`locations.json` is the quickest lookup when starting from a page title. The
root `manifest.json` adds the exact output file, page ID, revision ID, and
timestamp. The flat-pool `flat/manifest.json` points to the original flat file
and contains the fetched revision metadata.

The `subcategories` and `pages` arrays describe direct children only; follow
the listed child directory indexes to inspect deeper levels.

Use a new destination name, such as `tree-output-v2`, for another build. The
existing output is never replaced automatically.
