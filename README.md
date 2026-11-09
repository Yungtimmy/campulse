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

- Any email can sign up. A 6-digit Supabase email OTP confirms it and joins the FUNAAB Room. Manual approve and revoke stay on the admin verifications page as a backup.
- `rejected` is a normal admin status and requires a reason.
- Problem burden is `min(100, 10 × Σ severity × confidence)`. It is not divided by a student or member count.
- Demo rows are stored with `is_demo`. Pulse ignores them unless `PULSE_INCLUDE_DEMO=true`.

The demo admin address is `admin@campulse.demo` in `bootstrap_admins`. Change that email to a real inbox before the first hosted sign-in if the demo address cannot receive mail. The role is granted when that address confirms a code.

There is no ranking between universities.
