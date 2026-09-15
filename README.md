# Okubu Momo

Order management for a small two-floor restaurant: waiters take orders on the
2nd floor, the kitchen sees them instantly on the 1st floor.

Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Supabase.

## Setup

### 1. Requirements

Node 22 (`.nvmrc` pins it — run `nvm use`).

```bash
nvm use && npm install
```

### 2. Environment

Copy `.env.example` to `.env.local` and fill in your Supabase project URL and
publishable key (Project Settings → API keys).

`.env.local` is git-ignored. Never add a secret/service_role key — this app
does not use one.

### 3. Database

Paste `supabase/RUN_ALL.sql` into the Supabase SQL Editor and Run. It creates
the tables, Row Level Security, the operation functions, the Realtime
publication, and some starting menu items and tables.

`RUN_ALL.sql` is generated — edit the numbered files and run
`./supabase/build-run-all.sh`.

### 4. Accounts

There is no sign-up screen. Create users in the Supabase dashboard under
**Authentication → Users → Add user** (tick *Auto Confirm User*).

Everyone starts as `staff`. Promote the owner:

```sql
update public.profiles set role = 'admin' where id = '<user-uuid>';
```

Two accounts are enough: one admin, one staff shared by all staff on every
device.

### 5. Run

```bash
npm run dev
```

## How it works

**Takeout is per ticket.** A customer at a table can eat in and take food
home: that is two tickets on one table, one plated and one packed, settled
with a single payment. A walk-in who never sits uses a table called
"Takeaway".

**A ticket, not a bill.** Each "Send to kitchen" creates one `orders` row. A
second round for the same table is a second ticket, so `NEW → COOKING →
COMPLETED` always describes exactly one batch of food and the kitchen only
ever sees what is actually new.

**Table state is derived, never stored.** A table is occupied when it has an
unpaid ticket. Nothing to reset, nothing to get stuck.

**The database owns money and prices.** `place_order` reads prices from the
menu itself; `settle_table` computes the bill total. The tablet only ever
sends item ids, quantities and a payment method.

**Names and prices are snapshotted** onto each order line, so changing the
menu never rewrites past receipts.

**Realtime is a signal, not a stream.** Any change to `orders` or
`order_items` triggers a refetch rather than a local patch. A 15-second poll
runs alongside it, so a dropped websocket can never silently freeze the
kitchen screen — the screen says so when that happens.

## Layout

```
app/
  login/             sign in (email + password)
  staff/             device mode picker — remembers Hall or Kitchen
    hall/            tables → order builder → payment
    kitchen/         live ticket queue
      totals/        outstanding items pooled across tickets, for batch cooking
  admin/
    menu/ tables/ sales/
lib/
  supabase/          browser + server clients, env
  auth.ts            data access layer: requireUser / requireRole
  queries.ts         reads      mutations.ts   writes
  use-live-data.ts   realtime + fallback poll
  status.ts money.ts types.ts
proxy.ts             session refresh + signed-out redirect (Next 16 middleware)
supabase/            SQL migrations
```

## Security

- The browser holds only the publishable key; RLS decides everything.
- Menu and table edits are admin-only. Sales history is admin-only.
- Column grants stop staff rewriting anything on a ticket but its status.
- Order placement, payment and cancellation go through `SECURITY DEFINER`
  functions that re-check the caller.
