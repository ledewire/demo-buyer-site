# Demo Buyer Site

A reference site where Buyers, and the Company admins who manage Machine users, buy LedeWire
content and manage the credentials their agents use.

## Language

### Credentials

**Payment key**:
The public half of an Ed25519 key that signs x402 payments for a Buyer or a Machine user. It
can't log anyone in, and LedeWire never holds its private half. A Buyer holds at most 10 active
keys, a Company admin registers a Machine user's keys, and a revoked key still names the
purchases it paid for.
_Avoid_: signing key, wallet key, x402 key

**Buyer API key**:
A key and secret an agent logs in with as its Buyer, then spends under that Buyer's Spend cap.
Unlike a Payment key, it is a login credential and LedeWire holds its secret.
_Avoid_: API token, agent key

**MCP key**:
A key and secret, limited by Scopes, that an MCP client presents to LedeWire's MCP server on a
Machine user's behalf. Like a Buyer API key it authenticates; a Payment key only signs payments.
_Avoid_: MCP token
