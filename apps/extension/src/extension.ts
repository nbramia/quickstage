import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { spawn } from 'node:child_process';
import globby from 'globby';
import prettyBytes from 'pretty-bytes';
import pLimit from 'p-limit';
import mime from 'mime';

type Settings = {
  outputDir?: string;
  ignore?: string[];
  maxFileSizeMB?: number;
  expiryDays?: number;
  passwordMode?: 'auto' | 'ask' | 'reuseLast';
  spaFallback?: boolean;
  public?: boolean;
};

const DEFAULT_SETTINGS: Required<Omit<Settings, 'outputDir' | 'ignore'>> & Pick<Settings, 'outputDir' | 'ignore'> = {
  outputDir: undefined,
  ignore: ['**/*.map', '**/.DS_Store', '**/*.test.*'],
  maxFileSizeMB: 5,
  expiryDays: 7,
  passwordMode: 'auto',
  spaFallback: true,
  public: false,
};

const API_BASE = process.env.PROTOSNAP_API || 'https://quickstage.tech/api';

export function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel('QuickStage');

  context.subscriptions.push(
    vscode.commands.registerCommand('protosnap.openDashboard', async () => {
      vscode.env.openExternal(vscode.Uri.parse('https://quickstage.tech'));
    }),

    vscode.commands.registerCommand('protosnap.settings', async () => {
      const ws = vscode.workspace.workspaceFolders?.[0];
      if (!ws) {
        vscode.window.showErrorMessage('Open a workspace first.');
        return;
      }
      const fileUri = vscode.Uri.joinPath(ws.uri, '.protosnap.json');
      try {
        await vscode.workspace.fs.readFile(fileUri);
      } catch {
        const defaultContent = Buffer.from(
          JSON.stringify(
            {
              outputDir: 'dist',
              ignore: ['**/*.map', '**/.DS_Store', '**/*.test.*'],
              maxFileSizeMB: 5,
              expiryDays: 7,
              passwordMode: 'auto',
              spaFallback: true,
              public: false,
            },
            null,
            2,
          ),
        );
        await vscode.workspace.fs.writeFile(fileUri, defaultContent);
      }
      const doc = await vscode.workspace.openTextDocument(fileUri);
      await vscode.window.showTextDocument(doc);
    }),

    vscode.commands.registerCommand('protosnap.stage-manual', async () => {
      const folderUris = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, canSelectMany: false });
      if (!folderUris || folderUris.length === 0) return;
      const folderUri = folderUris[0];
      if (!folderUri) return;
      await stage(folderUri.fsPath, { manual: true }, output);
    }),

    vscode.commands.registerCommand('protosnap.stage', async () => {
      const ws = vscode.workspace.workspaceFolders?.[0];
      if (!ws) {
        vscode.window.showErrorMessage('Open a workspace first.');
        return;
      }
      await stage(ws.uri.fsPath, { manual: false }, output);
    }),
  );
}

export function deactivate() {}

async function stage(root: string, opts: { manual: boolean }, output: vscode.OutputChannel) {
  output.show(true);
  const settings = await readSettings(root);
  if (!opts.manual) {
    const pre = await preflight(root, output);
    if (!pre.ok) return;
    const buildOk = await runBuild(root, pre.pm, output);
    if (!buildOk) return;
  }
  const outDir = await discoverOutputDir(root, settings, output);
  if (!outDir) return;
  const scan = await scanFiles(outDir, settings, output);
  if (!scan.ok) return;

  const createRes = await fetch(`${API_BASE}/snapshots/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ expiryDays: settings.expiryDays, public: settings.public }),
  });
  if (!createRes.ok) {
    vscode.window.showErrorMessage('Create snapshot failed');
    return;
  }
  const created = await createRes.json();

  const limit = pLimit(8);
  let uploadedBytes = 0;
  async function sha256FileHex(filePath: string): Promise<string> {
    const { createHash } = await import('node:crypto');
    const hash = createHash('sha256');
    await new Promise<void>((resolve, reject) => {
      const s = fs.createReadStream(filePath);
      s.on('data', (d) => hash.update(d));
      s.on('error', reject);
      s.on('end', () => resolve());
    });
    return hash.digest('hex');
  }
  await Promise.all(
    scan.files.map((f) =>
      limit(async () => {
        const rel = path.relative(outDir, f).replace(/\\/g, '/');
        const stat = await fs.promises.stat(f);
        const ct = mime.getType(f) || 'application/octet-stream';
        const h = await sha256FileHex(f);
        const q = new URLSearchParams({ id: created.id, path: rel, ct, sz: String(stat.size), h });
        const up = await fetch(`${API_BASE}/upload-url?${q.toString()}`, { method: 'POST', credentials: 'include' });
        if (!up.ok) throw new Error(`Failed to get upload URL for ${rel}`);
        const { url } = await up.json();
        const res = await fetch(url, { method: 'PUT', headers: { 'Content-Type': ct }, body: fs.createReadStream(f) as any });
        if (!res.ok) throw new Error(`Upload failed ${rel}`);
        uploadedBytes += stat.size;
      }),
    ),
  );

  await fetch(`${API_BASE}/snapshots/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ id: created.id, totalBytes: uploadedBytes, files: await Promise.all(scan.files.map(async (f) => ({ p: path.relative(outDir, f).replace(/\\/g, '/'), ct: mime.getType(f) || 'application/octet-stream', sz: (await fs.promises.stat(f)).size, h: await sha256FileHex(f) }))) }),
  });

  const url = `${API_BASE}/s/${created.id}`;
  vscode.env.clipboard.writeText(`${url}\npassword: ${created.password}`);
  output.appendLine(`Staged ✓ ${url}`);
  vscode.window.showInformationMessage('Staged ✓', 'Open', 'Copy').then((act) => {
    if (act === 'Open') vscode.env.openExternal(vscode.Uri.parse(url));
    if (act === 'Copy') vscode.env.clipboard.writeText(`${url}\npassword: ${created.password}`);
  });
}

async function readSettings(root: string): Promise<Settings> {
  const file = path.join(root, '.protosnap.json');
  try {
    const data = await fs.promises.readFile(file, 'utf8');
    return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

async function preflight(root: string, output: vscode.OutputChannel): Promise<{ ok: boolean; pm: 'pnpm' | 'yarn' | 'npm' }>
{
  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.replace('v', '').split('.')[0] || '0', 10);
  if (major < 18) {
    vscode.window.showErrorMessage(`Node ${nodeVersion} found. Requires ≥18. Fix: nvm install --lts && nvm use --lts. Retry when ready.`);
    return { ok: false, pm: 'pnpm' } as any;
  }
  const pm = await detectPM(root);
  // staleness check: lockfile newer than node_modules
  try {
    const lock = pm === 'pnpm' ? 'pnpm-lock.yaml' : pm === 'yarn' ? 'yarn.lock' : 'package-lock.json';
    const lockStat = await fs.promises.stat(path.join(root, lock));
    const nmStat = await fs.promises.stat(path.join(root, 'node_modules'));
    if (lockStat.mtimeMs > nmStat.mtimeMs + 1000 * 5) {
      const installCmd = pm === 'pnpm' ? 'pnpm i' : pm === 'yarn' ? 'yarn' : 'npm i';
      const act = await vscode.window.showWarningMessage(`Dependencies look outdated/missing. Open terminal to run ${installCmd} now?`, 'Open terminal', 'Skip & Retry');
      if (act === 'Open terminal') {
        const term = vscode.window.createTerminal('QuickStage Install');
        term.sendText(installCmd);
        term.show();
        return { ok: false, pm };
      }
    }
  } catch {}
  // Framework specific checks
  try {
    const pkg = JSON.parse(await fs.promises.readFile(path.join(root, 'package.json'), 'utf8'));
    if (pkg.dependencies?.next || pkg.devDependencies?.next) {
      const candidates = ['next.config.js', 'next.config.mjs', 'next.config.cjs'];
      let hasExport = false;
      for (const f of candidates) {
        const p = path.join(root, f);
        if (fs.existsSync(p)) {
          const txt = await fs.promises.readFile(p, 'utf8');
          if (/output\s*:\s*['"]export['"]/.test(txt)) hasExport = true;
        }
      }
      if (!hasExport) {
        vscode.window.showErrorMessage("Next.js requires static export. Add output: 'export' to next.config.js, then run next build && next export.");
        return { ok: false, pm };
      }
    }
    if (pkg.dependencies?.['@sveltejs/kit'] && !pkg.dependencies?.['@sveltejs/adapter-static'] && !pkg.devDependencies?.['@sveltejs/adapter-static']) {
      vscode.window.showErrorMessage('SvelteKit must use adapter-static with prerender: { entries: [\'*\'] }. See docs snippet.');
      return { ok: false, pm };
    }
  } catch {}
  const pkgPath = path.join(root, 'package.json');
  const pkg = JSON.parse(await fs.promises.readFile(pkgPath, 'utf8'));
  if (!pkg.scripts || !pkg.scripts.build) {
    vscode.window.showErrorMessage('No scripts.build in package.json. Add a build script or use “Stage (Manual output…)”.');
    return { ok: false, pm };
  }
  return { ok: true, pm };
}

async function detectPM(root: string): Promise<'pnpm' | 'yarn' | 'npm'> {
  if (fs.existsSync(path.join(root, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(root, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

async function runBuild(root: string, pm: 'pnpm' | 'yarn' | 'npm', output: vscode.OutputChannel): Promise<boolean> {
  output.appendLine(`Running build with ${pm}…`);
  const cmd = pm === 'pnpm' ? 'pnpm' : pm === 'yarn' ? 'yarn' : 'npm';
  const args = pm === 'npm' ? ['run', 'build'] : ['build'];
  const child = spawn(cmd, args, { cwd: root, shell: process.platform === 'win32' });
  child.stdout.on('data', (d) => output.append(d.toString()));
  child.stderr.on('data', (d) => output.append(d.toString()));
  const code: number = await new Promise((res) => child.on('close', res));
  if (code !== 0) {
    vscode.window.showErrorMessage('Build failed');
    return false;
  }
  return true;
}

async function discoverOutputDir(root: string, settings: Settings, output: vscode.OutputChannel): Promise<string | null> {
  if (settings.outputDir && fs.existsSync(path.join(root, settings.outputDir))) return path.join(root, settings.outputDir);
  const candidates = ['dist', 'build', '.svelte-kit/output/prerendered', 'out'];
  for (const c of candidates) {
    const p = path.join(root, c);
    if (fs.existsSync(path.join(p, 'index.html'))) return p;
  }
  const pick = await vscode.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, canSelectMany: false, title: 'Select output folder' });
  if (!pick || pick.length === 0) {
    vscode.window.showErrorMessage('Build finished but output folder not found. Expected at dist/. Select manually?');
    return null;
  }
  const picked = pick[0];
  if (!picked) return null;
  return picked.fsPath;
}

async function scanFiles(outDir: string, settings: Settings, output: vscode.OutputChannel): Promise<{ ok: true; files: string[] } | { ok: false }>{
  const patterns = ['**/*.{html,js,css,json,png,jpg,jpeg,svg,gif,webp,woff2,wasm}'];
  const ignore = settings.ignore || [];
  const { globby } = await import('globby');
  const files = await globby(patterns, { cwd: outDir, absolute: true, gitignore: true, ignore });
  let total = 0;
  const maxFile = (settings.maxFileSizeMB || 5) * 1024 * 1024;
  const sizes: { f: string; s: number }[] = [];
  for (const f of files) {
    const stat = await fs.promises.stat(f);
    sizes.push({ f, s: stat.size });
    if (stat.size > maxFile) {
      const top = sizes.sort((a, b) => b.s - a.s).slice(0, 10);
      vscode.window.showErrorMessage(`${path.basename(f)} is ${prettyBytes(stat.size)} (>5MB). Reduce or exclude. Largest files: ${top.map((t) => path.basename(t.f) + ' ' + prettyBytes(t.s)).join(', ')}`);
      return { ok: false };
    }
    total += stat.size;
  }
  if (total > 20 * 1024 * 1024) {
    const top = sizes.sort((a, b) => b.s - a.s).slice(0, 10);
    vscode.window.showErrorMessage(`Total bundle ${prettyBytes(total)} exceeds 20MB cap. Consider code-splitting, image compression.`);
    return { ok: false };
  }
  return { ok: true, files };
}


