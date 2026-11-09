import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto'
import PaymentKeyGuidance from './PaymentKeyGuidance'

/** The Node `crypto` snippet as the page shows it. */
function nodeSnippet() {
  const summary = screen.getByText(/Or use Node's/)
  const details = summary.closest('details')
  if (!details) throw new Error('the Node snippet is not in a <details>')
  return details.querySelector('pre')?.textContent ?? ''
}

/**
 * Runs the snippet as a reader would paste it, with its `node:crypto` import supplied, and
 * returns what it logs.
 */
function runSnippet(source: string): { public_key: string; proof: string } {
  const body = source.replace(/^import .*$/m, '')
  let logged: unknown
  const run = new Function('generateKeyPairSync', 'sign', 'Buffer', 'console', body)
  run(generateKeyPairSync, sign, Buffer, { log: (value: unknown) => (logged = value) })
  return logged as { public_key: string; proof: string }
}

describe('PaymentKeyGuidance', () => {
  it.each(['buyer', 'machine'] as const)(
    'points the %s form at createPaymentKeyRegistration(name)',
    (variant) => {
      render(<PaymentKeyGuidance variant={variant} />)
      expect(screen.getAllByText(/createPaymentKeyRegistration/).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/@ledewire\/x402-client/).length).toBeGreaterThan(0)
    },
  )

  it('mentions registerPaymentKey() only on the Buyer form', () => {
    const { unmount } = render(<PaymentKeyGuidance variant="buyer" />)
    expect(screen.getAllByText(/registerPaymentKey/).length).toBeGreaterThan(0)
    unmount()
    render(<PaymentKeyGuidance variant="machine" />)
    expect(screen.queryByText(/registerPaymentKey/)).not.toBeInTheDocument()
  })

  it("keeps the Node crypto snippet collapsed under 'Or use Node's crypto'", () => {
    render(<PaymentKeyGuidance variant="machine" />)
    const details = screen.getByText(/Or use Node's/).closest('details')
    expect(details).not.toHaveAttribute('open')
  })

  it('has a Node snippet whose proof signs `ledewire-payment-key:` followed by the public key', () => {
    render(<PaymentKeyGuidance variant="buyer" />)
    const { public_key, proof } = runSnippet(nodeSnippet())

    expect(public_key).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(proof).toMatch(/^[A-Za-z0-9_-]{86}$/)

    // Rebuild the public key from its 32 raw bytes and check the proof against the exact message.
    const spkiPrefix = Buffer.from('302a300506032b6570032100', 'hex')
    const key = createPublicKey({
      key: Buffer.concat([spkiPrefix, Buffer.from(public_key, 'base64url')]),
      format: 'der',
      type: 'spki',
    })
    const signed = Buffer.from(`ledewire-payment-key:${public_key}`, 'ascii')
    expect(verify(null, signed, key, Buffer.from(proof, 'base64url'))).toBe(true)
    expect(verify(null, Buffer.from(public_key, 'ascii'), key, Buffer.from(proof, 'base64url'))).toBe(
      false,
    )
  })
})
