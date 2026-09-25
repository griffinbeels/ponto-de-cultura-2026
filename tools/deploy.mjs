// Publishes the latest commit's site files to https://cblapontodecultura.org (`npm run deploy`).
// It deploys the commit, not the working tree, so the live site always matches a commit
// and never ships unfinished edits from another session working in this folder.
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Everything the public can see. Drafts, config and the README are never uploaded.
const SITE = ["index.html", "styles.css", "app.js", "assets"];
const OUT = ".wrangler/site"; // the folder wrangler.jsonc serves

const git = (args, encoding = "utf8") => execFileSync("git", args, { encoding, maxBuffer: 64 << 20 });

rmSync(OUT, { recursive: true, force: true });
for (const file of git(["ls-tree", "-r", "--name-only", "HEAD", "--", ...SITE]).split("\n").filter(Boolean)) {
  const dest = join(OUT, file);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, git(["cat-file", "blob", `HEAD:${file}`], "buffer"));
}

const commit = git(["rev-parse", "--short", "HEAD"]).trim();
const subject = git(["log", "-1", "--format=%s"]).trim();
const uncommitted = git(["status", "--porcelain", "--", ...SITE]).trim();
if (uncommitted) console.warn(`Not included (uncommitted):\n${uncommitted}\n`);
console.log(`Deploying ${commit} "${subject}"`);

const wrangler = fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url));
execFileSync(process.execPath, [wrangler, "deploy", "--message", `${commit} ${subject}`, "--tag", commit, ...process.argv.slice(2)], { stdio: "inherit" });
