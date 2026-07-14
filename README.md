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
- `REWARD_PERCENT` — cashback percent (default 20)
- `REWARD_CAP_SATS` — max reward per payment (default 2000)
- `MERCHANT_DAILY_REWARD_LIMIT` — max rewards per shop per day (default 5)

Rules:
- Get 20% sats back, capped at 2,000 sats
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
