# LedeWire Demo Buyer Site

A Next.js 15 buyer portal for the [LedeWire](https://ledewire.com) content marketplace. Buyers can manage their wallet, browse purchases, and generate API keys for agent-based access.

## Features

- **Email/password login and signup** with session-backed iron-session cookies
- **Google OAuth** (rendered server-side; only shown when the API advertises a `google_client_id`)
- **Password reset** — request and confirm flows
- **Dashboard** — wallet balance, total spend, and recent purchases at a glance
- **Wallet** — fund your balance via Stripe, view transaction history
- **Purchases** — full purchase history with content titles and amounts
- **API Keys** — create, list, and revoke keys with optional spending limits

## Prerequisites

- Node.js 22 (`.nvmrc`)
- A running LedeWire API instance (defaults to `https://api.ledewire.com`)

## Getting Started

### 1. Clone and install

```bash
git clone <repo-url>
cd demo-buyer-site
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

| Variable            | Required | Description                                                                      |
| ------------------- | -------- | -------------------------------------------------------------------------------- |
| `SESSION_SECRET`    | ✅       | Cookie encryption key — must be ≥ 32 chars. Generate with `openssl rand -hex 32` |
| `LEDEWIRE_BASE_URL` | ❌       | LedeWire API base URL. Defaults to `https://api.ledewire.com`                    |

### 3. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app redirects unauthenticated visitors to `/login` automatically.

## Dev Container

The repo ships a [Dev Container](.devcontainer/devcontainer.json) for VS Code / GitHub Codespaces. It:

- Uses the official `typescript-node:20` image
- Runs `npm install` on container create
- Forwards port 3000 and opens it in the browser automatically
- Pre-installs recommended extensions (Prettier, ESLint, Tailwind CSS IntelliSense, Copilot)
- Configures format-on-save and ESLint auto-fix

## Project Structure

```
src/
├── app/
│   ├── (auth)/          # Unauthenticated pages: login, signup, forgot-password
│   ├── (buyer)/         # Authenticated pages: dashboard, wallet, purchases, api-keys
│   │   └── layout.tsx   # Shared buyer layout with NavBar
│   └── api/             # Next.js Route Handlers
│       ├── auth/        # login, signup, logout, google, password-reset
│       ├── api-keys/    # list, create, revoke
│       ├── purchases/   # list
│       └── wallet/      # balance, payment-session, payment-status
├── components/          # Shared UI: NavBar, LogoutButton
├── lib/
│   ├── auth.ts          # requireAuth() — Server Component auth guard (redirects)
│   ├── route-auth.ts    # requireAuthForRoute() — Route Handler auth guard (401)
│   ├── ledewire.ts      # createBuyerClient() — session-backed @ledewire/node client
│   ├── session.ts       # iron-session setup and SessionData type
│   └── config.ts        # Validated environment config
├── middleware.ts         # Edge middleware: cookie presence check on buyer routes
└── __mocks__/
    └── ledewire-client.ts  # Shared Vitest mock for @ledewire/node
```

### Auth architecture

Two layers of auth protection run in parallel:

- **Edge middleware** (`middleware.ts`) — fast cookie-presence check; redirects to `/login` before any page renders. Covers all buyer route groups.
- **Server-side guard** (`requireAuth`) — full session validation inside Server Components; handles token expiry by redirecting to `/login`.
- **Route Handler guard** (`requireAuthForRoute`) — same validation for API routes; returns `401 JSON` instead of redirecting.

Tokens are stored in an encrypted `httpOnly` cookie via [iron-session](https://github.com/vvo/iron-session) and automatically refreshed by `@ledewire/node`'s token storage interface.

## Scripts

| Script                   | Description                                |
| ------------------------ | ------------------------------------------ |
| `npm run dev`            | Start Next.js dev server with hot reload   |
| `npm run build`          | Production build                           |
| `npm run start`          | Start production server (requires build)   |
| `npm test`               | Run Vitest test suite                      |
| `npm run test:watch`     | Run tests in watch mode                    |
| `npm run test:coverage`  | Run tests with V8 coverage report          |
| `npm run typecheck`      | TypeScript type-check without emitting     |
| `npm run lint`           | ESLint (includes `eslint-plugin-security`) |
| `npm run lint:fix`       | ESLint with auto-fix                       |
| `npm run format`         | Prettier write                             |
| `npm run format:check`   | Prettier check (used in CI)                |
| `npm run audit:security` | `npm audit --audit-level=high`             |

## CI

GitHub Actions runs on every push to `main` and every pull request:

1. Type check
2. Lint
3. Format check
4. Test with coverage
5. Security audit (`--audit-level=high`)

See [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

## Testing

Tests use [Vitest](https://vitest.dev) + [Testing Library](https://testing-library.com) in a jsdom environment.

```bash
npm test                  # single run
npm run test:watch        # watch mode
npm run test:coverage     # with coverage report
```

**Coverage** (statements / branches / functions):

| Layer                | Coverage           |
| -------------------- | ------------------ |
| API route handlers   | 100% / 100% / 100% |
| `src/lib` utilities  | ~90%               |
| UI components        | 100%               |
| Auth form components | ~75%               |

The shared mock for `@ledewire/node` lives in [`src/__mocks__/ledewire-client.ts`](src/__mocks__/ledewire-client.ts). Import it in tests with:

```ts
vi.mock('@/lib/ledewire', () => import('@/__mocks__/ledewire-client'))
```
