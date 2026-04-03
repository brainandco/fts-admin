/**
 * Bootstrap the first Super User.
 *
 * Option A: Run after creating a user in Supabase Auth (Dashboard or signup).
 *   Set FTS_BOOTSTRAP_SUPER_USER_TOKEN in .env.local and call this API once with
 *   that token and the user's email (or userId).
 *
 * Option B: Use Supabase SQL as postgres (Dashboard > SQL Editor):
 *   INSERT INTO public.users_profile (id, email, full_name, status, is_super_user)
 *   SELECT id, email, raw_user_meta_data->>'full_name', 'ACTIVE', true
 *   FROM auth.users WHERE email = 'your@email.com'
 *   ON CONFLICT (id) DO UPDATE SET is_super_user = true, status = 'ACTIVE';
 *
 * This script is a one-time CLI helper. The app also exposes POST /api/bootstrap
 * when FTS_BOOTSTRAP_SUPER_USER_TOKEN is set.
 */

export const BOOTSTRAP_DOC = `
Bootstrap first Super User:

1. Create a user in Supabase Auth (e.g. sign up at /register or create in Dashboard).
2. Either:
   A) Set FTS_BOOTSTRAP_SUPER_USER_TOKEN in .env.local, then POST /api/bootstrap with
      { "token": "<that token>", "email": "<user email>" }
   B) Run in Supabase SQL Editor (as postgres):
      UPDATE public.users_profile SET is_super_user = true, status = 'ACTIVE' WHERE id = (SELECT id FROM auth.users WHERE email = 'your@email.com');
`;
