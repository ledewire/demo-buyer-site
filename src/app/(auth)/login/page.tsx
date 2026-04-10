import { createClient } from '@ledewire/node'
import { config } from '@/lib/config'
import LoginForm from './LoginForm'

export default async function LoginPage() {
  let googleClientId: string | null = null
  try {
    const client = createClient({ baseUrl: config.ledewireBaseUrl })
    const publicConfig = await client.config.getPublic()
    googleClientId = publicConfig.google_client_id ?? null
  } catch {
    // Google Sign-In is hidden until the API is reachable.
  }

  return <LoginForm googleClientId={googleClientId} />
}
