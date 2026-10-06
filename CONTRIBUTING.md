# Contributing

## Development workflow

Every change ships against a GitHub issue with falsifiable acceptance criteria.

1. Branch from the issue: `bin/worktree issue <n>` (an issue-linked branch in its own worktree under `../demo-buyer-site-worktrees/`), or `gh issue develop <n> --base main --checkout` to stay in your checkout
2. Build it test-first; keep commits focused, [conventionally prefixed](#commit-messages), with a `Refs #<n>` footer
3. Re-check every acceptance criterion against what you built
4. Review: `/mattpocock-skills:code-review` and `/security-review` (Claude Code), then `bin/ship --reviewed`
5. Write the PR body — **Summary** (a small visual: call tree, component tree or diff sketch), **Evidence** (before/after test run or screenshots), **Merge Danger** (one- or two-way door, blast radius); agents use the `/pr` skill
6. `bin/ship --body-file <path>` — runs the [pre-PR checklist](#pre-pr-checklist), pushes, opens a draft PR with `Closes #<n>` above your body
7. Mark ready once CI is green; a human merges. `bin/worktree land <n>` removes the worktree once the PR closes

Agents: `/issue <n>` runs this whole flow — see `.claude/skills/issue/SKILL.md`.

## Pre-PR checklist

```bash
npm run typecheck       # no type errors
npm run lint            # no lint errors
npm run format:check    # no formatting drift (or run `npm run format` to fix)
npm run test:coverage   # all tests pass
npm run audit:security  # no high/critical vulnerabilities
```

These are the exact steps CI runs, so a local green run means CI will pass.

## Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat:     new feature visible to the end user
fix:      bug fix
test:     adding or updating tests only
refactor: code change with no behaviour change
style:    formatting, whitespace (no logic change)
chore:    repo maintenance (deps, CI, tooling)
docs:     documentation only
```

## Testing conventions

- **co-locate tests** — test files live next to the file they test (e.g. `foo.test.ts` beside `foo.ts`)
- **one test file per module** — avoid splitting a module's tests across multiple files
- **mock at the boundary** — mock `@/lib/ledewire` and `@/lib/session` in route tests (pages: see _Page-level tests_ below); don't mock `@ledewire/node` internals unless testing the client adapter itself
- **`vi.mock` factory restriction** — Vitest hoists `vi.mock(...)` calls above variable declarations. Factories must not reference outer `const`/`let` variables. Configure mock return values in `beforeEach` via `vi.mocked(fn).mockResolvedValue(...)` instead
- **email inputs** — use `fireEvent.change` (not `userEvent.type`) for `type="email"` inputs; jsdom 28 sanitizes email values on each keystroke which breaks `userEvent.type`
- **`as never` casts on mock return values** — route handler tests use `vi.mocked(createBuyerClient).mockResolvedValue({...} as never)` to avoid needing full `@ledewire/node` client type shapes in tests

### Page-level tests

An async Server Component page is a function that returns JSX, so a test awaits it and renders the
result. `src/app/(buyer)/company/members/page.test.tsx` is the reference.

```tsx
vi.mock('next/navigation', () => ({
  redirect: vi.fn(() => {
    throw new Error('NEXT_REDIRECT') // like Next, stop the page where it redirects
  }),
  useRouter: vi.fn(() => ({ refresh: vi.fn(), push: vi.fn() })), // only if a client child calls it
}))
vi.mock('@/lib/auth', () => ({ requireAuth: vi.fn() }))
vi.mock('@/lib/company', () => ({ getCompanyMembership: vi.fn() }))
vi.mock('@/lib/ledewire', () => import('@/__mocks__/ledewire-client'))

render(await CompanyMembersPage()) // then assert with screen, as for any component
await expect(CompanyMembersPage()).rejects.toThrow('NEXT_REDIRECT') // a redirect
```

- **mock every server-only boundary** — `@/lib/auth`, `@/lib/company`, `@/lib/ledewire` and
  `next/navigation`; the page's client children render for real
- **one test per access state** — no Company, non-admin, admin, `AuthError` → redirect,
  `LedewireError` → inline message
- **pages that take params** — pass them as the page receives them:
  `await Page({ params: Promise.resolve({ id: 'mem-1' }), searchParams: Promise.resolve({}) })`

## Adding a new route handler

1. Create `src/app/api/<resource>/route.ts`
2. Guard authenticated routes with `requireAuthForRoute()` at the top
3. Use `createBuyerClient()` to get an authenticated client
4. Follow the error-handling pattern from existing routes: `AuthError → 401`, `LedewireError → err.statusCode`, unknown → `500`
5. Add a co-located `route.test.ts` covering: unauthenticated (401), missing fields (400), success (2xx), each error class, and unexpected error (500)

## Adding a new buyer page

1. Create `src/app/(buyer)/<page>/page.tsx`
2. Call `await requireAuth()` at the top — this handles token expiry
3. Wrap API calls in try/catch; redirect on `AuthError`, render an error message on `LedewireError`, rethrow unknown errors

## Environment variables

All env vars are validated at startup in `src/lib/config.ts`. Add new variables there rather than reading from `process.env` directly in application code.
