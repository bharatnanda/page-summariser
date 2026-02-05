#!/usr/bin/env node

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT, 'dist');

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

async function run() {
  if (!(await pathExists(DIST_DIR))) {
    console.log('dist/ does not exist, nothing to clean');
    return;
  }

  await emptyDir(DIST_DIR);
  console.log('cleaned dist/');
}

run().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
