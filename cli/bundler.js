const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');

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

async function bundleScript({ source, entryPath, resolveDir, returnDefault = false }) {
  // Preserve the existing expression-result behavior for ordinary scripts.
  // Only module graphs need an IIFE wrapper, which otherwise turns the final
  // eval expression into undefined/null.
  if (!/^\s*(?:import|export)\b/m.test(source)) {
    const transformed = await esbuild.transform(source, {
      loader: 'js',
      target: 'es5',
      sourcefile: entryPath || '<inline>.js',
      sourcemap: 'inline',
    });
    return transformed.code;
  }

  const result = await esbuild.build({
    bundle: true,
    format: 'iife',
    ...(returnDefault ? { globalName: '__irscBundleResult' } : {}),
    platform: 'neutral',
    // Script modules are authored in ES5-compatible JavaScript. esbuild only
    // needs to remove ESM syntax and bundle the local modules here.
    target: 'es5',
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
  const bundled = result.outputFiles[0].text;
  return returnDefault ? `${bundled}\n__irscBundleResult.default;` : bundled;
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
