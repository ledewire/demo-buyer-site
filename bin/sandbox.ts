// Test harness for the bash scripts in bin/: a throwaway clone with a local bare
// `origin`, real git, and stub `gh`/`npm` on PATH that answer from files and log
// every call. Tests observe what a script printed, its exit code, what reached
// `origin`, and which gh/npm calls it made — never its internals.
import { execFileSync, spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const BIN = path.dirname(new URL(import.meta.url).pathname)

// Mirrors what the real gh prints: an empty line for a null --jq result, nothing
// for an issue with no linked branch, and `<branch>\t<url>` for one that has one.
const GH_STUB = `#!/usr/bin/env bash
S="$STUB_STATE"
printf 'gh %s\\n' "$*" >> "$S/calls.log"
get() { cat "$S/$1" 2>/dev/null || true; }
flag() { local want="$1"; shift; while [ $# -gt 0 ]; do [ "$1" = "$want" ] && { echo "$2"; return; }; shift; done; }
case "$1 $2" in
  "repo view") echo acme/demo ;;
  "pr list")
    n=$(( $(get pr_list_calls || true) + 0 + 1 )); echo "$n" > "$S/pr_list_calls"
    [ "$n" = "$(get pr_list_fail_on)" ] && { echo "gh stub: connection reset" >&2; exit 1; }
    pr="$(get pr_state)"; want="$(flag --state "$@")"
    if [ -z "$pr" ] || { [ "$want" = open ] && [ "$pr" != OPEN ]; }; then echo; exit 0; fi
    case "$(flag --json "$@")" in
      url) echo https://github.com/acme/demo/pull/1 ;;
      state) echo "$pr" ;;
      number) echo 1 ;;
    esac ;;
  "pr create")
    printf '%s' "$(flag --body "$@")" > "$S/pr_body"
    echo OPEN > "$S/pr_state"
    echo https://github.com/acme/demo/pull/1 ;;
  "issue view")
    case "$(flag --json "$@")" in
      state) get issue_state ;;
      body) get issue_body ;;
    esac ;;
  "issue develop")
    if [ "$3" = "--list" ]; then
      b="$(get linked_branch)"; [ -z "$b" ] || printf '%s\\thttps://github.com/acme/demo/tree/%s\\n' "$b" "$b"
    else
      b="$3-the-issue"
      git -C "$STUB_ORIGIN" branch "$b" "$(flag --base "$@")"
      echo "$b" > "$S/linked_branch"
      echo "github.com/acme/demo/tree/$b"
    fi ;;
  *) echo "gh stub: unhandled: $*" >&2; exit 1 ;;
esac
`

const NPM_STUB = `#!/usr/bin/env bash
printf 'npm %s\\n' "$*" >> "$STUB_STATE/calls.log"
printf '%s\\n' "$PWD" >> "$STUB_STATE/npm_cwd"
script="$2"; [ "$1" = "run" ] && [ "$2" = "--silent" ] && script="$3"
grep -qx "$script" "$STUB_STATE/npm_fail" 2>/dev/null && { echo "npm stub: $script failed" >&2; exit 1; }
exit 0
`

export type Run = { status: number; out: string }

/** Files the stubs answer from (see GH_STUB / NPM_STUB). */
export type StubAnswer =
  | 'issue_state'
  | 'issue_body'
  | 'linked_branch'
  | 'pr_state'
  /** a 1-based `gh pr list` call number that fails, as a network blip would */
  | 'pr_list_fail_on'
  /** npm scripts that fail, one per line */
  | 'npm_fail'

export type Sandbox = {
  /** the primary checkout */
  repo: string
  root: string
  /** a PR body file, as the /pr skill would write it */
  body: string
  origin: string
  git: (args: string[], cwd?: string) => string
  /** run bin/<script> from the primary checkout unless cwd says otherwise */
  run: (
    script: 'ship' | 'worktree',
    args?: string[],
    opts?: { cwd?: string; env?: Record<string, string> },
  ) => Run
  stub: (name: StubAnswer, value: string) => void
  read: (name: string) => string
  calls: () => string[]
  commit: (message: string, cwd?: string) => void
  /** the SHA of a branch on origin, or '' when it is absent */
  originSha: (branch: string) => string
  cleanup: () => void
}

export function sandbox(): Sandbox {
  const root = mkdtempSync(path.join(tmpdir(), 'bin-sandbox-'))
  const origin = path.join(root, 'origin.git')
  const repo = path.join(root, 'demo')
  const stubs = path.join(root, 'stubs')
  const state = path.join(root, 'state')
  mkdirSync(stubs)
  mkdirSync(state)
  writeFileSync(path.join(stubs, 'gh'), GH_STUB, { mode: 0o755 })
  writeFileSync(path.join(stubs, 'npm'), NPM_STUB, { mode: 0o755 })
  const body = path.join(root, 'body.md')
  writeFileSync(body, '## Summary\n\nThe change.\n')

  const gitEnv = {
    GIT_AUTHOR_NAME: 'Test',
    GIT_AUTHOR_EMAIL: 'test@example.com',
    GIT_COMMITTER_NAME: 'Test',
    GIT_COMMITTER_EMAIL: 'test@example.com',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
  }
  const env = {
    ...process.env,
    ...gitEnv,
    PATH: `${stubs}:${process.env.PATH}`,
    STUB_STATE: state,
    STUB_ORIGIN: origin,
    GH_TOKEN: '',
  }
  const git = (args: string[], cwd = repo) =>
    execFileSync('git', args, { cwd, env, encoding: 'utf8' }).trim()

  execFileSync('git', ['init', '--quiet', '--bare', '--initial-branch=main', origin], { env })
  execFileSync('git', ['init', '--quiet', '--initial-branch=main', repo], { env })
  mkdirSync(path.join(repo, 'bin'))
  for (const script of ['ship', 'worktree']) {
    copyFileSync(path.join(BIN, script), path.join(repo, 'bin', script))
  }
  writeFileSync(path.join(repo, '.nvmrc'), `${process.versions.node.split('.')[0]}\n`)
  copyFileSync(path.join(BIN, '..', '.gitignore'), path.join(repo, '.gitignore'))
  git(['add', '.'])
  git(['commit', '--quiet', '-m', 'initial'])
  git(['remote', 'add', 'origin', origin])
  git(['push', '--quiet', 'origin', 'main'])

  const sb: Sandbox = {
    repo,
    root,
    body,
    origin,
    git,
    run(script, args = [], opts = {}) {
      const r = spawnSync(path.join(repo, 'bin', script), args, {
        cwd: opts.cwd ?? repo,
        env: { ...env, WORKTREE_LAND_POLL_SECONDS: '0', ...opts.env },
        encoding: 'utf8',
        // A script that never returns (land polling forever) fails the test instead of hanging it.
        timeout: 20_000,
        killSignal: 'SIGKILL',
      })
      return { status: r.status ?? -1, out: `${r.stdout}${r.stderr}` }
    },
    stub: (name, value) => writeFileSync(path.join(state, name), value),
    read: (name) => readFileSync(path.join(state, name), 'utf8'),
    calls() {
      try {
        return readFileSync(path.join(state, 'calls.log'), 'utf8').trim().split('\n')
      } catch {
        return []
      }
    },
    commit(message, cwd = repo) {
      git(['commit', '--quiet', '--allow-empty', '-m', message], cwd)
    },
    originSha(branch) {
      return git(
        ['--git-dir', origin, 'for-each-ref', '--format=%(objectname)', `refs/heads/${branch}`],
        root,
      )
    },
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  }
  return sb
}
