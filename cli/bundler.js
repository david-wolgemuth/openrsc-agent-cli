const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const babel = require('@babel/core');
const presetEnv = require('@babel/preset-env');

const SCRIPT_ROOT = path.resolve(__dirname, '..', 'scripts');

function isWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function localImportsOnly() {
  return {
    name: 'local-scripts-only',
    setup(build) {
      build.onResolve({ filter: /.*/ }, (args) => {
        if (args.path.startsWith('node:') || (!args.path.startsWith('.') && !path.isAbsolute(args.path))) {
          return { errors: [{ text: `only relative local imports are allowed: ${args.path}` }] };
        }

        const resolved = path.resolve(args.resolveDir, args.path);
        if (!isWithin(SCRIPT_ROOT, resolved)) {
          return { errors: [{ text: `import is outside scripts/: ${args.path}` }] };
        }
        return { path: resolved };
      });
    },
  };
}

async function bundleScript({ source, entryPath, resolveDir }) {
  const result = await esbuild.build({
    bundle: true,
    format: 'iife',
    platform: 'neutral',
    // esbuild handles bundling but deliberately does not lower ES2015 to ES5.
    // Babel performs that final compatibility pass below.
    target: 'es2015',
    sourcemap: false,
    write: false,
    plugins: [localImportsOnly()],
    ...(entryPath
      ? { entryPoints: [entryPath] }
      : {
          stdin: {
            contents: source,
            sourcefile: '<inline>.js',
            resolveDir,
            loader: 'js',
          },
        }),
  });

  if (!result.outputFiles || result.outputFiles.length !== 1) {
    throw new Error('bundler did not produce exactly one output file');
  }
  const transformed = babel.transformSync(result.outputFiles[0].text, {
    filename: entryPath || '<inline>.js',
    sourceMaps: 'inline',
    presets: [[presetEnv, { targets: { ie: '11' }, modules: false }]],
  });
  if (!transformed || !transformed.code) throw new Error('Babel did not produce bundled output');
  return transformed.code;
}

function validateEntryPath(entryPath) {
  const absolute = path.resolve(entryPath);
  if (!isWithin(SCRIPT_ROOT, absolute)) {
    throw new Error(`script must be inside scripts/: ${entryPath}`);
  }
  if (!fs.statSync(absolute).isFile()) throw new Error(`script is not a file: ${entryPath}`);
  return absolute;
}

module.exports = { SCRIPT_ROOT, bundleScript, validateEntryPath };
