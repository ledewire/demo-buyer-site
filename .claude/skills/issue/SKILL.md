---
name: issue
description: Work a GitHub issue end to end — branch it, build it test-first, review it, ship it as a PR. Invoke explicitly as /issue <number>; never fires on its own.
disable-model-invocation: true
---

# Work a GitHub issue

Invoked as `/issue <number>`. Adapted from `ledewire/api`'s `/issue`. Each issue gets its own
git worktree; there are no per-worktree containers because this app has no database or local
services — the remote Ledewire API and the session cookie are its only state.

**Every change ships against an issue.** No issue yet? Stop and file one with the user
(`gh issue create`) before writing code — with falsifiable acceptance criteria (see
§ _Writing a criterion that can fail_ below).

`bin/ship` enforces the tail of this pipeline and aborts with the fix in the message.
**If it aborts, read what it says and do that** — it knows more than this file.

## 1. Start

```bash
gh issue view <number>       # read it; base is `main` unless the body says **Base branch:**
bin/worktree issue <number>
```

Links a branch to the issue (`gh issue develop`, so GitHub shows the link), adds a worktree
for it in `../demo-buyer-site-worktrees/<branch>` from `origin/<base>`, records a non-`main`
base for `bin/ship`, copies the gitignored local files (`.env*.local`,
`.claude/settings.local.json`), and runs `npm ci`. It prints an `EnterWorktree path=...`
line — run it, passing `path=`, never `name=`.

**Never hand-create the branch** — that skips the issue link, and `bin/ship` reads the issue
number off the branch name. Act on any `!!` line it prints.

**Read source only from inside the worktree.** The launch checkout is whatever branch it was
left on and may be far behind `origin/<base>`.

Running two dev servers at once? Browsers share cookies across ports on `localhost`, so
signing in on one signs the other out — use a second browser profile, or `127.0.0.1` for one.

Already in this issue's worktree (`git branch --show-current` starts with `<number>-`)? Skip to 2.

## 2. Implement

Assume the issue is stale before you design against it: check each acceptance criterion
against the current code first — one already met, or already wrong, is worth saying before
reimplementing it. Re-read whatever your proposal rests on, not only the files the issue names.

Agree the seams with the user, then work them one at a time with `/mattpocock-skills:tdd` —
red, green, refactor, one test at a time. Follow `CONTRIBUTING.md` § _Testing conventions_
(co-located tests, mock at the `@/lib/*` boundary).

```bash
npx vitest run src/path/to/thing.test.ts   # the loop
npm run typecheck && npm run lint
```

Keep the red and green output of the tests that pin the behaviour — the PR body's
**Evidence** section needs a before and after. For a visual change, take before/after
screenshots (`npm run dev`).

Commit with `/commit` (conventional format, `Refs #<number>` footer).

## 3. Confirm the ticket is done

Re-read the acceptance criteria against the working tree, one at a time, and say for each
whether it is met — quoting what makes it true, not asserting it.

```bash
gh issue view <number>
```

This is not the check from step 2 — that ran before any code existed. Nothing else
reconciles the diff against the checklist: the reviews below look for defects, not coverage.

One not yet met is ordinary — go meet it. **One that _cannot_ pass on this issue is a stop**:
get the issue amended (or the criterion moved to the issue that owns it) before shipping.

## 4. Review

```
/mattpocock-skills:code-review
/security-review
```

**Both are mandatory, on every issue.** Name the plugin's review in full — bare
`/code-review` is a different built-in that an agent cannot invoke.

Point them at the branch diff against the base, including uncommitted and new files:

```bash
git diff origin/<base>                # note: no `...HEAD`
git status --porcelain | grep '^??'   # new files git diff won't show
```

Fix or consciously accept what they find (say which, and why), commit, then record it:

```bash
bin/ship --reviewed
```

The stamp is for the current `HEAD`. Any commit after it — a CI fix, a review fix — needs a
fresh stamp, and a fresh review if it is more than mechanical.

## 5. Ship

Write the PR body with the [`/pr`](../pr/SKILL.md) skill — **Summary** (the smallest visual
that makes the point: call tree, component tree, diff sketch), **Evidence** (before/after: the
failing then passing test, or screenshots), **Merge Danger** (one- or two-way door, blast
radius). Write it to a scratch file, not the repo. Don't add `Closes #N`; `bin/ship` does.

```bash
bin/ship --body-file <path>
```

Refuses an unreviewed `HEAD` or a stale base, runs the same checks CI runs (typecheck, lint,
format, tests with coverage, `npm audit`), pushes (tokenized URL when `GH_TOKEN` is set —
see `CLAUDE.md`), verifies the push landed, and opens a **draft** PR with `Closes #<number>`
above your body. Re-running is safe; it reuses the PR and leaves its body alone — after new
commits, revise it with `/pr` and `gh pr edit --body-file <path>`. Then wait for CI and mark it ready on green:

```bash
gh pr checks --watch && gh pr ready
```

**Never hand-run `git push` or `gh pr create` for issue work.**

## 6. Hand over, and wait for the close

Give the user the PR URL. **Do not merge** — a human does. Merging to `main` deploys to
production (Vercel) and closes the issue via `Closes #N`.

Leave the worktree (`ExitWorktree action=keep`), then from the launch checkout, **in the
background**:

```bash
bin/worktree land <number>   # polls until the PR closes, then removes the worktree
```

It refuses to run from inside the worktree or with no PR. A worktree with uncommitted changes
is left standing, with the files named: decide whether they matter, then `bin/worktree rm <number>`.
When it returns on a merge, re-check the criteria; if one turned out unmet, reopen the issue
with a comment saying which.

## Writing a criterion that can fail

- **Name the mechanism, not an artifact** — the route, component, command or observable
  state, so a wrong implementation fails it. "Purchases are handled" can't fail;
  "`POST /api/purchases` returns 402 when the wallet balance is short" can.
- **Same kind of work as the ticket** — a code change's criteria are satisfiable by reading
  the diff and running the suite. An audit or a production check is its own issue.
- **Not owned by another issue** — if another issue must change for this criterion to become
  false, it isn't this issue's. Delete it and link the dependency instead.

## Stop and ask the user

- There is no issue for the work
- The issue and its acceptance criteria disagree
- A criterion cannot pass on this issue however the work is done — step 3
- `bin/worktree` or `bin/ship` aborts and its message doesn't tell you what to do
