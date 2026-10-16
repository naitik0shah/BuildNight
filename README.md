# Bahi: a memory for small businesses

Owner-run shops record what they notice (text, photo, voice), manage stock, log bets and review them. Nothing about a business is hardcoded: people, items, machines and running costs are all entered (or imported) by the owner.

## Run it
    npm install
    cp .env.example .env     # optional; set SETUP_CODE on any deployed instance
    npm start                # http://localhost:3000

First visit: create your business and owner PIN. Then Business tab: add people (with PINs so they can sign in), machines, running costs (electricity, rent...). Stock tab: import `samples/items.csv` and `samples/moves.csv`, or your own CSV (you map the columns).

## How it fits together
- `src/server.ts`: Express + TypeScript API. One field schema (`F`) drives validation and the browser forms. Data lives in `data/db.json` (atomic writes); replace `save()`/`db` with MongoDB or Postgres to scale.
- `src/client/app.ts`: the browser app. Every change on the server is pushed to all open devices (Server-Sent Events), so screens update live.
- WhatsApp: `/api/whatsapp` webhook (Meta Cloud API). Set WA_VERIFY and WA_SECRET, and put each person's number under Business. Text messages become entries; `/analyze` marks them for analysis.

## Security in place
Scrypt-hashed PINs, bearer sessions with expiry, login rate limit, owner/staff roles (salaries and costs hidden from staff), whitelisted and length-limited fields, media type and size checks, escaped output, CSP and no-sniff headers, WhatsApp HMAC signature check, optional setup code.

## Not done yet (be honest in the pitch)
Live Google Trends/weather/social connectors, AI reading of handwritten pages, WhatsApp media and outgoing replies, offline queue/PWA install, multi-business tenancy, media in object storage (photos are stored inline in the JSON file for now), automated tests.
