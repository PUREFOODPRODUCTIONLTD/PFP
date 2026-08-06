-- Recipe Costing App - Supabase schema
-- Run this in the Supabase SQL editor once your project is created.

-- Mirrors ingredient pricing pulled from Recipe Cost Calculator (RCC).
-- Populated by scripts/sync-rcc.js. Never exposed directly to the browser -
-- only server-side API routes (using the service role key) read from it.
create table if not exists ingredients (
  rcc_id integer primary key,
  name text not null,
  category text,
  unit_name text,
  price_per_unit numeric not null,
  pack_size numeric,
  pack_price numeric,
  synced_at timestamptz default now()
);

-- Your margin and labour rate. Edit these values directly in the Supabase
-- table editor whenever they change - no code changes or redeploys needed.
create table if not exists settings (
  id integer primary key default 1,
  margin_pct numeric not null default 0.35,
  labour_rate_per_hour numeric not null default 16.50,
  currency_symbol text not null default '£'
);
insert into settings (id, margin_pct, labour_rate_per_hour, currency_symbol)
values (1, 0.35, 16.50, '£')
on conflict (id) do nothing;

-- Customer-saved recipes. customer_id ties back to Supabase Auth users,
-- so each customer only ever sees their own recipes.
create table if not exists recipes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references auth.users(id) not null,
  name text not null,
  portions numeric not null default 1,
  prep_minutes numeric not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid references recipes(id) on delete cascade,
  ingredient_rcc_id integer references ingredients(rcc_id),
  quantity numeric not null
);

-- Row Level Security: customers can only ever read/write their own recipes.
alter table recipes enable row level security;
alter table recipe_ingredients enable row level security;

create policy "Customers manage their own recipes"
  on recipes for all
  using (auth.uid() = customer_id);

create policy "Customers manage their own recipe lines"
  on recipe_ingredients for all
  using (
    exists (
      select 1 from recipes r
      where r.id = recipe_ingredients.recipe_id
      and r.customer_id = auth.uid()
    )
  );

-- Deliberately no RLS policy grants direct customer access to
-- "ingredients" or "settings" - those stay readable only via the
-- service role key inside server-side API routes, so raw cost data
-- and margin never reach the browser.
