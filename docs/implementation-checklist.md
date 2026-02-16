# Fidelity Implementation Checklist

## Completed scaffolding
- Frontend modularized into app/router/components/features/state/services.
- Fan and artist MVP flows implemented with mocked behavior.
- Backend Node API scaffold with auth, loyalty, commerce, wallet, analytics routes.
- Realtime chat websocket server scaffold.
- Prisma schema covering users, streams, attendance, tiers, bids, orders, wallets, NFTs, analytics.
- Docker compose and CI workflow skeleton.

## Next engineering tasks
1. Replace fake API and in-memory stores with Prisma-backed repositories.
2. Add Stripe webhook signature verification and idempotency keys.
3. Add WalletConnect signing + Polygon contract interactions.
4. Add Twilio Video integration for tier-1 claim scheduling.
5. Add moderation policy engine and abuse prevention.
6. Add test suites (unit, integration, e2e) and coverage thresholds.
