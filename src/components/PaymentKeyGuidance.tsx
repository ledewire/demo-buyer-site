/** Builds a registration with `@ledewire/x402-client`; the private key never leaves the caller. */
const X402_SNIPPET = `import { createPaymentKeyRegistration } from '@ledewire/x402-client'

const { privateKey, body } = await createPaymentKeyRegistration('research-agent')
// Paste body.name, body.public_key and body.proof below.
// Keep privateKey in your secrets manager: it signs payments, and LedeWire never sees it.`

/**
 * The same registration with only Node's `crypto`, from `UserPaymentKeysNamespace.create`'s
 * JSDoc in `@ledewire/node`. The proof signs `ledewire-payment-key:` followed by the public key.
 */
const NODE_CRYPTO_SNIPPET = `import { generateKeyPairSync, sign } from 'node:crypto'

const { publicKey, privateKey } = generateKeyPairSync('ed25519')
// The raw 32 public-key bytes are the last 32 bytes of the SPKI DER encoding
const public_key = publicKey
  .export({ type: 'spki', format: 'der' })
  .subarray(-32)
  .toString('base64url')
const message = Buffer.from(\`ledewire-payment-key:\${public_key}\`, 'ascii')
const proof = sign(null, message, privateKey).toString('base64url')

console.log({ public_key, proof })
// Keep privateKey in your secrets manager: it signs payments, and LedeWire never sees it.`

const CODE_CLASSES =
  'mt-2 overflow-x-auto rounded-md bg-gray-900 p-3 text-xs leading-relaxed text-gray-100'

interface Props {
  /** `buyer` for the signed-in Buyer's own keys; `machine` for a Machine user's, registered by an admin. */
  variant: 'buyer' | 'machine'
}

/**
 * How to make the public key and proof a Payment key registration needs. The key pair is made
 * off-site: this site never asks for or holds a private key.
 */
export default function PaymentKeyGuidance({ variant }: Props) {
  return (
    <div className="space-y-2 text-sm text-gray-600">
      <p>
        Generate the key pair where your agent runs, then paste in only the name, public key and
        proof. Never paste a private key here. With{' '}
        <code className="font-mono text-gray-800">@ledewire/x402-client</code>,{' '}
        <code className="font-mono text-gray-800">createPaymentKeyRegistration(name)</code> returns
        the private key and the body to register:
      </p>
      <pre className={CODE_CLASSES}>
        <code>{X402_SNIPPET}</code>
      </pre>
      {variant === 'buyer' && (
        <p>
          To register your own key in one step from your agent, without this form, use{' '}
          <code className="font-mono text-gray-800">registerPaymentKey(&#123; key, secret, name &#125;)</code>{' '}
          with one of your Buyer API keys.
        </p>
      )}
      <details>
        <summary className="cursor-pointer text-indigo-600 hover:text-indigo-800">
          Or use Node&apos;s <code className="font-mono">crypto</code>
        </summary>
        <pre className={CODE_CLASSES}>
          <code>{NODE_CRYPTO_SNIPPET}</code>
        </pre>
      </details>
    </div>
  )
}
