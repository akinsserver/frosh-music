# Frosh Music — Supabase Auth & Access Code Setup

Frosh Music is invite-only. Visitors must authenticate with Supabase Auth to access the web app. Account registration is protected by an **Access Code Gate**: visitors must provide a valid access code before being allowed to register with an email and password.

---

## 1. Supabase Project Setup

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard) (or use your existing project).
2. Go to **Project Settings → API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

> [!NOTE]
> The `anon` key is safe for client-side use. Never expose the `service_role` key in the web app.

---

## 2. Environment Variables

### Local Development
In `music-web/.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

### Production (Vercel)
In your Vercel project under **Settings → Environment Variables**, add:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Then redeploy your application.

---

## 3. Run the Database Migration

In the Supabase Dashboard:
1. Open **SQL Editor → New query**.
2. Paste the full contents of [`supabase/migrations/20261127150000_invite_codes.sql`](../../supabase/migrations/20261127150000_invite_codes.sql).
3. Click **Run**.

This creates:
- `access_codes` (and `invite_codes` alias table) with Row Level Security (RLS) enabled so nobody can read or query the list of codes through the API.
- `validate_access_code(p_code)` and `validate_invite_code(p_code)` `SECURITY DEFINER` functions that verify if the entered code is valid and active.
- `record_access_code_use(p_code)` to increment the usage counter whenever an account is created.

---

## 4. How to Add Access Codes

You can add codes in **two easy ways**:

### Option A: Via Supabase Table Editor (GUI)
1. In the Supabase Dashboard, click **Table Editor** on the left menu.
2. Select the **`access_codes`** table.
3. Click **Insert row**:
   - `code`: Type your desired code (e.g. `FAMILY2026`, `VIP-AKIN`, `FROSH-MUSIC-99`).
   - `note`: Type a note (e.g. "For family members").
   - `is_active`: `true`.
4. Click **Save**.

### Option B: Via SQL Editor
Run a query anytime:
```sql
insert into public.access_codes (code, note)
values ('FAMILY2026', 'For my family');
```

*(Optional: If you prefer hashed storage, you can also set `code_hash = encode(digest(upper(btrim('MYCODE')), 'sha256'), 'hex')`)*

---

## 5. Email Confirmation (Recommended: OFF)

In **Authentication → Providers → Email**:
- Toggle **Confirm email** to **OFF** so approved users can sign up and immediately start listening to music without needing an email verification step.

---

## 6. How Persistent iPhone Home Screen (PWA) Login Works

When you tap **"Add to Home Screen"** on iOS Safari:
1. iOS creates a standalone app container with dedicated persistent storage (`localStorage` + HTTP cookies).
2. When you sign in once on your iPhone, Supabase sets persistent authentication cookies with a long-lived refresh token.
3. Every time you open the app from your Home Screen, Next.js Middleware checks your persistent session.
4. Supabase automatically refreshes tokens in the background, keeping you logged in permanently just like a native app.
