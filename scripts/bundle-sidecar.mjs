/**
 * Bundle the SvelteKit server as a Tauri sidecar.
 *
 * Steps:
 * 1. Bundle build/index.js + all deps into a single ESM file via esbuild
 * 2. Copy build/client/ into src-tauri/resources/ (static assets served by the server)
 * 3. Copy DOCX template into src-tauri/resources/templates/
 * 4. Download the Node.js binary for the current platform
 * 5. Rename to node-server-<target-triple> in src-tauri/binaries/
 *
 * Environment variables:
 *   SIDECAR_NODE_VERSION  — Override the Node.js version to bundle (default: 22.16.0 LTS)
 *   SKIP_NODE_DOWNLOAD    — Set to "1" to skip downloading Node.js (reuse existing binary)
 */

import { execFileSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, chmodSync } from 'node:fs';
import { cp, rm, rename } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { arch, platform } from 'node:os';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const ROOT = resolve(import.meta.dirname, '..');
const SRC_TAURI = join(ROOT, 'src-tauri');
const RESOURCES = join(SRC_TAURI, 'resources');
const BINARIES = join(SRC_TAURI, 'binaries');

// Pin to Node.js LTS for reproducible, smaller builds (~45 MB vs ~127 MB for current)
const NODE_VERSION = process.env.SIDECAR_NODE_VERSION || '22.16.0';

/** Get the Rust target triple from rustc */
function getTargetTriple() {
  const output = execFileSync('rustc', ['-vV'], { encoding: 'utf-8' });
  const match = output.match(/host:\s*(.+)/);
  if (!match) throw new Error('Could not determine Rust target triple. Is Rust installed?');
  return match[1].trim();
}

/** Map OS/arch to Node.js download identifiers */
function getNodePlatform() {
  const os = platform();
  const cpu = arch();

  const osMap = { darwin: 'darwin', linux: 'linux', win32: 'win' };
  const archMap = { arm64: 'arm64', x64: 'x64' };

  const nodeOs = osMap[os];
  const nodeArch = archMap[cpu];
  if (!nodeOs || !nodeArch) throw new Error(`Unsupported platform: ${os}-${cpu}`);

  return { os: nodeOs, arch: nodeArch, isWindows: os === 'win32' };
}

/** Download a file from a URL with progress indication */
async function download(url, dest) {
  console.log(`  Downloading: ${url}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed: HTTP ${response.status} from ${url}`);
  const fileStream = createWriteStream(dest);
  await pipeline(response.body, fileStream);
  console.log('  Download complete.');
}

/** Compute SHA-256 hash of a file for verification logging */
async function sha256(filepath) {
  const data = await readFile(filepath);
  return createHash('sha256').update(data).digest('hex');
}

async function main() {
  const targetTriple = getTargetTriple();
  const { os: nodeOs, arch: nodeArch, isWindows } = getNodePlatform();

  console.log('=== Timesheet Studio — Sidecar Bundler ===');
  console.log(`  Platform:     ${nodeOs}-${nodeArch}`);
  console.log(`  Target:       ${targetTriple}`);
  console.log(`  Node.js:      v${NODE_VERSION} (LTS)`);
  console.log('');

  // Ensure build output exists
  if (!existsSync(join(ROOT, 'build', 'index.js'))) {
    throw new Error('build/index.js not found. Run `npm run build` first.');
  }

  // Clean and create directories
  await rm(RESOURCES, { recursive: true, force: true });
  mkdirSync(RESOURCES, { recursive: true });
  mkdirSync(join(RESOURCES, 'templates'), { recursive: true });
  mkdirSync(BINARIES, { recursive: true });

  // Step 1: Bundle server with esbuild
  console.log('[1/4] Bundling SvelteKit server with esbuild...');
  const outfile = join(RESOURCES, 'server-bundle.mjs');
  const esbuildBin = join(ROOT, 'node_modules', '.bin', 'esbuild');
  execFileSync(
    esbuildBin,
    [
      'build/index.js',
      '--bundle',
      '--platform=node',
      '--target=node20',
      '--format=esm',
      '--banner:js=import { createRequire } from "module"; const require = createRequire(import.meta.url);',
      `--outfile=${outfile}`
    ],
    { cwd: ROOT, stdio: 'inherit' }
  );
  console.log('');

  // Step 2: Copy build/client/ (static assets the server needs to serve)
  console.log('[2/4] Copying static assets...');
  await cp(join(ROOT, 'build', 'client'), join(RESOURCES, 'client'), { recursive: true });

  // Step 3: Copy DOCX template
  console.log('[3/4] Copying DOCX template...');
  const templateSrc = join(ROOT, 'static', 'templates', 'timesheet_template.docx');
  if (!existsSync(templateSrc)) {
    throw new Error(
      `Template not found at ${templateSrc}. Run \`npm run prepare:template\` first.`
    );
  }
  await cp(templateSrc, join(RESOURCES, 'templates', 'timesheet_template.docx'));

  // Step 4: Download Node.js binary
  console.log('[4/4] Preparing Node.js runtime binary...');
  const ext = isWindows ? '.exe' : '';
  const sidecarName = `node-server-${targetTriple}${ext}`;
  const sidecarPath = join(BINARIES, sidecarName);

  if (process.env.SKIP_NODE_DOWNLOAD === '1' && existsSync(sidecarPath)) {
    console.log(`  Reusing existing binary: ${sidecarName}`);
  } else if (existsSync(sidecarPath) && !process.env.FORCE_NODE_DOWNLOAD) {
    console.log(`  Binary already exists: ${sidecarName}`);
  } else {
    if (isWindows) {
      const zipName = `node-v${NODE_VERSION}-${nodeOs}-${nodeArch}.zip`;
      const url = `https://nodejs.org/dist/v${NODE_VERSION}/${zipName}`;
      const zipPath = join(BINARIES, zipName);
      await download(url, zipPath);

      // Use PowerShell on Windows (unzip may not exist)
      execFileSync(
        'powershell',
        [
          '-NoProfile',
          '-Command',
          `Expand-Archive -Path '${zipPath}' -DestinationPath '${BINARIES}' -Force; ` +
            `Move-Item -Force -Path '${join(BINARIES, `node-v${NODE_VERSION}-${nodeOs}-${nodeArch}`, 'node.exe')}' -Destination '${sidecarPath}'`
        ],
        { stdio: 'inherit' }
      );
      await rm(zipPath);
      // Clean up extracted directory
      await rm(join(BINARIES, `node-v${NODE_VERSION}-${nodeOs}-${nodeArch}`), {
        recursive: true,
        force: true
      });
    } else {
      const tarName = `node-v${NODE_VERSION}-${nodeOs}-${nodeArch}.tar.gz`;
      const url = `https://nodejs.org/dist/v${NODE_VERSION}/${tarName}`;
      const tarPath = join(BINARIES, tarName);
      await download(url, tarPath);

      execFileSync(
        'tar',
        [
          '-xzf',
          tarPath,
          '-C',
          BINARIES,
          '--strip-components=2',
          `node-v${NODE_VERSION}-${nodeOs}-${nodeArch}/bin/node`
        ],
        { stdio: 'inherit' }
      );
      await rename(join(BINARIES, 'node'), sidecarPath);
      await rm(tarPath);
    }

    chmodSync(sidecarPath, 0o755);
  }

  // Print summary with verification hashes
  const bundleHash = (await sha256(outfile)).substring(0, 12);
  const nodeHash = (await sha256(sidecarPath)).substring(0, 12);

  console.log('');
  console.log('=== Sidecar bundle complete ===');
  console.log(`  Server bundle: server-bundle.mjs (sha256:${bundleHash}…)`);
  console.log(`  Node binary:   ${sidecarName} (sha256:${nodeHash}…)`);
  console.log(`  Static assets: resources/client/`);
  console.log(`  Template:      resources/templates/timesheet_template.docx`);
  console.log('');
  console.log('  Next: run `npx tauri build` to create the desktop app.');
}

main().catch((err) => {
  console.error(`\n✗ Bundle sidecar failed: ${err.message}`);
  process.exit(1);
});
