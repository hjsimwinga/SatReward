# SatReward

Spend sats at a merchant. Get a daily reward.

**Live:** https://satreward.space

## DNS setup (Namecheap) — simple guide

You only need to point the domain to your VPS IP.

**Step 1.** Open [Namecheap](https://www.namecheap.com) and log in.

**Step 2.** Click **Domain List**.

**Step 3.** Find `satreward.space` → click **Manage**.

**Step 4.** Click the **Advanced DNS** tab.

**Step 5.** Under **Host Records**, delete any old A / CNAME / URL Redirect records for `@` and `www` (if any).

**Step 6.** Click **Add New Record** and add this:

- Type: **A Record**
- Host: `@`
- Value: your VPS IP (example: `1.2.3.4`)
- TTL: **Automatic**

**Step 7.** Click **Add New Record** again and add this:

- Type: **A Record**
- Host: `www`
- Value: same VPS IP
- TTL: **Automatic**

**Step 8.** Click the green check / **Save**.

**Step 9.** Wait 5–30 minutes. Then open https://satreward.space

Done. The domain now points to your server.

## Nginx (HTTPS + www redirect)

```nginx
# /etc/nginx/sites-available/satreward.space
server {
    listen 80;
    server_name satreward.space www.satreward.space;
    return 301 https://satreward.space$request_uri;
}

server {
    listen 443 ssl http2;
    server_name www.satreward.space;

    ssl_certificate     /etc/letsencrypt/live/satreward.space/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/satreward.space/privkey.pem;

    return 301 https://satreward.space$request_uri;
}

server {
    listen 443 ssl http2;
    server_name satreward.space;

    ssl_certificate     /etc/letsencrypt/live/satreward.space/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/satreward.space/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:30001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Then:

```bash
sudo ln -sf /etc/nginx/sites-available/satreward.space /etc/nginx/sites-enabled/
sudo certbot --nginx -d satreward.space -d www.satreward.space
sudo nginx -t && sudo systemctl reload nginx
```

## Remove from bitcoin.info.zm

On the VPS, in the `bitcoin-info-zm` nginx/proxy config:

1. Delete the `/satreward` proxy location.
2. Optionally redirect old links:

```nginx
location = /satreward { return 301 https://satreward.space/; }
location /satreward/ { return 301 https://satreward.space$request_uri; }
```

3. Reload nginx.

## Server `.env` (VPS only — never commit)

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

## Deploy on VPS

```bash
cd /root/SatReward
git pull
cp .env.example .env   # first time only
nano .env
npm install
npm run build
npx prisma db push
pm2 delete satreward 2>/dev/null || true
pm2 start npm --name satreward --cwd /root/SatReward -- start
pm2 save
```

App listens on port **30001**. Nginx serves it at **https://satreward.space**.
