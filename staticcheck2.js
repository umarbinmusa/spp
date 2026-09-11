const fs = require("fs");
const path = require("path");
const root = process.cwd();
const files = [
  "server.js",
  "Models/userPricingModel.js",
  "Services/userPricingService.js",
  "Controllers/purchaseControllers.js",
  "Controllers/Admin/userPricingController.js",
  "Routes/adminUserPricingRouter.js",
];
const builtins = new Set(require("module").builtinModules);
const npmDeps = new Set(Object.keys(JSON.parse(fs.readFileSync("package.json")).dependencies || {}));
let problems = [];
const requireRe = /(?:const|let|var)\s+(\{[^}]*\}|[A-Za-z_$][\w$]*)\s*=\s*require\(["']([^"']+)["']\)/g;
function getExportedNames(filePath) {
  const src = fs.readFileSync(filePath, "utf8");
  const names = new Set();
  let m = src.match(/module\.exports\s*=\s*\{([^}]*)\}/s);
  if (m) m[1].split(",").forEach((part) => { const key = part.split(":")[0].trim(); if (key) names.add(key); });
  const re2 = /module\.exports\.([A-Za-z_$][\w$]*)\s*=/g; let mm;
  while ((mm = re2.exec(src))) names.add(mm[1]);
  return { names, isObjectExport: !!m };
}
for (const rel of files) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) { problems.push(`MISSING FILE: ${rel}`); continue; }
  const src = fs.readFileSync(abs, "utf8");
  let match; requireRe.lastIndex = 0;
  while ((match = requireRe.exec(src))) {
    const [, importClause, modPath] = match;
    if (builtins.has(modPath) || npmDeps.has(modPath)) continue;
    if (!modPath.startsWith(".")) { problems.push(`${rel}: unknown external dep "${modPath}"`); continue; }
    const resolvedBase = path.join(path.dirname(abs), modPath);
    let resolved = null;
    for (const cand of [resolvedBase, resolvedBase + ".js"]) if (fs.existsSync(cand) && fs.statSync(cand).isFile()) { resolved = cand; break; }
    if (!resolved) { problems.push(`${rel}: cannot resolve require("${modPath}") -> ${resolvedBase}`); continue; }
    if (importClause.startsWith("{")) {
      const wanted = importClause.replace(/[{}]/g, "").split(",").map((s) => s.split(":")[0].trim()).filter(Boolean);
      const { names, isObjectExport } = getExportedNames(resolved);
      if (isObjectExport) for (const w of wanted) if (!names.has(w)) problems.push(`${rel}: imports "{ ${w} }" from ${modPath} but that file does not export "${w}"`);
    }
  }
}
if (problems.length) { console.log("PROBLEMS:"); problems.forEach((p) => console.log(" -", p)); process.exit(1); }
else console.log("All require() paths resolve and destructured imports match exports.");
