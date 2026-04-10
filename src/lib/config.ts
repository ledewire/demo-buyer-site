function required(name: string): string {
  // eslint-disable-next-line security/detect-object-injection -- name is a string literal from call sites; process.env is not user-controlled
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}\n` +
        `Copy .env.example to .env.local and fill in all required values.`,
    )
  }
  return value
}

function optional(name: string): string | undefined {
  // eslint-disable-next-line security/detect-object-injection -- same rationale as above
  return process.env[name] || undefined
}

function buildConfig() {
  const sessionSecret = required('SESSION_SECRET')
  if (sessionSecret.length < 32) {
    throw new Error(
      `SESSION_SECRET must be at least 32 characters. Generate one with: openssl rand -hex 32`,
    )
  }
  return {
    ledewireBaseUrl: optional('LEDEWIRE_BASE_URL') ?? 'https://api.ledewire.com',
    sessionSecret,
    isProduction: process.env.NODE_ENV === 'production',
  } as const
}

export const config = buildConfig()
