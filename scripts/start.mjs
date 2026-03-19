#!/usr/bin/env node

/**
 * Unified launcher for Timesheet Studio.
 *
 * Handles dependency installation, template preparation, port validation,
 * dev server startup, and browser opening in a single command.
 *
 * Usage:
 *   npm start
 *   HOST=0.0.0.0 PORT=3000 npm start
 */

import { execFileSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const HOST = process.env.HOST ?? '127.0.0.1';
const PORT = Number(process.env.PORT ?? 5173);
const APP_URL = `http://${HOST}:${PORT}`;

// ── Logging ──────────────────────────────────────────────

function log(msg) {
  console.log(`\x1b[36m▸\x1b[0m ${msg}`);
}

function success(msg) {
  console.log(`\x1b[32m✓\x1b[0m ${msg}`);
}

function error(msg) {
  console.error(`\x1b[31m✗\x1b[0m ${msg}`);
}

// ── Helpers ──────────────────────────────────────────────

function isPortFree(port, host) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, host);
  });
}

async function waitForReady(url, timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}

function openBrowser(url) {
  try {
    if (process.platform === 'darwin') execFileSync('open', [url]);
    else if (process.platform === 'linux') execFileSync('xdg-open', [url]);
    else if (process.platform === 'win32') execFileSync('cmd', ['/c', 'start', '', url]);
  } catch {
    // Non-fatal: user can open manually
  }
}

function run(cmd, args) {
  execFileSync(cmd, args, { stdio: 'inherit', cwd: ROOT });
}

// ── Main ─────────────────────────────────────────────────

async function main() {
  process.chdir(ROOT);

  console.log();
  console.log('  \x1b[1mTimesheet Studio\x1b[0m');
  console.log('  ────────────────────────────');
  console.log();

  // 1. Dependencies
  if (!existsSync('node_modules')) {
    log('Installing dependencies...');
    run('npm', ['install']);
    success('Dependencies installed.');
  } else {
    success('Dependencies ready.');
  }

  // 2. Template
  if (!existsSync('static/templates/timesheet_template.docx')) {
    log('Preparing DOCX template (requires LibreOffice)...');
    run('npm', ['run', 'prepare:template']);
    success('Template prepared.');
  } else {
    success('Template ready.');
  }

  // 3. Port check
  if (!(await isPortFree(PORT, HOST))) {
    error(`Port ${PORT} is already in use.`);
    error(`Set a different port: PORT=3000 npm start`);
    process.exit(1);
  }

  // 4. Start dev server
  log(`Starting on ${APP_URL}...`);
  console.log();

  const child = spawn('npx', ['vite', 'dev', '--host', HOST, '--port', String(PORT)], {
    stdio: 'inherit',
    cwd: ROOT
  });

  const cleanup = () => {
    if (!child.killed) child.kill('SIGTERM');
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // 5. Wait for readiness and open browser
  const ready = await waitForReady(APP_URL);
  if (ready) {
    openBrowser(APP_URL);
  } else {
    error('Server did not become ready within 30 seconds.');
  }

  // 6. Keep alive until server exits
  await new Promise((resolve) => child.on('close', resolve));
}

main().catch((err) => {
  error(err.message);
  process.exit(1);
});
