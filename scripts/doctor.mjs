#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';

let pass = 0;
let warn = 0;
let fail = 0;

function checkPass(msg) {
  console.log(`  \u2713 ${msg}`);
  pass++;
}
function checkWarn(msg) {
  console.log(`  \u26A0 ${msg}`);
  warn++;
}
function checkFail(msg) {
  console.log(`  \u2717 ${msg}`);
  fail++;
}

function which(cmd) {
  try {
    const result = execFileSync(process.platform === 'win32' ? 'where' : 'which', [cmd], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return result.toString().trim().split('\n')[0];
  } catch {
    return null;
  }
}

function getVersion(cmd, args = ['--version']) {
  try {
    return execFileSync(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => server.close(() => resolve(true)));
    server.listen(port, '127.0.0.1');
  });
}

console.log();
console.log('  Timesheet Studio \u2014 Environment Check');
console.log('  ' + '\u2500'.repeat(37));
console.log();

// Node.js
const nodeVer = getVersion('node', ['-v']);
if (nodeVer) {
  const major = Number(nodeVer.replace('v', '').split('.')[0]);
  if (major >= 18) {
    checkPass(`Node.js ${nodeVer.replace('v', '')}`);
  } else {
    checkFail(`Node.js ${nodeVer.replace('v', '')} (need \u226518)`);
  }
} else {
  checkFail('Node.js not found');
}

// npm
const npmVer = getVersion('npm', ['-v']);
if (npmVer) {
  checkPass(`npm ${npmVer}`);
} else {
  checkFail('npm not found');
}

// node_modules
if (existsSync('node_modules')) {
  checkPass('Dependencies installed');
} else {
  checkWarn('Dependencies not installed (run: npm install)');
}

// DOCX template
if (existsSync('static/templates/timesheet_template.docx')) {
  checkPass('DOCX template ready');
} else {
  checkWarn('DOCX template not prepared (run: npm run prepare:template)');
}

// Source .doc template
if (existsSync('timesheet_template.doc')) {
  checkPass('Source template (.doc) present');
} else {
  checkFail('Source template (timesheet_template.doc) missing');
}

// LibreOffice
if (which('soffice')) {
  checkPass('LibreOffice available (DOC export + template prep supported)');
} else {
  checkWarn('LibreOffice not found (DOC export unavailable, DOCX still works)');
}

// Docker
if (which('docker')) {
  checkPass('Docker available');
} else {
  checkWarn('Docker not found (optional, for containerized deployment)');
}

// Port 5173
const portFree = await isPortFree(5173);
if (portFree) {
  checkPass('Port 5173 available');
} else {
  checkWarn('Port 5173 in use (set PORT=<number> to override)');
}

console.log();
console.log('  ' + '\u2500'.repeat(37));
console.log(`  Results: ${pass} passed, ${warn} warnings, ${fail} failed`);
console.log();

process.exit(fail > 0 ? 1 : 0);
