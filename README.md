# Campulse

Campus problem reporting for one university Room. V1 is the FUNAAB Room: a student files a report, an admin changes its status, and the Campus Pulse score is a fixed formula.

## Stack

Next.js App Router, TypeScript, Tailwind, Supabase (Auth, Postgres, RLS, Storage), Groq, Vercel.

## Setup

```bash
npm install
cp .env.example .env.local
```

Set the variables in `.env.example`. `SUPABASE_SERVICE_ROLE_KEY` and `GROQ_API_KEY` stay on the server. Apply `supabase/migrations` to the Campulse Supabase project when it is linked. This repo does not apply them to a live database.

```bash
npm run dev
npm run test
npm run test:isolation   # fresh local Postgres, including the cross-university check
npm run typecheck
npm run lint
npm run build
```

## Locked behaviour

- Sign-in is Google only. Any Google account (Gmail or Workspace) can start. First-time users fill a short profile on `/register` and then join the FUNAAB Room. Email OTP is not used. There is no admin sign-in link on the public pages.
- The admin screens are at `/teblad` (and `/teblad/<room>`). `/admin` and every path under it return the same 404 as any other missing page. A signed-out visitor or a student who requests `/teblad` gets that 404 too. The app does not redirect those requests to sign-in.
- The Room tab bar adds an Admin tab only when the server session has an `admin_roles` row (`university_admin` or `super_admin`). Students and signed-out visitors do not receive the tab or that path. `bootstrap_admins` grants the role when that email becomes a verified member.
- Manual approve and revoke stay on the admin verifications page. Revoke still closes the Room for that account. RLS and the security-definer functions still require an admin role for admin data and status changes.
- `rejected` is a normal admin status and requires a reason.
- Problem burden is `min(100, 10 × Σ severity × confidence)`. It is not divided by a student or member count.
- Demo rows are stored with `is_demo`. Pulse ignores them unless `PULSE_INCLUDE_DEMO=true`.

## Google sign-in (hosted Supabase)

1. In Google Cloud, create an OAuth client and set the authorized redirect URI to `https://rdgkvosixhfzslgdneiw.supabase.co/auth/v1/callback`.
2. In the Supabase dashboard, enable the Google provider and paste that client ID and secret.
3. Add this app's origin and `/auth/callback` to Supabase Auth redirect URLs.
4. Put the founder's Gmail in `public.bootstrap_admins` before they submit the registration form. The local demo row is `admin@campulse.demo`. On the hosted project, change that email or add a row for the real Gmail. The FUNAAB admin role is granted when that address becomes a verified member (when they finish registration, or on a later sign-in if the row is added after). They sign in with Google on `/signin`, then open `/teblad`.

Faculty and department options live in `lib/campus.ts`. They are demo placeholders until the real FUNAAB list is dropped in.

There is no ranking between universities.
