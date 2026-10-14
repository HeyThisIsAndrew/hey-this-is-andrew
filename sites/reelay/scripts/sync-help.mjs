/**
 * sync-help.mjs: the website's Help Center comes from the app's.
 *
 *   node scripts/sync-help.mjs <path to the Reelay app checkout>
 *
 * The app keeps its Help Center as data (reelay/gui/help_content.py: the
 * Get Started tour, six topics, their guides) with real screenshots
 * (reelay/gui/help_shots/<shot>-<theme>.webp) and the measured position of
 * every control a step points at (help_shots/marks.json). This reads all of
 * it and writes:
 *   - src/data/help.json: the tour, the topics and guides, the crop of each
 *     picture and the markers inside it, and the two drawn pictures' rows;
 *   - public/help/<shot>-<theme>.webp: the screenshots the guides use;
 *   - one optional screencast slot per tour step and guide in
 *     src/data/screens.json (help-tour-<key>, help-<key>), so SCREENS.md is
 *     the list of help videos still to record. A help video shows on
 *     /support once its file exists; until then the guide has no stand-in.
 * /support renders from those, so the website says exactly what the app
 * says. Never edit help.json by hand: change the app, then run this.
 *
 * help_content.py is plain dataclasses, so it's loaded straight from its
 * file (no Qt needed). The storage diagram's rows live in help_page.py, which
 * does import Qt, so they're read from its source with Python's ast module.
 */
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { manifest, manifestPath } from './screens-manifest.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = path.resolve(process.argv[2] || '');
const gui = path.join(app, 'reelay/gui');
if (!process.argv[2] || !fs.existsSync(path.join(gui, 'help_content.py'))) {
  console.error('usage: node scripts/sync-help.mjs <path to the Reelay app checkout>');
  process.exit(1);
}

const PY = String.raw`
import ast, dataclasses, importlib.util, json, sys
gui = sys.argv[1]
spec = importlib.util.spec_from_file_location("help_content", gui + "/help_content.py")
H = importlib.util.module_from_spec(spec); sys.modules["help_content"] = H; spec.loader.exec_module(H)
marks = json.load(open(gui + "/help_shots/marks.json", encoding="utf-8"))

def visual(v):
    if v is None:
        return None
    if v.shot in H.DRAWN:
        return {"drawn": v.shot, "alt": v.alt}
    cx, cy, cw, ch = H.crop_of(v)
    inside = {k: r for k, r in marks.get(v.shot, {}).get("marks", {}).items()
              if r[0] < cx + cw and r[0] + r[2] > cx and r[1] < cy + ch and r[1] + r[3] > cy}
    return {"shot": v.shot, "alt": v.alt, "crop": [cx, cy, cw, ch], "marks": inside}

def steps(ss):
    return [{"text": s.text, "mark": s.mark} for s in ss]

tour = [{"key": t.key, "title": t.title, "short": t.short, "goal": t.goal, "visual": visual(t.visual),
         "steps": steps(t.steps), "next": t.next, "note": t.note} for t in H.TOUR]
cats = [{"key": c.key, "title": c.title, "blurb": c.blurb, "guides": [
    {"key": g.key, "title": g.title, "doing": g.doing, "visual": visual(g.visual), "steps": steps(g.steps),
     "expect": g.expect, "details": [{"title": d.title, "lines": list(d.lines)} for d in g.details],
     "related": list(g.related), "keywords": g.keywords, "note": g.note} for g in c.guides]} for c in H.CATEGORIES]

# The storage diagram: its PLACES rows and its fixed labels, from help_page.py's source.
src = ast.parse(open(gui + "/help_page.py", encoding="utf-8").read())
storage = {"places": [], "labels": []}
for node in ast.walk(src):
    if isinstance(node, ast.ClassDef) and node.name == "StorageDiagram":
        for item in ast.walk(node):
            if isinstance(item, ast.Assign) and any(getattr(t, "id", "") == "PLACES" for t in item.targets):
                storage["places"] = [list(p) for p in ast.literal_eval(item.value)]
            if (isinstance(item, ast.Call) and getattr(item.func, "id", "") == "_label" and item.args
                    and isinstance(item.args[0], ast.Constant) and isinstance(item.args[0].value, str)):
                storage["labels"].append(item.args[0].value)

json.dump({"tour": tour, "categories": cats, "posting": [list(p) for p in H.POSTING], "storage": storage,
           "shots": sorted({v["shot"] for v in [t["visual"] for t in tour] + [g["visual"] for c in cats for g in c["guides"]]
                            if v and "shot" in v})}, sys.stdout, ensure_ascii=False)
`;

const py = spawnSync(process.env.PYTHON || 'python3', ['-c', PY, gui], { encoding: 'utf8' });
if (py.status !== 0) { console.error(py.stderr || py.error); process.exit(1); }
const data = JSON.parse(py.stdout);

const outDir = path.join(root, 'public/help');
fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) if (f.endsWith('.webp')) fs.rmSync(path.join(outDir, f));
const files = {};
for (const shot of data.shots) for (const theme of ['light', 'dark']) {
  const name = `${shot}-${theme}.webp`;
  const from = path.join(gui, 'help_shots', name);
  if (!fs.existsSync(from)) { console.error(`missing in the app: help_shots/${name}`); process.exit(1); }
  fs.copyFileSync(from, path.join(outDir, name));
  files[name] = crypto.createHash('sha256').update(fs.readFileSync(from)).digest('hex');
}

const commit = spawnSync('git', ['-C', app, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
const out = {
  _readme: 'Generated by scripts/sync-help.mjs from the Reelay app (reelay/gui/help_content.py, help_shots/). Do not edit: change the app, then run the script.',
  source: { commit: commit || 'unknown', files },
  shotSize: [1760, 1100],
  ...data,
};
fs.writeFileSync(path.join(root, 'src/data/help.json'), JSON.stringify(out, null, 2) + '\n');
// The help screencast slots: replaced wholesale, every other slot kept as it is.
const screensPath = path.join(root, 'src/data/screens.json');
const screens = JSON.parse(fs.readFileSync(screensPath, 'utf8'));
const slot = (id, title) => ({ id, kind: 'video', title: `Help video: ${title}`, page: '/support', width: 2880, height: 1800, themes: ['light'], optional: true });
screens.slots = [
  ...screens.slots.filter((s) => !s.id.startsWith('help-')),
  ...data.tour.map((t) => slot(`help-tour-${t.key}`, `Get Started, ${t.title}`)),
  ...data.categories.flatMap((c) => c.guides.map((g) => slot(`help-${g.key}`, g.title))),
];
fs.writeFileSync(screensPath, JSON.stringify(screens, null, 2) + '\n');
fs.writeFileSync(manifestPath, manifest());

const guides = data.categories.reduce((n, c) => n + c.guides.length, 0);
console.log(`help.json: ${data.tour.length} tour steps, ${data.categories.length} topics, ${guides} guides, from app ${out.source.commit}`);
console.log(`public/help: ${Object.keys(files).length} screenshots (${Math.round(Object.keys(files).reduce((s, f) => s + fs.statSync(path.join(outDir, f)).size, 0) / 1024)} KB)`);
