# Recipe costing app — Pure Food Production

Customer-facing recipe pricing tool. Customers pick ingredients and quantities;
the app calculates a price using your live Recipe Cost Calculator (RCC) data,
labour rate, and margin. Raw supplier costs and margin never reach the browser
— only the final price does.

## How it fits together

- **RCC** stays your source of truth for supplier prices. Nothing changes there.
- **`scripts/sync-rcc.js`** pulls current ingredient prices from RCC's API and
  mirrors them into a Supabase table.
- **`pages/api/price.js`** is the only place pricing math happens. It reads
  from Supabase using a server-only key, applies your margin and labour rate,
  and returns a price. The browser never sees the underlying numbers.
- **`pages/index.js`** is the customer-facing calculator page.

## One-time setup

### 1. Create a Supabase project

Free tier at [supabase.com](https://supabase.com). Once created:

- Go to the SQL editor and run everything in `supabase/schema.sql`.
- Go to Project Settings > API and copy: the Project URL, the `anon` public
  key, and the `service_role` key (keep this one secret — server-side only).

### 2. Get your RCC API key

In your RCC account, look under Settings for an API or Integrations section
and generate a key. If you can't find it, ask RCC support to enable API
access on your plan — it's documented in their API spec but may need to be
switched on for your account.

### 3. Create a Vercel account

Free tier at [vercel.com](https://vercel.com). You'll connect this project's
code (e.g. via GitHub) and Vercel builds + hosts it automatically.

### 4. Set environment variables

Copy `.env.example` to `.env` for local development, and fill in the values
from steps 1 and 2. When you deploy to Vercel, add the same variables under
Project Settings > Environment Variables there — never commit `.env` or
paste real keys into chat, docs, or source control.

### 5. Edit your margin and labour rate

These live in the Supabase `settings` table (not in code), so you can update
them anytime without redeploying. Table editor > `settings` > edit the row.

## Running it

```bash
npm install
npm run sync-prices   # pulls current prices from RCC into Supabase
npm run dev           # starts the app locally at http://localhost:3000
```

## Deploying

1. Push this project to a GitHub repo.
2. Import the repo in Vercel and add the environment variables from `.env.example`.
3. Deploy. Vercel gives you a URL like `recipe-costing-app.vercel.app`.
4. In Squarespace (Settings > Domains > `purefoodproduction.co.uk` > DNS),
   add a CNAME record pointing a subdomain (e.g. `app`) at the Vercel URL,
   then add that subdomain in Vercel's Project Settings > Domains. Customers
   then reach the tool at `app.purefoodproduction.co.uk`.
5. Set up `npm run sync-prices` to run on a schedule (Vercel Cron calling an
   API route, or a scheduled GitHub Action) so prices stay current
   automatically after you update them in RCC.

## Not built yet (next phase)

- Customer login (Supabase Auth) so each customer only sees their own saved
  recipes — the database schema already supports this, the login screen
  doesn't exist yet.
- Saving/loading recipes (the `recipes` and `recipe_ingredients` tables are
  ready; the UI to use them isn't wired up).
- Automatic scheduled sync (currently manual via `npm run sync-prices`).

## What Joseph needs to do vs what's already built

**Already built:** the calculator UI, the pricing logic, the database schema,
and the RCC sync script.

**Still needed:** the three accounts above, the environment variables filled
in, and someone (me, once you're ready) to actually deploy it and connect
the domain.
