# Deploying the TrustLens web app

It's a static Vite build (`npm run build` → `dist/`). Deploy it to any static
host: **Vercel**, **Netlify**, or **Cloudflare Pages** (all have free tiers).

## One required setting

Set `VITE_API_BASE` to your deployed backend URL (see the backend's DEPLOY.md).
It's baked in at **build time**, so set it in the host's env, then build.

## Vercel (easiest)

1. Push this repo to GitHub.
2. Vercel → New Project → import the repo.
3. Framework preset: **Vite**. Build command `npm run build`, output `dist`.
4. Environment Variables → add `VITE_API_BASE = https://<your-backend>`.
5. Deploy. Your URL is `https://<name>.vercel.app`.
6. Copy that URL into the backend's `ALLOWED_ORIGINS` env, then redeploy the backend.

## Netlify / Cloudflare Pages

- Build command: `npm run build`
- Publish/output directory: `dist`
- Add env var `VITE_API_BASE`
- (Cloudflare Pages / Netlify are the same three fields.)

## Local production build test

```bash
VITE_API_BASE=http://127.0.0.1:8000 npm run build
npm run preview   # serves dist/ locally
```

## Note on networks

The app is wired to **Base Sepolia (testnet)**. Users need MetaMask on Base
Sepolia and testnet ETH. Moving to **Base mainnet** (real payments) means:
redeploy `PaymentGate` to mainnet, update the address + chain in `src/contracts.ts`
and `src/wagmi.ts`, and treat it as a real launch (real funds, real audit).
