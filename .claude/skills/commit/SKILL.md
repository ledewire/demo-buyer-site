---
name: commit
description: ALWAYS use this skill when committing code changes — never commit directly without it. Creates commits in this repo's conventional-commit format with the issue reference and agent attribution. Trigger on any commit, git commit, save changes, or commit message task.
---

# Commit Messages

Adapted from `ledewire/api`'s `/commit`. See [`/issue`](../issue/SKILL.md) for where commits
fit in the issue → PR flow.

## Prerequisites

```bash
git branch --show-current
```

**On `main` or `staging`, stop — do not commit and do not create a branch yourself.** Issue
branches come from `bin/worktree issue <n>` (step 1 of `/issue`), which links them to the issue.
Ask which issue the work belongs to; if none exists, file one first.

## Format

```
<type>(<scope>): <subject>

<body>

Refs #<issue>
Co-Authored-By: <agent model identity>
```

Header required, scope optional, all lines under 100 characters. Types (from
`CONTRIBUTING.md`): `feat`, `fix`, `test`, `refactor`, `style`, `chore`, `docs`, plus `ci`,
`build`, `perf` when they fit better.

## Subject

- Imperative, present tense: "add" not "added"
- No trailing period, at most 70 characters

## Body

- Explain **what** and **why**, not how; contrast with previous behaviour when it helps
- Real newlines — never literal `\n` inside `-m` strings
- Never include customer data — buyer or store names, emails, API keys, wallet balances tied to
  an account. Describe the symptom and reference the issue instead.

## Footer

**`Refs #N` on commits; `Closes #N` belongs in the PR body**, which `bin/ship` writes. One
place closing the issue means a revert or cherry-pick can't close it by accident. Cross-repo
references are fine: `Refs #5, ledewire/api#1192`.

When an agent primarily wrote the change, add a `Co-Authored-By:` line with its own model
identity. That is the only AI marker — no "Generated with…" prose in commits. (The commit
_author_ is `ledewire-claude-code[bot]` via `.claude/settings.local.json`; that's separate.)

```bash
git commit -m "fix(wallet): show the Company balance after a top-up" \
  -m "The balance was read before the top-up settled, so it showed the old value
until a reload.

Refs #12
Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

## Principles

- One stable, independently reviewable change per commit
- The suite passes after every commit
