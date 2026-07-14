# SatReward

Next.js 14 (App Router) + Prisma (SQLite) PWA. One process serves the UI and the `app/api/**` routes. See `README.md` and `package.json` scripts for standard commands.

## Cursor Cloud specific instructions

- Dev server: `npm run dev` serves on port **30001** under the base path **`/satreward`**. Open `http://localhost:30001/satreward` (the root `/` is a 404). Scripts are in `package.json`.
- Local DB: SQLite is embedded (no separate DB server). Create/sync it with `npx prisma db push`. The dev VM uses `DATABASE_URL="file:./dev.db"` in `.env`; the repo's `.env.example` points at `prod.db` for the VPS, so keep the dev `.env` separate.
- `.env` is gitignored and must exist for the app to run. Copy from `.env.example` if missing.
- External dependency (Blink): `BLINK_API_KEY` and `BLINK_BTC_WALLET_ID` are external SaaS secrets and are NOT set in this VM. Without them the UI and merchant list work fully, but the BTC↔ZMW rate, reward pool balance, invoice creation, and reward sending return `Blink API key not configured`. A full end-to-end payment also needs a reachable merchant Lightning address and a real Lightning wallet to pay the invoice — not possible in-VM. To test those flows, add the Blink secrets.
- Prisma client is generated automatically via the `postinstall` hook; re-run `npx prisma generate` (or `db push`) after changing `prisma/schema.prisma`.
