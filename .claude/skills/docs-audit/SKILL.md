---
name: docs-audit
description: Audits docs/ for duplicated, obsolete, outdated and bloated content, following docs/README.md, and proposes cuts, moves and splits for approval. Use when the session-start docs check reports findings, when docs/ feels bloated, or on a schedule (/loop or /schedule with /docs-audit).
---

# Docs audit

`docs/` grows with every feature. This audit finds what no longer earns its place and proposes how to shrink it. The rules it enforces are in `docs/README.md`; read that file first, every time, and `docs/rules/` for what the code rules already say.

## 1. The mechanical check

```bash
node .claude/hooks/docs-check.mjs
```

It reports: files over their size (`progress.md` ~1,000 words, a topic file ~2,500), files no `README.md` list links to, any `CLAUDE.md` over 500 characters, broken links, paths in backticks that do not exist, and sentences that stand word for word in two to four files. The SessionStart hook runs it with `--summary` and says nothing while there are no findings.

## 2. The judgment the script can't make

Read the files the check named, then go through `docs/` for these, and keep the evidence for each finding (file and line, and what contradicts it):

- **Outdated in the present.** `progress.md`, every `README.md` list, the rule files in `rules/` and the opening lines of the topic files describe the present. Check their claims against the repository: release state against `git tag` and `CHANGELOG.md`, "not built" or "not released" against `git log`, counts against the tests, paths against the tree.
- **Obsolete history.** A topic file is history and is not rewritten. A statement there that a later change overtook needs a dated remark that names where the newer state is, if it has none. A missing path from the check in a topic file is usually such a case, not an error.
- **Duplication.** The same fact written in two places, in other words too: in a topic file and a file of `rules/` (a rule belongs in `rules/` once, its history in the topic file), in `progress.md` and a topic file (the detail belongs in the topic file), or in two topic files (it belongs where its cause is, and the other refers to it).
- **Bloat.** Passages that tell what the code or the git history already tell: file-by-file listings, code restated in prose, step logs with no decision or finding in them. And files past their size, which are split along their sections.

## 3. The proposal

Present the findings as a table: file, finding, evidence, proposed action (delete, shorten, move to `<file>`, add a dated remark, split into `<files>`), and the words it saves. Put the largest savings first. Then **stop and wait for the user's approval**; change nothing before it.

## 4. Carrying it out, once approved

- Before deleting a sentence, search `docs/` for its facts. One written nowhere else moves to the file it concerns as a dated section or remark, not into the void.
- A split or rename updates the lists in `docs/README.md` (and the `README.md` of a feature's folder) and every reference to the old place, in the same change.
- Run `npx prettier --write` on the changed files, `npm run lint:md`, and the check again; report the word counts before and after.
- Commit only when asked, as `docs(<scope>): …`.
