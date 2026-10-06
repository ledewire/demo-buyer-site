## Every change ships against an issue

Work issues with **`/issue <number>`** (`.claude/skills/issue/SKILL.md`). It drives the whole flow:
`bin/worktree issue <n>` (issue-linked branch in its own worktree) → `/mattpocock-skills:tdd` → `/commit` → re-check acceptance criteria →
`/mattpocock-skills:code-review` **and** `/security-review` → `bin/ship --reviewed` →
PR body via `/pr` → `bin/ship --body-file <path>` → `bin/worktree land <n>` in the background.

- No issue for the work? Stop and file one (`gh issue create`) with falsifiable acceptance criteria
  before writing code.
- Never commit on `main`/`staging`, and never hand-create an issue branch — `bin/worktree issue`
  links it to the issue, and `bin/ship` reads the issue number from the branch name.
- Node 22 everywhere (`.nvmrc`): CI, the devcontainer, Vercel (`engines`), and `bin/ship`, which
  refuses another major version.
- Never hand-run `git push` or `gh pr create` for issue work; `bin/ship` refuses an unreviewed
  `HEAD`, runs the CI checks, pushes, and opens a draft PR with `Closes #N`.
- Do not merge PRs — a human does. Merging to `main` deploys to production.

## Committing as the Ledewire bot identity

If `GH_TOKEN` is set in the environment (this session was launched via `ledewire-claude`), you
are authenticated as `ledewire-claude-code[bot]`, not a human. For issue work, `bin/ship`
already pushes this way. For any other push, use the tokenized HTTPS URL instead of
`git push origin`:

```
git push https://x-access-token:$GH_TOKEN@github.com/ledewire/demo-buyer-site.git HEAD:<branch-name>
```

`gh pr create` and other `gh`/API calls pick up `GH_TOKEN` automatically — no change needed there.

If `GH_TOKEN` is not set, push normally via `origin` (SSH) as usual.
