// @vitest-environment node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { sandbox, type Sandbox } from './sandbox'

let sb: Sandbox
let worktreeDir: string

beforeEach(() => {
  sb = sandbox()
  sb.stub('issue_state', 'OPEN')
  sb.stub('issue_body', 'Do the thing.\n')
  worktreeDir = path.join(sb.root, 'demo-worktrees', '8-the-issue')
})

afterEach(() => sb.cleanup())

const developCalls = () => sb.calls().filter((c) => /^gh issue develop \d/.test(c))
const npmCiCalls = () => sb.calls().filter((c) => c.startsWith('npm ci'))

function createWorktree() {
  const r = sb.run('worktree', ['issue', '8'])
  expect(r.status, r.out).toBe(0)
  return r
}

describe('bin/worktree issue', () => {
  it('links a branch to the issue and adds a worktree for it from origin/main', () => {
    const r = createWorktree()

    expect(developCalls()).toEqual(['gh issue develop 8 --base main'])
    expect(sb.git(['branch', '--show-current'], worktreeDir)).toBe('8-the-issue')
    expect(sb.git(['rev-parse', 'HEAD'], worktreeDir)).toBe(sb.originSha('main'))
    expect(r.out).toContain(`EnterWorktree path=${worktreeDir}`)
  })

  it('copies the local-only files that exist, and runs npm ci in the worktree', () => {
    writeFileSync(path.join(sb.repo, '.env.development.local'), 'SESSION_SECRET=x\n')
    writeFileSync(path.join(sb.repo, '.env.test.local'), 'TEST=1\n')
    mkdirSync(path.join(sb.repo, '.claude'))
    writeFileSync(path.join(sb.repo, '.claude/settings.local.json'), '{"env":{}}\n')

    createWorktree()

    expect(readFileSync(path.join(worktreeDir, '.env.development.local'), 'utf8')).toBe(
      'SESSION_SECRET=x\n',
    )
    expect(existsSync(path.join(worktreeDir, '.env.test.local'))).toBe(true)
    expect(existsSync(path.join(worktreeDir, '.claude/settings.local.json'))).toBe(true)
    expect(existsSync(path.join(worktreeDir, '.env.local'))).toBe(false)
    expect(npmCiCalls()).toHaveLength(1)
    expect(sb.read('npm_cwd').trim()).toBe(worktreeDir)
  })

  it('prints the same path on a re-run without creating anything', () => {
    createWorktree()

    const r = createWorktree()

    expect(r.out).toContain(`EnterWorktree path=${worktreeDir}`)
    expect(developCalls()).toHaveLength(1)
    expect(npmCiCalls()).toHaveLength(1)
  })

  it('uses a branch already linked to the issue instead of linking another', () => {
    sb.git(['push', '--quiet', 'origin', 'main:refs/heads/8-the-issue'])
    sb.stub('linked_branch', '8-the-issue')

    const r = createWorktree()

    expect(developCalls()).toEqual([])
    expect(r.out).toContain('already linked')
    expect(sb.git(['branch', '--show-current'], worktreeDir)).toBe('8-the-issue')
  })

  it('refuses a closed issue', () => {
    sb.stub('issue_state', 'CLOSED')

    const r = sb.run('worktree', ['issue', '8'])

    expect(r.status).not.toBe(0)
    expect(r.out).toContain('CLOSED')
    expect(developCalls()).toEqual([])
  })

  it.each(['--upload-pack=touch', 'main;id', '../escape'])(
    'refuses a Base branch of %j from the issue body',
    (base) => {
      sb.stub('issue_body', `**Base branch:** ${base}\n`)

      const r = sb.run('worktree', ['issue', '8'])

      expect(r.status).not.toBe(0)
      expect(r.out).toContain('not a usable branch name')
      expect(developCalls()).toEqual([])
    },
  )

  it("branches from the issue's Base branch and records it for bin/ship", () => {
    sb.git(['push', '--quiet', 'origin', 'main:refs/heads/feature/batch'])
    sb.stub('issue_body', '**Base branch:** `feature/batch`\n\nDo the thing.\n')

    createWorktree()

    expect(developCalls()).toEqual(['gh issue develop 8 --base feature/batch'])
    expect(sb.git(['config', 'branch.8-the-issue.shipBase'], worktreeDir)).toBe('feature/batch')
  })
})

describe('bin/worktree --help', () => {
  it('prints the usage and none of the script', () => {
    const r = sb.run('worktree', ['--help'])

    expect(r.status).toBe(0)
    expect(r.out).toContain('bin/worktree land <n>')
    expect(r.out).not.toContain('set -euo')
  })
})

describe('bin/worktree rm', () => {
  it('refuses from inside the worktree', () => {
    createWorktree()

    const r = sb.run('worktree', ['rm', '8'], { cwd: worktreeDir })

    expect(r.status).not.toBe(0)
    expect(r.out).toContain('inside')
    expect(existsSync(worktreeDir)).toBe(true)
  })

  it('refuses a worktree with uncommitted changes', () => {
    createWorktree()
    writeFileSync(path.join(worktreeDir, 'wip.ts'), 'export {}\n')

    const r = sb.run('worktree', ['rm', '8'])

    expect(r.status).not.toBe(0)
    expect(r.out).toContain('wip.ts')
    expect(existsSync(worktreeDir)).toBe(true)
  })

  it('removes the worktree and deletes the local branch when its PR is merged', () => {
    createWorktree()
    sb.stub('pr_state', 'MERGED')

    const r = sb.run('worktree', ['rm', '8'])

    expect(r.status, r.out).toBe(0)
    expect(existsSync(worktreeDir)).toBe(false)
    expect(sb.git(['branch', '--list', '8-the-issue'])).toBe('')
  })

  it('keeps the local branch when its PR is still open', () => {
    createWorktree()
    sb.stub('pr_state', 'OPEN')

    const r = sb.run('worktree', ['rm', '8'])

    expect(r.status, r.out).toBe(0)
    expect(existsSync(worktreeDir)).toBe(false)
    expect(sb.git(['branch', '--list', '8-the-issue'])).toContain('8-the-issue')
  })
})

describe('bin/worktree land', () => {
  it('refuses when the branch has no PR', () => {
    createWorktree()

    const r = sb.run('worktree', ['land', '8'])

    expect(r.status).not.toBe(0)
    expect(r.out).toContain('no PR')
    expect(existsSync(worktreeDir)).toBe(true)
  })

  it('refuses from inside the worktree before it starts waiting', () => {
    createWorktree()
    // Still open: without the up-front refusal, land would poll until this closed.
    sb.stub('pr_state', 'OPEN')

    const r = sb.run('worktree', ['land', '8'], { cwd: worktreeDir })

    expect(r.status).not.toBe(0)
    expect(r.out).toContain('not from inside the worktree')
    expect(existsSync(worktreeDir)).toBe(true)
  }, 30_000)

  it('keeps waiting through a failed gh call', () => {
    createWorktree()
    sb.stub('pr_state', 'MERGED')
    // Call 1 is the up-front "has a PR" check; call 2 is the first poll.
    sb.stub('pr_list_fail_on', '2')

    const r = sb.run('worktree', ['land', '8'])

    expect(r.status, r.out).toBe(0)
    expect(existsSync(worktreeDir)).toBe(false)
  })

  it('removes the worktree once the PR has closed', () => {
    createWorktree()
    sb.stub('pr_state', 'CLOSED')

    const r = sb.run('worktree', ['land', '8'])

    expect(r.status, r.out).toBe(0)
    expect(r.out).toContain('is CLOSED')
    expect(existsSync(worktreeDir)).toBe(false)
    expect(sb.git(['branch', '--list', '8-the-issue'])).toBe('')
  })
})
