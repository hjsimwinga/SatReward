# SatReward

Next.js 14 (App Router) + Prisma (SQLite) PWA. One process serves the UI and the `app/api/**` routes. See `README.md` and `package.json` scripts for standard commands.

## Cursor Cloud specific instructions

- Dev server: `npm run dev` serves on port **30001** under the base path **`/satreward`**. Open `http://localhost:30001/satreward` (the root `/` is a 404). Scripts are in `package.json`.
- Local DB: SQLite is embedded (no separate DB server). Create/sync it with `npx prisma db push`. The dev VM uses `DATABASE_URL="file:./dev.db"` in `.env`; the repo's `.env.example` points at `prod.db` for the VPS, so keep the dev `.env` separate.
- `.env` is gitignored and must exist for the app to run. Copy from `.env.example` if missing.
- External dependency (Blink): `BLINK_API_KEY` and `BLINK_BTC_WALLET_ID` must be present in `.env` (gitignored). If they are available as environment variables but missing from `.env`, write them into `.env` and restart `npm run dev` — Next.js only loads `.env` at process start. With those keys, rate (`/api/rate/zmw`), pool balance, and invoice creation (`/api/pay/invoice`) work against live Blink + merchant LNURL. Actually *paying* the invoice still needs a real Lightning wallet (not possible fully in-VM); after payment, `POST /api/pay/poll` settles and may send the reward from the pool.
- Prisma client is generated automatically via the `postinstall` hook; re-run `npx prisma generate` (or `db push`) after changing `prisma/schema.prisma`.
