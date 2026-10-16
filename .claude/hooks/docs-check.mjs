#!/usr/bin/env node
/**
 * The mechanical half of the documentation audit (the judgment half is the
 * docs-audit skill). docs/ grows with every feature, and docs/README.md sets
 * limits nobody checks by hand: this finds what a script can.
 *
 * - size: progress.md past ~1,000 words, a topic file past ~2,500
 * - unlisted: a file in docs/ that no README.md list links to
 * - claude-md-size: a CLAUDE.md anywhere in the repository past 500
 *   characters; it only points to files, the rules are in docs/rules/
 * - broken-link: a relative Markdown link to a file that does not exist
 * - missing-path: a path in backticks that does not exist (in a topic file
 *   that can be history; verify before changing it)
 * - duplicate: a long sentence that stands in two or more files
 *
 * Usage: node .claude/hooks/docs-check.mjs [--summary]
 * --summary prints one line, and nothing at all when there are no findings;
 * that is what the SessionStart hook runs. It always exits 0.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const docsDir = path.join(root, "docs");
const PROGRESS_LIMIT = 1000;
const TOPIC_LIMIT = 2500;
const CLAUDE_MD_LIMIT = 500;
const DUPLICATE_MIN_WORDS = 14;
/** Folders the docs name without their leading `app/` (docs/rules/commands.md, "Layout"). */
const APP_FOLDERS = [
  "composables",
  "stores",
  "utils",
  "types",
  "components",
  "pages",
  "layouts",
  "assets",
];

/** All Markdown files under a directory, as paths relative to the root. */
function markdownFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return markdownFiles(full);
    return entry.name.endsWith(".md") ? [path.relative(root, full)] : [];
  });
}

/** The text without code blocks, which hold commands and listings, not statements. */
function prose(text) {
  return text.replace(/```[\s\S]*?```/g, "");
}

function wordCount(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

const docs = markdownFiles(docsDir);
const texts = new Map(
  docs.map((file) => [file, fs.readFileSync(path.join(root, file), "utf8")]),
);
const findings = [];

for (const [file, text] of texts) {
  const words = wordCount(text);
  const isProgress = file === "docs/progress.md";
  const limit = isProgress ? PROGRESS_LIMIT : TOPIC_LIMIT;
  if (words > limit)
    findings.push({
      kind: "size",
      file,
      detail: `${words} words, limit ~${limit}`,
    });
}

// Every CLAUDE.md the repository tracks or would track, so node_modules and
// the build folders are left out.
/** The repository's files by git, or none when git fails: the hook always exits 0. */
function repositoryFiles() {
  try {
    return execFileSync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard"],
      { cwd: root, encoding: "utf8" },
    ).split("\n");
  } catch {
    return [];
  }
}
const claudeFiles = repositoryFiles()
  .filter((file) => path.basename(file).toLowerCase() === "claude.md")
  .filter((file) => fs.existsSync(path.join(root, file)));
for (const file of claudeFiles) {
  const characters = [...fs.readFileSync(path.join(root, file), "utf8")].length;
  if (characters > CLAUDE_MD_LIMIT)
    findings.push({
      kind: "claude-md-size",
      file,
      detail: `${characters} characters, limit ${CLAUDE_MD_LIMIT}`,
    });
}

// A file is listed when a README.md in docs/ links to it.
const listed = new Set();
for (const [file, text] of texts) {
  if (path.basename(file) !== "README.md") continue;
  for (const [, target] of text.matchAll(/\]\(([^)#\s]+\.md)\)/g)) {
    listed.add(path.normalize(path.join(path.dirname(file), target)));
  }
}
for (const file of docs) {
  // A CLAUDE.md only points to its folder's README.md, and docs/README.md is
  // the top of the lists.
  if (path.basename(file) === "CLAUDE.md" || file === "docs/README.md")
    continue;
  if (!listed.has(file))
    findings.push({ kind: "unlisted", file, detail: "in no README.md list" });
}

for (const [file, text] of texts) {
  // An example link inside inline code is not a link.
  const linkText = prose(text).replace(/``.*?``|`[^`]*`/g, "");
  for (const [, target] of linkText.matchAll(/\]\(([^)#\s:]+)(?:#[^)]*)?\)/g)) {
    if (/^[a-z]+:/i.test(target)) continue;
    if (!fs.existsSync(path.join(root, path.dirname(file), target))) {
      findings.push({ kind: "broken-link", file, detail: target });
    }
  }
}

/** Whether a path named in backticks exists: from the root, from `docs/`
 * (how the docs show a link to another doc) or from `app/`. */
function pathExists(candidate) {
  const clean = candidate.replace(/[*{].*$/, "").replace(/\/$/, "");
  if (!clean) return true;
  if (fs.existsSync(path.join(root, clean))) return true;
  if (fs.existsSync(path.join(docsDir, clean))) return true;
  const first = clean.split("/")[0];
  return (
    APP_FOLDERS.includes(first) && fs.existsSync(path.join(root, "app", clean))
  );
}
for (const [file, text] of texts) {
  const seen = new Set();
  for (const [, token] of prose(text).matchAll(/`([^`\s<>]+)`/g)) {
    // Only things shaped like a repository path: a folder and a file with an extension.
    if (!/^[\w.-]+(\/[\w.\-[\]]+)+\.[a-z]{2,4}$/.test(token)) continue;
    if (seen.has(token) || pathExists(token)) continue;
    seen.add(token);
    findings.push({ kind: "missing-path", file, detail: token });
  }
}

/** Sentences long enough that standing twice is duplication, not a shared phrase. */
const sentenceFiles = new Map();
for (const [file, text] of texts) {
  // The CLAUDE.md pointers are alike on purpose.
  if (path.basename(file) === "CLAUDE.md") continue;
  const sentences = prose(text)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`>|#-]/g, " ")
    .split(/(?<=[.!?])\s+|\n+/);
  for (const sentence of sentences) {
    const key = sentence
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (wordCount(key) < DUPLICATE_MIN_WORDS) continue;
    if (!sentenceFiles.has(key))
      sentenceFiles.set(key, { files: new Set(), text: sentence.trim() });
    sentenceFiles.get(key).files.add(file);
  }
}
for (const { files, text } of sentenceFiles.values()) {
  // In five files or more it is a template line, such as the one every topic
  // file opens with, not a copied statement.
  if (files.size < 2 || files.size >= 5) continue;
  findings.push({
    kind: "duplicate",
    file: [...files].join(", "),
    detail: text.slice(0, 160),
  });
}

if (process.argv.includes("--summary")) {
  if (findings.length === 0) process.exit(0);
  const counts = {};
  for (const { kind } of findings) counts[kind] = (counts[kind] ?? 0) + 1;
  const list = Object.entries(counts)
    .map(([kind, n]) => `${n} ${kind}`)
    .join(", ");
  console.log(
    `Docs check: ${list}. Run /docs-audit to review them (node .claude/hooks/docs-check.mjs lists them).`,
  );
  process.exit(0);
}

if (findings.length === 0) console.log("Docs check: no findings.");
for (const kind of [
  "size",
  "claude-md-size",
  "unlisted",
  "broken-link",
  "missing-path",
  "duplicate",
]) {
  const ofKind = findings.filter((finding) => finding.kind === kind);
  if (ofKind.length === 0) continue;
  console.log(`\n## ${kind} (${ofKind.length})`);
  for (const { file, detail } of ofKind) console.log(`- ${file}: ${detail}`);
}
