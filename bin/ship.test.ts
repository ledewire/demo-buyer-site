// @vitest-environment node
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { sandbox, type Sandbox } from './sandbox'

const BRANCH = '8-the-issue'
const CHECKS = ['typecheck', 'lint', 'format:check', 'test:coverage', 'audit:security']

let sb: Sandbox

beforeEach(() => {
  sb = sandbox()
})

afterEach(() => sb.cleanup())

function onIssueBranch() {
  sb.git(['checkout', '--quiet', '-b', BRANCH])
  sb.commit('feat: the change')
}

function reviewed() {
  expect(sb.run('ship', ['--reviewed']).status).toBe(0)
}

const npmRuns = () =>
  sb
    .calls()
    .filter((c) => c.startsWith('npm run'))
    .map((c) => c.split(' ').at(-1))

const prCreates = () => sb.calls().filter((c) => c.startsWith('gh pr create'))

describe('bin/ship', () => {
  it('refuses a branch whose name does not start with an issue number, and pushes nothing', () => {
    sb.git(['checkout', '--quiet', '-b', 'feat/no-issue'])
    sb.commit('feat: something')

    const r = sb.run('ship', ['--body-file', sb.body])

    expect(r.status).not.toBe(0)
    expect(r.out).toContain('does not start with an issue number')
    expect(sb.originSha('feat/no-issue')).toBe('')
  })

  it('refuses to ship from main', () => {
    sb.commit('feat: straight onto main')

    const r = sb.run('ship', ['--body-file', sb.body])

    expect(r.status).not.toBe(0)
    expect(r.out).toContain('on main')
    expect(npmRuns()).toEqual([])
  })

  it('refuses an unreviewed HEAD, naming both reviews, and pushes nothing', () => {
    onIssueBranch()

    const r = sb.run('ship', ['--body-file', sb.body])

    expect(r.status).not.toBe(0)
    expect(r.out).toContain('/mattpocock-skills:code-review')
    expect(r.out).toContain('/security-review')
    expect(sb.originSha(BRANCH)).toBe('')
  })

  it('needs a fresh review stamp after a new commit', () => {
    onIssueBranch()
    reviewed()
    sb.commit('fix: after review')

    const r = sb.run('ship', ['--body-file', sb.body])

    expect(r.status).not.toBe(0)
    expect(r.out).toContain('has not been reviewed')
    expect(r.out).toContain('fix: after review')
  })

  it('--reviewed refuses to stamp while tracked files have uncommitted changes', () => {
    onIssueBranch()
    writeFileSync(path.join(sb.repo, '.nvmrc'), 'edited\n')

    const r = sb.run('ship', ['--reviewed'])

    expect(r.status).not.toBe(0)
    expect(r.out).toContain('uncommitted changes')
  })

  it('refuses a branch that is behind origin/main', () => {
    onIssueBranch()
    reviewed()
    sb.git(['checkout', '--quiet', 'main'])
    sb.commit('feat: someone else landed')
    sb.git(['push', '--quiet', 'origin', 'main'])
    sb.git(['checkout', '--quiet', BRANCH])

    const r = sb.run('ship', ['--body-file', sb.body])

    expect(r.status).not.toBe(0)
    expect(r.out).toContain('1 commit(s) behind origin/main')
    expect(sb.originSha(BRANCH)).toBe('')
  })

  it('refuses to run the checks on a Node major other than .nvmrc', () => {
    onIssueBranch()
    writeFileSync(path.join(sb.repo, '.nvmrc'), '18\n')
    sb.git(['commit', '--quiet', '-am', 'chore: pin another node'])
    reviewed()

    const r = sb.run('ship', ['--body-file', sb.body])

    expect(r.status).not.toBe(0)
    expect(r.out).toContain('is not the Node 18 in .nvmrc')
    expect(npmRuns()).toEqual([])
  })

  it('refuses to push when no PR is open and no body file is given', () => {
    onIssueBranch()
    reviewed()

    const r = sb.run('ship')

    expect(r.status).not.toBe(0)
    expect(r.out).toContain('/pr skill')
    expect(sb.originSha(BRANCH)).toBe('')
  })

  it.each(CHECKS)('does not push when %s fails', (check) => {
    onIssueBranch()
    reviewed()
    sb.stub('npm_fail', `${check}\n`)

    const r = sb.run('ship', ['--body-file', sb.body])

    expect(r.status).not.toBe(0)
    expect(sb.originSha(BRANCH)).toBe('')
    expect(prCreates()).toEqual([])
  })

  it('runs every CI check, pushes HEAD, and opens a draft PR that closes the issue above the body', () => {
    onIssueBranch()
    reviewed()

    const r = sb.run('ship', ['--body-file', sb.body])

    expect(r.status, r.out).toBe(0)
    expect(npmRuns()).toEqual(CHECKS)
    expect(sb.originSha(BRANCH)).toBe(sb.git(['rev-parse', 'HEAD']))
    expect(prCreates()).toHaveLength(1)
    expect(prCreates()[0]).toContain('--base main')
    expect(prCreates()[0]).toContain('--draft')
    expect(sb.read('pr_body')).toBe('Closes #8\n\n## Summary\n\nThe change.')
    expect(r.out).toContain('https://github.com/acme/demo/pull/1')
  })

  it('does not repeat Closes #N when the body already has it', () => {
    onIssueBranch()
    reviewed()
    writeFileSync(sb.body, 'Closes #8\n## Summary\n')

    expect(sb.run('ship', ['--body-file', sb.body]).status).toBe(0)

    expect(sb.read('pr_body')).toBe('Closes #8\n\n## Summary')
  })

  it('still opens the PR when the body is nothing but Closes #N', () => {
    onIssueBranch()
    reviewed()
    writeFileSync(sb.body, 'Closes #8\n')

    const r = sb.run('ship', ['--body-file', sb.body])

    expect(r.status, r.out).toBe(0)
    expect(prCreates()).toHaveLength(1)
    expect(sb.read('pr_body')).toBe('Closes #8')
  })

  it('reuses an open PR on a re-run instead of opening another', () => {
    onIssueBranch()
    reviewed()
    expect(sb.run('ship', ['--body-file', sb.body]).status).toBe(0)
    sb.commit('fix: from CI')
    reviewed()

    const r = sb.run('ship')

    expect(r.status, r.out).toBe(0)
    expect(r.out).toContain('PR already open')
    expect(prCreates()).toHaveLength(1)
    expect(sb.originSha(BRANCH)).toBe(sb.git(['rev-parse', 'HEAD']))
  })

  it('pushes through the x-access-token URL when GH_TOKEN is set, without printing the token', () => {
    // A second remote stands in for GitHub: only the tokenized URL is rewritten to it.
    const tokenRemote = path.join(sb.root, 'token-remote.git')
    sb.git(['clone', '--quiet', '--bare', sb.origin, tokenRemote], sb.root)
    sb.git([
      'config',
      `url.${tokenRemote}.insteadOf`,
      'https://x-access-token:tok_secret123@github.com/acme/demo.git',
    ])
    // Puts the token into the push's output, as git's own messages about the
    // tokenized URL can. (The insteadOf rewrite hides it from git itself here.)
    writeFileSync(
      path.join(sb.repo, '.git/hooks/pre-push'),
      '#!/bin/sh\necho "pushing to https://x-access-token:$GH_TOKEN@github.com/acme/demo.git" >&2\n',
      { mode: 0o755 },
    )
    onIssueBranch()
    reviewed()

    const r = sb.run('ship', ['--body-file', sb.body], { env: { GH_TOKEN: 'tok_secret123' } })

    expect(r.status, r.out).toBe(0)
    expect(r.out).toContain('pushing to https://x-access-token:***@github.com/acme/demo.git')
    expect(r.out).not.toContain('tok_secret123')
    const viaToken = sb.git(['--git-dir', tokenRemote, 'rev-parse', BRANCH], sb.root)
    expect(viaToken).toBe(sb.git(['rev-parse', 'HEAD']))
    expect(sb.originSha(BRANCH)).toBe('')
  })
})
