# SatReward

Spend sats at a merchant. Get a daily reward.

Live path: **https://bitcoin.info.zm/satreward**

## Server `.env` (create on VPS only — never commit)

```bash
cp .env.example .env
nano .env
```

Fill in:
- `BLINK_API_KEY` — from Blink dashboard
- `BLINK_BTC_WALLET_ID` — your Blink BTC wallet ID
- `REWARD_SATS` — reward amount (default 500)
- `MERCHANT_DAILY_REWARD_LIMIT` — max rewards per shop per day (default 5)
- `MIN_SPEND_SATS_FOR_REWARD` — minimum spend to earn a reward (default 1000)

Rules:
- Spend at least 1,000 sats to earn a reward
- One reward per shop per wallet per day
- Each shop can trigger at most 5 rewards per day

## Deploy on VPS

```bash
cd /root/SatReward
git pull
cp .env.example .env
nano .env          # add BLINK_API_KEY + wallet ID first
npm install
npm run build
npx prisma db push
pm2 delete satreward 2>/dev/null || true
pm2 start npm --name satreward --cwd /root/SatReward -- start
pm2 save
```

Port **30001**. The main `bitcoin-info-zm` app proxies `/satreward` here.
