#!/usr/bin/env node
/**
 * Stage 4: build a category tree from the flat content pool.
 *
 * This is a local-only, non-destructive operation:
 *   - source files are copied, never moved or rewritten
 *   - the destination must not already exist
 *   - output is assembled in a temporary sibling directory and renamed into
 *     place only after the complete build succeeds
 *
 * Input:
 *   state/category-trees.json
 *   state/placement.json
 *   flat/manifest.json
 *   flat/pages/*
 *
 * Output:
 *   <destination>/index.json
 *   <destination>/locations.json
 *   <destination>/manifest.json
 *   <destination>/<category>/<subcategory>/index.json
 *   <destination>/<category>/<subcategory>/<page>.wikitext
 *
 * Usage:
 *   node 4-build-tree.js
 *   node 4-build-tree.js --source ./flat --destination ./tree-output-v1
 *   node 4-build-tree.js --source ./flat --destination ./tree-output-v1 --dry-run
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs/promises');
const fsConstants = require('fs').constants;
const path = require('path');
const { slugify, STATE_DIR } = require('./common');

const DEFAULT_SOURCE_DIR = path.resolve(__dirname, 'flat');
const DEFAULT_DESTINATION_DIR = path.resolve(__dirname, 'tree-output');
const ROOT_DIRECTORY_NAMES = new Map([
  ['Non-player characters', 'NPCs'],
]);

function categoryDirectorySegments(segments) {
  return segments.map((segment, index) => {
    if (index === 0 && ROOT_DIRECTORY_NAMES.has(segment)) {
      return ROOT_DIRECTORY_NAMES.get(segment);
    }
    return slugify(segment);
  });
}

function printUsage() {
  console.log(
    'Usage: node 4-build-tree.js ' +
    '[--source <flat-dir>] [--destination <new-dir>] [--dry-run] [--allow-missing]'
  );
}

function parseArgs(argv) {
  const options = {
    sourceDir: DEFAULT_SOURCE_DIR,
    destinationDir: DEFAULT_DESTINATION_DIR,
    dryRun: false,
    allowMissing: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--source') {
      const value = argv[++i];
      if (!value) throw new Error('--source requires a directory');
      options.sourceDir = path.resolve(value);
    } else if (arg === '--destination') {
      const value = argv[++i];
      if (!value) throw new Error('--destination requires a directory');
      options.destinationDir = path.resolve(value);
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--allow-missing') {
      options.allowMissing = true;
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') return false;
    throw err;
  }
}

function isInside(candidate, parent) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function toPublicPath(relativePath) {
  const value = relativePath.split(path.sep).join('/');
  return value ? `/${value}` : '/';
}

function shortHash(value) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 10);
}

function safePageFilename(title, pageId, namesUsedInDirectory) {
  const base = slugify(title).slice(0, 170) || `page-${pageId ?? shortHash(title)}`;
  let filename = `${base}.wikitext`;
  let collisionKey = filename.toLocaleLowerCase('en-US');

  if (namesUsedInDirectory.has(collisionKey)) {
    filename = `${base}--${pageId ?? shortHash(title)}.wikitext`;
    collisionKey = filename.toLocaleLowerCase('en-US');
  }

  if (namesUsedInDirectory.has(collisionKey)) {
    filename = `${base}--${pageId ?? 'page'}-${shortHash(title)}.wikitext`;
    collisionKey = filename.toLocaleLowerCase('en-US');
  }

  if (namesUsedInDirectory.has(collisionKey)) {
    throw new Error(`Could not create a unique filename for page: ${title}`);
  }

  namesUsedInDirectory.add(collisionKey);
  return filename;
}

function collectCategories(trees) {
  const byLogicalPath = new Map();
  const filesystemPaths = new Map();
  const titleLocations = new Map();

  function visit(node, parentSegments = []) {
    const segments = [...parentSegments, node.title];
    const logicalPath = segments.join('/');
    const relativeDir = path.join(...categoryDirectorySegments(segments));
    const filesystemKey = relativeDir.toLocaleLowerCase('en-US');

    const priorLogicalPath = filesystemPaths.get(filesystemKey);
    if (priorLogicalPath && priorLogicalPath !== logicalPath) {
      throw new Error(
        `Two category paths collapse to the same filesystem path: ` +
        `${priorLogicalPath} and ${logicalPath}`
      );
    }
    filesystemPaths.set(filesystemKey, logicalPath);

    let category = byLogicalPath.get(logicalPath);
    if (!category) {
      category = {
        title: node.title,
        logicalPath,
        relativeDir,
        parentLogicalPath: parentSegments.length ? parentSegments.join('/') : null,
        subcategories: new Map(),
        pages: [],
      };
      byLogicalPath.set(logicalPath, category);
    }

    if (!titleLocations.has(node.title)) titleLocations.set(node.title, new Set());
    titleLocations.get(node.title).add(toPublicPath(relativeDir));

    for (const subcategory of node.subcats ?? []) {
      const subSegments = [...segments, subcategory.title];
      const subLogicalPath = subSegments.join('/');
      const subRelativeDir = path.join(...categoryDirectorySegments(subSegments));
      category.subcategories.set(subLogicalPath, {
        title: subcategory.title,
        path: toPublicPath(subRelativeDir),
      });
      visit(subcategory, segments);
    }
  }

  for (const tree of trees) visit(tree);

  return { byLogicalPath, titleLocations };
}

async function loadInputs(sourceDir) {
  const [treesRaw, placementRaw, flatManifestRaw] = await Promise.all([
    fs.readFile(path.join(STATE_DIR, 'category-trees.json'), 'utf8'),
    fs.readFile(path.join(STATE_DIR, 'placement.json'), 'utf8'),
    fs.readFile(path.join(sourceDir, 'manifest.json'), 'utf8'),
  ]);

  const trees = JSON.parse(treesRaw);
  const placement = JSON.parse(placementRaw);
  const flatManifest = JSON.parse(flatManifestRaw);

  if (!flatManifest.pages || typeof flatManifest.pages !== 'object') {
    throw new Error(`Invalid flat manifest: ${path.join(sourceDir, 'manifest.json')}`);
  }

  return { trees, placement, flatManifest };
}

async function preflight(options, inputs, categories) {
  if (isInside(options.destinationDir, options.sourceDir)) {
    throw new Error('Destination must not be the flat source directory or a child of it.');
  }

  if (await pathExists(options.destinationDir)) {
    throw new Error(
      `Destination already exists; refusing to modify it: ${options.destinationDir}\n` +
      'Choose a new destination directory.'
    );
  }

  const missing = [];
  const jobs = [];
  const namesByCategory = new Map();

  for (const [pageTitle, resolved] of Object.entries(inputs.placement)) {
    const category = categories.byLogicalPath.get(resolved.path);
    if (!category) {
      missing.push({ pageTitle, reason: `resolved category path not found: ${resolved.path}` });
      continue;
    }

    const flatEntry = inputs.flatManifest.pages[pageTitle];
    if (!flatEntry?.file) {
      missing.push({ pageTitle, reason: 'not present in flat manifest' });
      continue;
    }

    const sourceFile = path.resolve(options.sourceDir, flatEntry.file);
    if (!isInside(sourceFile, options.sourceDir)) {
      throw new Error(`Flat manifest points outside the source directory: ${flatEntry.file}`);
    }
    if (!await pathExists(sourceFile)) {
      missing.push({ pageTitle, reason: `flat file does not exist: ${flatEntry.file}` });
      continue;
    }

    if (!namesByCategory.has(category.logicalPath)) {
      namesByCategory.set(category.logicalPath, new Set());
    }

    const filename = safePageFilename(
      pageTitle,
      flatEntry.pageId,
      namesByCategory.get(category.logicalPath)
    );
    const destinationRelativeFile = path.join(category.relativeDir, filename);

    const job = {
      pageTitle,
      category,
      flatEntry,
      sourceFile,
      filename,
      destinationRelativeFile,
    };
    category.pages.push(job);
    jobs.push(job);
  }

  if (missing.length > 0 && !options.allowMissing) {
    const preview = missing
      .slice(0, 20)
      .map((item) => `  ${item.pageTitle}: ${item.reason}`)
      .join('\n');
    const remaining = missing.length > 20 ? `\n  ...and ${missing.length - 20} more` : '';
    throw new Error(
      `Preflight found ${missing.length} page(s) that cannot be copied:\n${preview}${remaining}\n` +
      'Run stage 3 again, or pass --allow-missing to build a partial tree.'
    );
  }

  return { jobs, missing };
}

async function writeJsonExclusive(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
  });
}

async function buildTree(options, inputs, categories, jobs, missing) {
  const parentDir = path.dirname(options.destinationDir);
  const destinationName = path.basename(options.destinationDir);
  const temporaryDir = path.join(
    parentDir,
    `.${destinationName}.partial-${process.pid}-${Date.now()}`
  );

  await fs.mkdir(parentDir, { recursive: true });
  await fs.mkdir(temporaryDir, { recursive: false });

  try {
    for (const category of categories.byLogicalPath.values()) {
      const absoluteDir = path.join(temporaryDir, category.relativeDir);
      await fs.mkdir(absoluteDir, { recursive: true });

      const pages = [...category.pages]
        .sort((a, b) => a.pageTitle.localeCompare(b.pageTitle))
        .map((job) => ({
          title: job.pageTitle,
          file: job.filename,
        }));

      const subcategories = [...category.subcategories.values()]
        .sort((a, b) => a.title.localeCompare(b.title));

      await writeJsonExclusive(path.join(absoluteDir, 'index.json'), {
        title: category.title,
        path: toPublicPath(category.relativeDir),
        parent: category.parentLogicalPath
          ? toPublicPath(categories.byLogicalPath.get(category.parentLogicalPath)?.relativeDir ?? '')
          : null,
        subcategories,
        pages,
      });
    }

    for (let i = 0; i < jobs.length; i += 1) {
      const job = jobs[i];
      const destinationFile = path.join(temporaryDir, job.destinationRelativeFile);
      await fs.copyFile(job.sourceFile, destinationFile, fsConstants.COPYFILE_EXCL);

      if ((i + 1) % 250 === 0 || i + 1 === jobs.length) {
        console.log(`Copied ${i + 1}/${jobs.length} pages`);
      }
    }

    const locations = {};
    const pageManifest = {};
    for (const job of jobs.sort((a, b) => a.pageTitle.localeCompare(b.pageTitle))) {
      locations[job.pageTitle] = toPublicPath(job.category.relativeDir);
      pageManifest[job.pageTitle] = {
        directory: toPublicPath(job.category.relativeDir),
        file: toPublicPath(job.destinationRelativeFile),
        pageId: job.flatEntry.pageId ?? null,
        revisionId: job.flatEntry.revisionId ?? null,
        timestamp: job.flatEntry.timestamp ?? null,
      };
    }

    const categoryManifest = {};
    for (const [title, locationSet] of [...categories.titleLocations.entries()]
      .sort(([a], [b]) => a.localeCompare(b))) {
      categoryManifest[title] = [...locationSet].sort();
    }

    const topLevelCategories = inputs.trees.map((tree) => ({
      title: tree.title,
      path: toPublicPath(path.join(...categoryDirectorySegments([tree.title]))),
    }));

    await writeJsonExclusive(path.join(temporaryDir, 'index.json'), {
      generatedAt: new Date().toISOString(),
      topLevelCategories,
      pagesCopied: jobs.length,
      pagesMissing: missing.length,
    });

    await writeJsonExclusive(path.join(temporaryDir, 'locations.json'), locations);
    await writeJsonExclusive(path.join(temporaryDir, 'manifest.json'), {
      version: 1,
      generatedAt: new Date().toISOString(),
      pages: pageManifest,
      categories: categoryManifest,
      missing,
    });

    await fs.rename(temporaryDir, options.destinationDir);
  } catch (err) {
    await fs.rm(temporaryDir, { recursive: true, force: true });
    throw err;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const inputs = await loadInputs(options.sourceDir);
  const categories = collectCategories(inputs.trees);
  const { jobs, missing } = await preflight(options, inputs, categories);

  console.log(`Flat source: ${options.sourceDir}`);
  console.log(`New tree: ${options.destinationDir}`);
  console.log(`Categories: ${categories.byLogicalPath.size}`);
  console.log(`Pages to copy: ${jobs.length}`);
  console.log(`Missing pages: ${missing.length}`);

  if (options.dryRun) {
    console.log('Dry run complete. No files were written.');
    return;
  }

  await buildTree(options, inputs, categories, jobs, missing);

  console.log('');
  console.log(`Tree created: ${options.destinationDir}`);
  console.log(`Flat source left unchanged: ${options.sourceDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
