# Contributing

## Development workflow

1. Create a feature branch off `main`
2. Make your changes; keep commits focused and [conventionally prefixed](#commit-messages)
3. Ensure all checks pass locally before opening a PR (see [Pre-PR checklist](#pre-pr-checklist))
4. Open a PR against `main` — CI must be green before merging

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
- **mock at the boundary** — mock `@/lib/ledewire` and `@/lib/session` in route and page tests; don't mock `@ledewire/node` internals unless testing the client adapter itself
- **`vi.mock` factory restriction** — Vitest hoists `vi.mock(...)` calls above variable declarations. Factories must not reference outer `const`/`let` variables. Configure mock return values in `beforeEach` via `vi.mocked(fn).mockResolvedValue(...)` instead
- **email inputs** — use `fireEvent.change` (not `userEvent.type`) for `type="email"` inputs; jsdom 28 sanitizes email values on each keystroke which breaks `userEvent.type`
- **`as never` casts on mock return values** — route handler tests use `vi.mocked(createBuyerClient).mockResolvedValue({...} as never)` to avoid needing full `@ledewire/node` client type shapes in tests

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
