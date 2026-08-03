#!/usr/bin/env node
/* Regenerates docs/USER-GUIDE.md from src/lib/userGuide.ts (the single
   source of truth, also rendered live at /guide). Run after editing the
   guide:  node scripts/build-user-guide.js  */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const root = path.join(__dirname, "..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lmc-guide-"));
execSync(
  `npx tsc ${path.join(root, "src/lib/userGuide.ts")} --outDir ${tmp} --module commonjs --target es2020 --skipLibCheck`,
  { stdio: "inherit" },
);
const { GUIDE_TITLE, GUIDE_INTRO, GUIDE_SECTIONS } = require(path.join(tmp, "userGuide.js"));

const lines = [
  `# ${GUIDE_TITLE}`,
  "",
  "<!-- GENERATED from src/lib/userGuide.ts (rendered live at lettermycomic.com/guide).",
  "     Edit that file, then run: node scripts/build-user-guide.js -->",
  "",
  GUIDE_INTRO,
  "",
];
for (const s of GUIDE_SECTIONS) {
  lines.push(`## ${s.title}`, "");
  for (const b of s.blocks) {
    if (b.h) lines.push(`### ${b.h}`, "");
    if (b.p) lines.push(b.p, "");
    if (b.ul) { for (const it of b.ul) lines.push(`- ${it}`); lines.push(""); }
  }
}
fs.writeFileSync(path.join(root, "docs/USER-GUIDE.md"), lines.join("\n"));
fs.rmSync(tmp, { recursive: true, force: true });
console.log("docs/USER-GUIDE.md regenerated.");
