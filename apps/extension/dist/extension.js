"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const node_child_process_1 = require("node:child_process");
const pretty_bytes_1 = __importDefault(require("pretty-bytes"));
const p_limit_1 = __importDefault(require("p-limit"));
const mime_1 = __importDefault(require("mime"));
const DEFAULT_SETTINGS = {
    outputDir: undefined,
    ignore: ['**/*.map', '**/.DS_Store', '**/*.test.*'],
    maxFileSizeMB: 5,
    expiryDays: 7,
    passwordMode: 'auto',
    spaFallback: true,
    public: false,
};
const API_BASE = process.env.QUICKSTAGE_API || 'https://quickstage.tech/api';
function activate(context) {
    const output = vscode.window.createOutputChannel('QuickStage');
    context.subscriptions.push(vscode.commands.registerCommand('quickstage.openDashboard', async () => {
        vscode.env.openExternal(vscode.Uri.parse('https://quickstage.tech'));
    }), vscode.commands.registerCommand('quickstage.login', async () => {
        await authenticateUser(context, output);
    }), vscode.commands.registerCommand('quickstage.settings', async () => {
        const ws = vscode.workspace.workspaceFolders?.[0];
        if (!ws) {
            vscode.window.showErrorMessage('Open a workspace first.');
            return;
        }
        const fileUri = vscode.Uri.joinPath(ws.uri, '.quickstage.json');
        try {
            await vscode.workspace.fs.readFile(fileUri);
        }
        catch {
            const defaultContent = Buffer.from(JSON.stringify({
                outputDir: 'dist',
                ignore: ['**/*.map', '**/.DS_Store', '**/*.test.*'],
                maxFileSizeMB: 5,
                expiryDays: 7,
                passwordMode: 'auto',
                spaFallback: true,
                public: false,
            }, null, 2));
            await vscode.workspace.fs.writeFile(fileUri, defaultContent);
        }
        const doc = await vscode.workspace.openTextDocument(fileUri);
        await vscode.window.showTextDocument(doc);
    }), vscode.commands.registerCommand('quickstage.stageManual', async () => {
        const folderUris = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, canSelectMany: false });
        if (!folderUris || folderUris.length === 0)
            return;
        const folderUri = folderUris[0];
        if (!folderUri)
            return;
        await stage(folderUri.fsPath, { manual: true }, output, context);
    }), vscode.commands.registerCommand('quickstage.stage', async () => {
        const ws = vscode.workspace.workspaceFolders?.[0];
        if (!ws) {
            vscode.window.showErrorMessage('Open a workspace first.');
            return;
        }
        await stage(ws.uri.fsPath, { manual: false }, output, context);
    }));
}
function deactivate() { }
async function authenticateUser(context, output) {
    output.show(true);
    output.appendLine('🔐 QuickStage Authentication Required');
    output.appendLine('You need a Personal Access Token (PAT) to use QuickStage.');
    const action = await vscode.window.showInformationMessage('QuickStage requires a Personal Access Token for authentication.', 'Open Dashboard to Generate PAT', 'Enter PAT Manually', 'Cancel');
    if (action === 'Open Dashboard to Generate PAT') {
        // Open the dashboard for the user to generate a PAT
        output.appendLine('🌐 Opening dashboard in browser...');
        vscode.env.openExternal(vscode.Uri.parse('https://quickstage.tech/dashboard'));
        // Wait a moment for the browser to open
        await new Promise(resolve => setTimeout(resolve, 2000));
        output.appendLine('📋 Please generate a PAT from the dashboard, then return here.');
        // Prompt for the PAT with a more explicit message
        const pat = await vscode.window.showInputBox({
            prompt: 'QuickStage Personal Access Token',
            placeHolder: 'Paste your PAT here (e.g., qs_pat_ABC123...)',
            password: true,
            ignoreFocusOut: true // Keep the input box open even if focus changes
        });
        if (pat && pat.trim()) {
            try {
                await context.secrets.store('quickstage-pat', pat.trim());
                output.appendLine('✅ Personal Access Token stored successfully!');
                vscode.window.showInformationMessage('Authentication successful! You can now use QuickStage.');
                return true;
            }
            catch (error) {
                output.appendLine(`❌ Failed to store PAT: ${error}`);
                vscode.window.showErrorMessage('Failed to store PAT. Please try again.');
                return false;
            }
        }
        else if (pat === '') {
            output.appendLine('❌ No PAT provided. Please enter a valid token.');
            vscode.window.showWarningMessage('No PAT provided. Please try again.');
            return false;
        }
        else {
            output.appendLine('❌ PAT input cancelled.');
            return false;
        }
    }
    else if (action === 'Enter PAT Manually') {
        output.appendLine('📝 Manual PAT entry mode...');
        const pat = await vscode.window.showInputBox({
            prompt: 'Enter your QuickStage Personal Access Token',
            placeHolder: 'Paste your PAT here (e.g., qs_pat_ABC123...)',
            password: true,
            ignoreFocusOut: true
        });
        if (pat && pat.trim()) {
            try {
                await context.secrets.store('quickstage-pat', pat.trim());
                output.appendLine('✅ Personal Access Token stored successfully!');
                vscode.window.showInformationMessage('Authentication successful! You can now use QuickStage.');
                return true;
            }
            catch (error) {
                output.appendLine(`❌ Failed to store PAT: ${error}`);
                vscode.window.showErrorMessage('Failed to store PAT. Please try again.');
                return false;
            }
        }
        else if (pat === '') {
            output.appendLine('❌ No PAT provided. Please enter a valid token.');
            vscode.window.showWarningMessage('No PAT provided. Please try again.');
            return false;
        }
        else {
            output.appendLine('❌ PAT input cancelled.');
            return false;
        }
    }
    output.appendLine('❌ Authentication cancelled or failed');
    return false;
}
async function getPAT(context) {
    try {
        return await context.secrets.get('quickstage-pat') || null;
    }
    catch {
        return null;
    }
}
async function stage(root, opts, output, context) {
    output.show(true);
    // Check if user has a stored PAT
    let pat = await getPAT(context);
    if (!pat) {
        output.appendLine('❌ No Personal Access Token found. Please authenticate first.');
        const authenticated = await authenticateUser(context, output);
        if (!authenticated) {
            output.appendLine('❌ Authentication required to continue.');
            return;
        }
        // Get the fresh PAT after authentication
        pat = await getPAT(context);
        if (!pat) {
            output.appendLine('❌ Failed to get PAT after authentication.');
            return;
        }
    }
    const settings = await readSettings(root);
    if (!opts.manual) {
        const pre = await preflight(root, output);
        if (!pre.ok)
            return;
        const buildOk = await runBuild(root, pre.pm, output);
        if (!buildOk)
            return;
    }
    const outDir = await discoverOutputDir(root, settings, output);
    if (!outDir)
        return;
    const scan = await scanFiles(outDir, settings, output);
    if (!scan.ok)
        return;
    output.appendLine('📤 Creating snapshot...');
    // Create snapshot using the PAT
    const createRes = await fetch(`${API_BASE}/snapshots/create`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${pat}`
        },
        body: JSON.stringify({ expiryDays: settings.expiryDays, public: settings.public }),
    });
    if (!createRes.ok) {
        if (createRes.status === 401) {
            output.appendLine('❌ Personal Access Token expired or invalid. Please authenticate again.');
            await context.secrets.delete('quickstage-pat');
            const authenticated = await authenticateUser(context, output);
            if (!authenticated) {
                output.appendLine('❌ Authentication required to continue.');
                return;
            }
            // Retry the entire process with new PAT
            await stage(root, opts, output, context);
            return;
        }
        else {
            output.appendLine(`❌ Create snapshot failed: ${createRes.status} ${createRes.statusText}`);
            vscode.window.showErrorMessage('Create snapshot failed');
            return;
        }
    }
    const created = await createRes.json();
    try {
        await uploadAndFinalize(created, scan, outDir, output, pat, context);
    }
    catch (error) {
        output.appendLine(`❌ Staging process failed: ${error}`);
        vscode.window.showErrorMessage(`Staging failed: ${error}`);
        return;
    }
}
async function uploadAndFinalize(created, scan, outDir, output, pat, context) {
    const limit = (0, p_limit_1.default)(8);
    let uploadedBytes = 0;
    async function sha256FileHex(filePath) {
        const { createHash } = await Promise.resolve().then(() => __importStar(require('node:crypto')));
        const hash = createHash('sha256');
        await new Promise((resolve, reject) => {
            const s = fs.createReadStream(filePath);
            s.on('data', (d) => hash.update(d));
            s.on('error', reject);
            s.on('end', () => resolve());
        });
        return hash.digest('hex');
    }
    output.appendLine('📤 Uploading files...');
    try {
        await Promise.all(scan.files.map((f) => limit(async () => {
            try {
                const rel = path.relative(outDir, f).replace(/\\/g, '/');
                const stat = await fs.promises.stat(f);
                const ct = mime_1.default.getType(f) || 'application/octet-stream';
                const h = await sha256FileHex(f);
                output.appendLine(`  📤 Getting upload URL for: ${rel}`);
                const q = new URLSearchParams({ id: created.id, path: rel, ct, sz: String(stat.size), h });
                const up = await fetch(`${API_BASE}/upload-url?${q.toString()}`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${pat}` }
                });
                if (!up.ok) {
                    const errorText = await up.text();
                    throw new Error(`Failed to get upload URL for ${rel}: ${up.status} ${up.statusText} - ${errorText}`);
                }
                const { url } = await up.json();
                output.appendLine(`  🔗 Upload URL received for: ${rel}`);
                output.appendLine(`  📤 Uploading file: ${rel} (${(stat.size / 1024).toFixed(1)}KB)`);
                // Try direct upload to R2 first, fallback to worker upload if it fails
                let uploadSuccess = false;
                let directError = null;
                try {
                    const res = await fetch(url, {
                        method: 'PUT',
                        headers: { 'Content-Type': ct },
                        body: fs.createReadStream(f),
                        duplex: 'half'
                    });
                    if (res.ok) {
                        uploadSuccess = true;
                        output.appendLine(`  ✅ Direct upload to R2 succeeded: ${rel}`);
                    }
                    else {
                        const errorText = await res.text();
                        output.appendLine(`  ⚠️ Direct upload failed, trying worker upload: ${res.status} ${res.statusText}`);
                    }
                }
                catch (error) {
                    directError = error;
                    output.appendLine(`  ⚠️ Direct upload failed with error, trying worker upload: ${error}`);
                }
                // Fallback: Upload through worker
                if (!uploadSuccess) {
                    try {
                        output.appendLine(`  🔄 Uploading through worker: ${rel}`);
                        // Read file into buffer for worker upload
                        const fileBuffer = await fs.promises.readFile(f);
                        const workerUploadRes = await fetch(`${API_BASE}/upload?id=${created.id}&path=${encodeURIComponent(rel)}`, {
                            method: 'PUT',
                            headers: {
                                'Content-Type': ct,
                                'Authorization': `Bearer ${pat}`,
                                'Content-Length': String(stat.size)
                            },
                            body: fileBuffer
                        });
                        if (!workerUploadRes.ok) {
                            const errorText = await workerUploadRes.text();
                            throw new Error(`Worker upload failed for ${rel}: ${workerUploadRes.status} ${workerUploadRes.statusText} - ${errorText}`);
                        }
                        uploadSuccess = true;
                        output.appendLine(`  ✅ Worker upload succeeded: ${rel}`);
                    }
                    catch (workerError) {
                        const errorMessage = directError
                            ? `Both direct and worker upload failed for ${rel}. Direct error: ${directError}, Worker error: ${workerError}`
                            : `Worker upload failed for ${rel}: ${workerError}`;
                        throw new Error(errorMessage);
                    }
                }
                if (!uploadSuccess) {
                    throw new Error(`Upload failed for ${rel} - no upload method succeeded`);
                }
                uploadedBytes += stat.size;
                output.appendLine(`  ✅ Uploaded: ${rel}`);
            }
            catch (error) {
                output.appendLine(`  ❌ Failed to upload ${f}: ${error}`);
                throw error;
            }
        })));
    }
    catch (error) {
        output.appendLine(`❌ File upload process failed: ${error}`);
        throw error;
    }
    output.appendLine('🔧 Finalizing snapshot...');
    const finalizeRes = await fetch(`${API_BASE}/snapshots/finalize`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${pat}`
        },
        body: JSON.stringify({
            id: created.id,
            totalBytes: uploadedBytes,
            files: await Promise.all(scan.files.map(async (f) => ({
                p: path.relative(outDir, f).replace(/\\/g, '/'),
                ct: mime_1.default.getType(f) || 'application/octet-stream',
                sz: (await fs.promises.stat(f)).size,
                h: await sha256FileHex(f)
            })))
        }),
    });
    if (!finalizeRes.ok) {
        output.appendLine(`❌ Finalize failed: ${finalizeRes.status} ${finalizeRes.statusText}`);
        vscode.window.showErrorMessage('Failed to finalize snapshot');
        return;
    }
    // Generate working URLs that point directly to the Worker
    // This ensures the system works while we fix the routing
    const url = `https://quickstage-worker.nbramia.workers.dev/s/${created.id}`;
    vscode.env.clipboard.writeText(created.password);
    output.appendLine(`🎉 Staged successfully! ${url}`);
    output.appendLine(`📋 Password copied to clipboard: ${created.password}`);
    vscode.window.showInformationMessage('Staged ✓', 'Open', 'Copy').then((act) => {
        if (act === 'Open')
            vscode.env.openExternal(vscode.Uri.parse(url));
        if (act === 'Copy')
            vscode.env.clipboard.writeText(`${url}\npassword: ${created.password}`);
    });
}
async function readSettings(root) {
    const file = path.join(root, '.quickstage.json');
    try {
        const data = await fs.promises.readFile(file, 'utf8');
        return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
    }
    catch {
        return { ...DEFAULT_SETTINGS };
    }
}
async function preflight(root, output) {
    const nodeVersion = process.version;
    const major = parseInt(nodeVersion.replace('v', '').split('.')[0] || '0', 10);
    if (major < 18) {
        vscode.window.showErrorMessage(`Node ${nodeVersion} found. Requires ≥18. Fix: nvm install --lts && nvm use --lts. Retry when ready.`);
        return { ok: false, pm: 'pnpm' };
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
    }
    catch { }
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
                    if (/output\s*:\s*['"]export['"]/.test(txt))
                        hasExport = true;
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
    }
    catch { }
    const pkgPath = path.join(root, 'package.json');
    const pkg = JSON.parse(await fs.promises.readFile(pkgPath, 'utf8'));
    if (!pkg.scripts || !pkg.scripts.build) {
        vscode.window.showErrorMessage('No scripts.build in package.json. Add a build script or use “Stage (Manual output…)”.');
        return { ok: false, pm };
    }
    return { ok: true, pm };
}
async function detectPM(root) {
    if (fs.existsSync(path.join(root, 'pnpm-lock.yaml')))
        return 'pnpm';
    if (fs.existsSync(path.join(root, 'yarn.lock')))
        return 'yarn';
    return 'npm';
}
async function runBuild(root, pm, output) {
    output.appendLine(`Running build with ${pm}…`);
    const cmd = pm === 'pnpm' ? 'pnpm' : pm === 'yarn' ? 'yarn' : 'npm';
    const args = pm === 'npm' ? ['run', 'build'] : ['build'];
    const child = (0, node_child_process_1.spawn)(cmd, args, { cwd: root, shell: process.platform === 'win32' });
    child.stdout.on('data', (d) => output.append(d.toString()));
    child.stderr.on('data', (d) => output.append(d.toString()));
    const code = await new Promise((res) => child.on('close', res));
    if (code !== 0) {
        vscode.window.showErrorMessage('Build failed');
        return false;
    }
    return true;
}
async function discoverOutputDir(root, settings, output) {
    // First check if user specified a custom output directory
    if (settings.outputDir && fs.existsSync(path.join(root, settings.outputDir))) {
        output.appendLine(`✅ Using custom output directory: ${settings.outputDir}`);
        return path.join(root, settings.outputDir);
    }
    // Check for common output directories in current project
    const localCandidates = ['dist', 'build', '.svelte-kit/output/prerendered', 'out', 'public'];
    for (const c of localCandidates) {
        const p = path.join(root, c);
        if (fs.existsSync(path.join(p, 'index.html'))) {
            output.appendLine(`✅ Found output directory: ${c}`);
            return p;
        }
    }
    // Check if this is a monorepo and look for web apps
    output.appendLine('🔍 Checking for monorepo structure...');
    const monorepoOutputs = await findMonorepoOutputs(root, output);
    if (monorepoOutputs.length > 0) {
        if (monorepoOutputs.length === 1) {
            const outputPath = monorepoOutputs[0];
            if (outputPath) {
                output.appendLine(`✅ Found monorepo output: ${outputPath}`);
                return outputPath;
            }
        }
        else {
            // Multiple outputs found, let user choose
            const choice = await vscode.window.showQuickPick(monorepoOutputs.map(p => ({ label: path.basename(p), description: p, value: p })), { placeHolder: 'Multiple build outputs found. Choose one:' });
            if (choice?.value) {
                output.appendLine(`✅ Using output directory: ${choice.value}`);
                return choice.value;
            }
            // User cancelled the selection
            output.appendLine('❌ User cancelled output directory selection');
            return null;
        }
    }
    // Check for static sites that don't need building
    output.appendLine('🔍 Checking for static site files...');
    const staticSite = await findStaticSite(root, output);
    if (staticSite) {
        output.appendLine(`✅ Found static site: ${staticSite}`);
        return staticSite;
    }
    // If we get here, we need user input
    output.appendLine('❌ Could not automatically find build output');
    const pick = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        title: 'Select build output folder',
        openLabel: 'Select Output Folder'
    });
    if (!pick || pick.length === 0) {
        const errorMessage = `Build completed but QuickStage couldn't find your project's output files.

🔍 What QuickStage looked for:
• Standard build directories: dist/, build/, out/, public/
• Monorepo web apps: apps/*/dist, packages/*/dist
• Static site files: index.html in project root

💡 To fix this, you can:
1. Copy this error message to your AI assistant
2. Ask it to help you find where your project builds to
3. Or manually select the folder containing your built files

📁 Your project structure:
${await getProjectStructureSummary(root)}`;
        vscode.window.showErrorMessage(errorMessage);
        return null;
    }
    const picked = pick[0];
    if (!picked)
        return null;
    // Verify the selected folder has the right structure
    if (!fs.existsSync(path.join(picked.fsPath, 'index.html'))) {
        const warningMessage = `⚠️ The selected folder doesn't contain index.html.

This might not be the right build output folder. Make sure you're selecting the folder that contains your built HTML, CSS, and JavaScript files.

Selected folder: ${picked.fsPath}
Contents: ${fs.readdirSync(picked.fsPath).join(', ')}`;
        const continueAnyway = await vscode.window.showWarningMessage(warningMessage, 'Continue Anyway', 'Select Different Folder');
        if (continueAnyway === 'Select Different Folder') {
            return await discoverOutputDir(root, settings, output);
        }
    }
    output.appendLine(`✅ Using manually selected output: ${picked.fsPath}`);
    return picked.fsPath;
}
async function scanFiles(outDir, settings, output) {
    const patterns = ['**/*.{html,js,css,json,png,jpg,jpeg,svg,gif,webp,woff2,wasm}'];
    const ignore = settings.ignore || [];
    const { globby } = await Promise.resolve().then(() => __importStar(require('globby')));
    const files = await globby(patterns, { cwd: outDir, absolute: true, gitignore: true, ignore });
    let total = 0;
    const maxFile = (settings.maxFileSizeMB || 5) * 1024 * 1024;
    const sizes = [];
    for (const f of files) {
        const stat = await fs.promises.stat(f);
        sizes.push({ f, s: stat.size });
        if (stat.size > maxFile) {
            const top = sizes.sort((a, b) => b.s - a.s).slice(0, 10);
            vscode.window.showErrorMessage(`${path.basename(f)} is ${(0, pretty_bytes_1.default)(stat.size)} (>5MB). Reduce or exclude. Largest files: ${top.map((t) => path.basename(t.f) + ' ' + (0, pretty_bytes_1.default)(t.s)).join(', ')}`);
            return { ok: false };
        }
        total += stat.size;
    }
    if (total > 20 * 1024 * 1024) {
        const top = sizes.sort((a, b) => b.s - a.s).slice(0, 10);
        vscode.window.showErrorMessage(`Total bundle ${(0, pretty_bytes_1.default)(total)} exceeds 20MB cap. Consider code-splitting, image compression.`);
        return { ok: false };
    }
    return { ok: true, files };
}
// Helper function to find monorepo outputs
async function findMonorepoOutputs(root, output) {
    const outputs = [];
    // Check for common monorepo patterns
    const monorepoPatterns = [
        'apps/*/dist',
        'apps/*/build',
        'apps/*/out',
        'apps/*/public',
        'packages/*/dist',
        'packages/*/build',
        'packages/*/out',
        'packages/*/public'
    ];
    for (const pattern of monorepoPatterns) {
        try {
            const { globby } = await Promise.resolve().then(() => __importStar(require('globby')));
            const matches = await globby(pattern, {
                cwd: root,
                absolute: true,
                onlyDirectories: true,
                ignore: ['**/node_modules/**']
            });
            for (const match of matches) {
                if (fs.existsSync(path.join(match, 'index.html'))) {
                    outputs.push(match);
                    output.appendLine(`  📁 Found: ${match}`);
                }
            }
        }
        catch (error) {
            // Continue if globby fails for this pattern
            continue;
        }
    }
    return outputs;
}
// Helper function to find static sites
async function findStaticSite(root, output) {
    // Check if root contains index.html (static site)
    if (fs.existsSync(path.join(root, 'index.html'))) {
        // Verify it's a complete static site
        const hasAssets = fs.existsSync(path.join(root, 'css')) ||
            fs.existsSync(path.join(root, 'js')) ||
            fs.existsSync(path.join(root, 'assets')) ||
            fs.existsSync(path.join(root, 'styles')) ||
            fs.existsSync(path.join(root, 'scripts'));
        if (hasAssets || fs.readdirSync(root).some(f => f.endsWith('.css') || f.endsWith('.js'))) {
            output.appendLine('  📁 Found static site in project root');
            return root;
        }
    }
    // Check for static site in common directories
    const staticDirs = ['public', 'static', 'site', 'www'];
    for (const dir of staticDirs) {
        const staticPath = path.join(root, dir);
        if (fs.existsSync(staticPath) && fs.existsSync(path.join(staticPath, 'index.html'))) {
            output.appendLine(`  📁 Found static site in: ${dir}`);
            return staticPath;
        }
    }
    return null;
}
// Helper function to get project structure summary
async function getProjectStructureSummary(root) {
    try {
        const items = await fs.promises.readdir(root);
        const summary = items
            .filter(item => !item.startsWith('.') && item !== 'node_modules')
            .slice(0, 10) // Limit to first 10 items
            .map(item => {
            const fullPath = path.join(root, item);
            const stat = fs.statSync(fullPath);
            return stat.isDirectory() ? `${item}/` : item;
        })
            .join(', ');
        return summary + (items.length > 10 ? '...' : '');
    }
    catch (error) {
        return 'Unable to read project structure';
    }
}
