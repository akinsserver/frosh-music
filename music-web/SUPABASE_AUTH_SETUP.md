# Frosh Music — Supabase Auth, Access Codes & Profiles Setup

Frosh Music uses Supabase Auth with an **Access Code Gate** and automatic **User Profiles**.

---

## 1. Database Schema

Your Supabase project has two primary tables in the `public` schema:

| Table | Purpose |
|---|---|
| **`access_codes`** | The single table where all invite/access codes live. Secured with Row Level Security (RLS). |
| **`profiles`** | User profiles automatically populated whenever an approved user registers. Displays their email, display name, and the access code used. |

---

## 2. Managing Access Codes

You can add or revoke access codes directly from your Supabase Dashboard:

### Add a New Access Code (Table Editor)
1. Go to **Supabase Dashboard → Table Editor → `access_codes`**.
2. Click **Insert row**:
   - `code`: Type your code (e.g. `FAMILY2026`, `VIP-AKIN`, `FROSH-2026`).
   - `note`: Optional memo (e.g. *"For family members"*).
   - `is_active`: `true`.
3. Click **Save**.

### Revoke an Access Code
To stop allowing signups with a code without deleting it:
- Set `is_active = false` for that row in the `access_codes` table.

---

## 3. Viewing Registered Users

When someone signs up on the website:
1. They enter an active code from `access_codes`.
2. They enter an email and password.
3. Supabase Auth creates the account in `auth.users`.
4. A Postgres database trigger automatically inserts a record into **`public.profiles`**:
   - `id`: User UUID
   - `email`: User email address
   - `display_name`: Display name / username
   - `access_code_used`: The code they used to register
   - `created_at`: Registration timestamp

You can view all registered users at any time in **Supabase Dashboard → Table Editor → `profiles`**.

---

## 4. Environment Variables

### Local (`music-web/.env.local`)
```env
NEXT_PUBLIC_SUPABASE_URL=https://vrptquuiuiklaekvnzzo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
```

### Production (Vercel)
Add the same two variables in your Vercel project under **Settings → Environment Variables**, then redeploy.
