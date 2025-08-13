"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode = __toESM(require("vscode"));
var fs = __toESM(require("node:fs"));
var path = __toESM(require("node:path"));
var import_node_child_process = require("node:child_process");
var import_pretty_bytes = __toESM(require("pretty-bytes"));
var import_p_limit = __toESM(require("p-limit"));
var import_mime = __toESM(require("mime"));
var DEFAULT_SETTINGS = {
  outputDir: void 0,
  ignore: ["**/*.map", "**/.DS_Store", "**/*.test.*"],
  maxFileSizeMB: 5,
  expiryDays: 7,
  passwordMode: "auto",
  spaFallback: true,
  public: false
};
var API_BASE = process.env.QUICKSTAGE_API || "https://quickstage.tech";
function activate(context) {
  const output = vscode.window.createOutputChannel("QuickStage");
  context.subscriptions.push(
    vscode.commands.registerCommand("quickstage.openDashboard", async () => {
      vscode.env.openExternal(vscode.Uri.parse("https://quickstage.tech"));
    }),
    vscode.commands.registerCommand("quickstage.settings", async () => {
      var _a;
      const ws = (_a = vscode.workspace.workspaceFolders) == null ? void 0 : _a[0];
      if (!ws) {
        vscode.window.showErrorMessage("Open a workspace first.");
        return;
      }
      const fileUri = vscode.Uri.joinPath(ws.uri, ".quickstage.json");
      try {
        await vscode.workspace.fs.readFile(fileUri);
      } catch {
        const defaultContent = Buffer.from(
          JSON.stringify(
            {
              outputDir: "dist",
              ignore: ["**/*.map", "**/.DS_Store", "**/*.test.*"],
              maxFileSizeMB: 5,
              expiryDays: 7,
              passwordMode: "auto",
              spaFallback: true,
              public: false
            },
            null,
            2
          )
        );
        await vscode.workspace.fs.writeFile(fileUri, defaultContent);
      }
      const doc = await vscode.workspace.openTextDocument(fileUri);
      await vscode.window.showTextDocument(doc);
    }),
    vscode.commands.registerCommand("quickstage.stageManual", async () => {
      const folderUris = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, canSelectMany: false });
      if (!folderUris || folderUris.length === 0) return;
      const folderUri = folderUris[0];
      if (!folderUri) return;
      await stage(folderUri.fsPath, { manual: true }, output);
    }),
    vscode.commands.registerCommand("quickstage.stage", async () => {
      var _a;
      const ws = (_a = vscode.workspace.workspaceFolders) == null ? void 0 : _a[0];
      if (!ws) {
        vscode.window.showErrorMessage("Open a workspace first.");
        return;
      }
      await stage(ws.uri.fsPath, { manual: false }, output);
    })
  );
}
function deactivate() {
}
async function stage(root, opts, output) {
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
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ expiryDays: settings.expiryDays, public: settings.public })
  });
  if (!createRes.ok) {
    vscode.window.showErrorMessage("Create snapshot failed");
    return;
  }
  const created = await createRes.json();
  const limit = (0, import_p_limit.default)(8);
  let uploadedBytes = 0;
  async function sha256FileHex(filePath) {
    const { createHash } = await import("node:crypto");
    const hash = createHash("sha256");
    await new Promise((resolve, reject) => {
      const s = fs.createReadStream(filePath);
      s.on("data", (d) => hash.update(d));
      s.on("error", reject);
      s.on("end", () => resolve());
    });
    return hash.digest("hex");
  }
  await Promise.all(
    scan.files.map(
      (f) => limit(async () => {
        const rel = path.relative(outDir, f).replace(/\\/g, "/");
        const stat = await fs.promises.stat(f);
        const ct = import_mime.default.getType(f) || "application/octet-stream";
        const h = await sha256FileHex(f);
        const q = new URLSearchParams({ id: created.id, path: rel, ct, sz: String(stat.size), h });
        const up = await fetch(`${API_BASE}/upload-url?${q.toString()}`, { method: "POST", credentials: "include" });
        if (!up.ok) throw new Error(`Failed to get upload URL for ${rel}`);
        const { url: url2 } = await up.json();
        const res = await fetch(url2, { method: "PUT", headers: { "Content-Type": ct }, body: fs.createReadStream(f) });
        if (!res.ok) throw new Error(`Upload failed ${rel}`);
        uploadedBytes += stat.size;
      })
    )
  );
  await fetch(`${API_BASE}/snapshots/finalize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ id: created.id, totalBytes: uploadedBytes, files: await Promise.all(scan.files.map(async (f) => ({ p: path.relative(outDir, f).replace(/\\/g, "/"), ct: import_mime.default.getType(f) || "application/octet-stream", sz: (await fs.promises.stat(f)).size, h: await sha256FileHex(f) }))) })
  });
  const url = `${API_BASE}/s/${created.id}`;
  vscode.env.clipboard.writeText(`${url}
password: ${created.password}`);
  output.appendLine(`Staged \u2713 ${url}`);
  vscode.window.showInformationMessage("Staged \u2713", "Open", "Copy").then((act) => {
    if (act === "Open") vscode.env.openExternal(vscode.Uri.parse(url));
    if (act === "Copy") vscode.env.clipboard.writeText(`${url}
password: ${created.password}`);
  });
}
async function readSettings(root) {
  const file = path.join(root, ".quickstage.json");
  try {
    const data = await fs.promises.readFile(file, "utf8");
    return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
async function preflight(root, output) {
  var _a, _b, _c, _d, _e;
  const nodeVersion = process.version;
  const major = parseInt(nodeVersion.replace("v", "").split(".")[0] || "0", 10);
  if (major < 18) {
    vscode.window.showErrorMessage(`Node ${nodeVersion} found. Requires \u226518. Fix: nvm install --lts && nvm use --lts. Retry when ready.`);
    return { ok: false, pm: "pnpm" };
  }
  const pm = await detectPM(root);
  try {
    const lock = pm === "pnpm" ? "pnpm-lock.yaml" : pm === "yarn" ? "yarn.lock" : "package-lock.json";
    const lockStat = await fs.promises.stat(path.join(root, lock));
    const nmStat = await fs.promises.stat(path.join(root, "node_modules"));
    if (lockStat.mtimeMs > nmStat.mtimeMs + 1e3 * 5) {
      const installCmd = pm === "pnpm" ? "pnpm i" : pm === "yarn" ? "yarn" : "npm i";
      const act = await vscode.window.showWarningMessage(`Dependencies look outdated/missing. Open terminal to run ${installCmd} now?`, "Open terminal", "Skip & Retry");
      if (act === "Open terminal") {
        const term = vscode.window.createTerminal("QuickStage Install");
        term.sendText(installCmd);
        term.show();
        return { ok: false, pm };
      }
    }
  } catch {
  }
  try {
    const pkg2 = JSON.parse(await fs.promises.readFile(path.join(root, "package.json"), "utf8"));
    if (((_a = pkg2.dependencies) == null ? void 0 : _a.next) || ((_b = pkg2.devDependencies) == null ? void 0 : _b.next)) {
      const candidates = ["next.config.js", "next.config.mjs", "next.config.cjs"];
      let hasExport = false;
      for (const f of candidates) {
        const p = path.join(root, f);
        if (fs.existsSync(p)) {
          const txt = await fs.promises.readFile(p, "utf8");
          if (/output\s*:\s*['"]export['"]/.test(txt)) hasExport = true;
        }
      }
      if (!hasExport) {
        vscode.window.showErrorMessage("Next.js requires static export. Add output: 'export' to next.config.js, then run next build && next export.");
        return { ok: false, pm };
      }
    }
    if (((_c = pkg2.dependencies) == null ? void 0 : _c["@sveltejs/kit"]) && !((_d = pkg2.dependencies) == null ? void 0 : _d["@sveltejs/adapter-static"]) && !((_e = pkg2.devDependencies) == null ? void 0 : _e["@sveltejs/adapter-static"])) {
      vscode.window.showErrorMessage("SvelteKit must use adapter-static with prerender: { entries: ['*'] }. See docs snippet.");
      return { ok: false, pm };
    }
  } catch {
  }
  const pkgPath = path.join(root, "package.json");
  const pkg = JSON.parse(await fs.promises.readFile(pkgPath, "utf8"));
  if (!pkg.scripts || !pkg.scripts.build) {
    vscode.window.showErrorMessage("No scripts.build in package.json. Add a build script or use \u201CStage (Manual output\u2026)\u201D.");
    return { ok: false, pm };
  }
  return { ok: true, pm };
}
async function detectPM(root) {
  if (fs.existsSync(path.join(root, "pnpm-lock.yaml"))) return "pnpm";
  if (fs.existsSync(path.join(root, "yarn.lock"))) return "yarn";
  return "npm";
}
async function runBuild(root, pm, output) {
  output.appendLine(`Running build with ${pm}\u2026`);
  const cmd = pm === "pnpm" ? "pnpm" : pm === "yarn" ? "yarn" : "npm";
  const args = pm === "npm" ? ["run", "build"] : ["build"];
  const child = (0, import_node_child_process.spawn)(cmd, args, { cwd: root, shell: process.platform === "win32" });
  child.stdout.on("data", (d) => output.append(d.toString()));
  child.stderr.on("data", (d) => output.append(d.toString()));
  const code = await new Promise((res) => child.on("close", res));
  if (code !== 0) {
    vscode.window.showErrorMessage("Build failed");
    return false;
  }
  return true;
}
async function discoverOutputDir(root, settings, output) {
  if (settings.outputDir && fs.existsSync(path.join(root, settings.outputDir))) return path.join(root, settings.outputDir);
  const candidates = ["dist", "build", ".svelte-kit/output/prerendered", "out"];
  for (const c of candidates) {
    const p = path.join(root, c);
    if (fs.existsSync(path.join(p, "index.html"))) return p;
  }
  const pick = await vscode.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, canSelectMany: false, title: "Select output folder" });
  if (!pick || pick.length === 0) {
    vscode.window.showErrorMessage("Build finished but output folder not found. Expected at dist/. Select manually?");
    return null;
  }
  const picked = pick[0];
  if (!picked) return null;
  return picked.fsPath;
}
async function scanFiles(outDir, settings, output) {
  const patterns = ["**/*.{html,js,css,json,png,jpg,jpeg,svg,gif,webp,woff2,wasm}"];
  const ignore = settings.ignore || [];
  const { globby } = await import("globby");
  const files = await globby(patterns, { cwd: outDir, absolute: true, gitignore: true, ignore });
  let total = 0;
  const maxFile = (settings.maxFileSizeMB || 5) * 1024 * 1024;
  const sizes = [];
  for (const f of files) {
    const stat = await fs.promises.stat(f);
    sizes.push({ f, s: stat.size });
    if (stat.size > maxFile) {
      const top = sizes.sort((a, b) => b.s - a.s).slice(0, 10);
      vscode.window.showErrorMessage(`${path.basename(f)} is ${(0, import_pretty_bytes.default)(stat.size)} (>5MB). Reduce or exclude. Largest files: ${top.map((t) => path.basename(t.f) + " " + (0, import_pretty_bytes.default)(t.s)).join(", ")}`);
      return { ok: false };
    }
    total += stat.size;
  }
  if (total > 20 * 1024 * 1024) {
    const top = sizes.sort((a, b) => b.s - a.s).slice(0, 10);
    vscode.window.showErrorMessage(`Total bundle ${(0, import_pretty_bytes.default)(total)} exceeds 20MB cap. Consider code-splitting, image compression.`);
    return { ok: false };
  }
  return { ok: true, files };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
