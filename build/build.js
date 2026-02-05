#!/usr/bin/env node

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CORE_DIR = path.join(ROOT, 'core');
const PLATFORMS_DIR = path.join(ROOT, 'platforms');
const DIST_DIR = path.join(ROOT, 'dist');

const platform = process.argv[2];
if (!platform) {
  console.error('Usage: node build/build.js <chrome|firefox|safari>');
  process.exit(1);
}

const platformDir = path.join(PLATFORMS_DIR, platform);
const manifestPath = path.join(platformDir, 'manifest.json');
const overridesDir = path.join(platformDir, 'overrides');
const outDir = path.join(DIST_DIR, platform);

async function pathExists(p) {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}

async function emptyDir(dir) {
  if (!(await pathExists(dir))) return;
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  await Promise.all(entries.map(async (entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await emptyDir(full);
      await fsp.rmdir(full);
    } else {
      await fsp.unlink(full);
    }
  }));
}

async function copyRecursive(src, dest) {
  const stat = await fsp.stat(src);
  if (stat.isDirectory()) {
    await fsp.mkdir(dest, { recursive: true });
    const entries = await fsp.readdir(src, { withFileTypes: true });
    for (const entry of entries) {
      const from = path.join(src, entry.name);
      const to = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        await copyRecursive(from, to);
      } else if (entry.isFile()) {
        await fsp.copyFile(from, to);
      }
    }
    return;
  }
  await fsp.copyFile(src, dest);
}

async function build() {
  if (!(await pathExists(CORE_DIR))) {
    throw new Error(`Missing core directory: ${CORE_DIR}`);
  }
  if (!(await pathExists(platformDir))) {
    throw new Error(`Unknown platform: ${platform}`);
  }
  if (!(await pathExists(manifestPath))) {
    throw new Error(`Missing manifest: ${manifestPath}`);
  }

  await fsp.mkdir(DIST_DIR, { recursive: true });
  await fsp.mkdir(outDir, { recursive: true });
  await emptyDir(outDir);

  // Copy core extension files.
  await copyRecursive(CORE_DIR, outDir);

  // Apply platform overrides if present.
  if (await pathExists(overridesDir)) {
    await copyRecursive(overridesDir, outDir);
  }

  // Copy platform manifest last so it always wins.
  await fsp.copyFile(manifestPath, path.join(outDir, 'manifest.json'));

  console.log(`Built ${platform} into ${path.relative(ROOT, outDir)}`);
}

build().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
