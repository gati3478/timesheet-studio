#!/usr/bin/env node

import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const DIRS_TO_CLEAN = ['build', '.svelte-kit', 'test-results', 'playwright-report', 'coverage'];

for (const dir of DIRS_TO_CLEAN) {
  const target = resolve(dir);
  try {
    await rm(target, { recursive: true, force: true });
    console.log(`Removed ${dir}`);
  } catch {
    // Already absent
  }
}
