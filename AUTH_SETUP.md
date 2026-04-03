# Auth setup â€“ what you need to do

Simple flow: **Register** â†’ youâ€™re in. **Sign in** â†’ dashboard. No email confirmation if you turn it off in Supabase.

---

## Why â€œprofileâ€ when Iâ€™m already in Authentication?

- **Supabase Authentication** stores **who you are** (email, password) in `auth.users`. Thatâ€™s your login.
- This app also has a **`users_profile`** table for **app data** (name, access, roles). When you **register**, we create both: your auth user and your profile row. So after register you can sign in and use the dashboard. There is no separate â€œensure profileâ€ step for youâ€”if a profile is ever missing (e.g. trigger didnâ€™t run), the app creates it automatically when you open the dashboard.

---

## 1. Supabase project and env

1. [Supabase Dashboard](https://supabase.com/dashboard) â†’ your project â†’ **Project Settings** â†’ **API**.
2. Copy **Project URL** and **anon public** key.
3. In the app root, create **`.env.local`**:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

4. Restart dev server: `npm run dev`.

---

## 2. Auth URLs (required)

1. Supabase â†’ **Authentication** â†’ **URL Configuration**.
2. **Site URL:** `http://localhost:3000` (or your app URL).
3. **Redirect URLs:** add `http://localhost:3000`, `http://localhost:3000/**`, and `http://localhost:3000/reset-password`.

---

## 3. No email confirmation (simple login)

1. Supabase â†’ **Authentication** â†’ **Providers** â†’ **Email**.
2. Turn **off** â€œConfirm emailâ€.
3. Then: register once â†’ youâ€™re logged in; next time use **Sign in** with the same email and password.

---

## 4. Database

1. Supabase â†’ **SQL Editor** â†’ run the full **`supabase/FTS_COMPLETE_SETUP.sql`** once.
2. Optional: run **`supabase/seed_super_role.sql`** for the Super role.

---

## 5. Test

1. Open `http://localhost:3000/register` â†’ enter email, password, name â†’ **Register** â†’ you should land on the dashboard.
2. **Sign out** â†’ go to **Sign in** â†’ same email and password â†’ dashboard again.

If you get â€œInvalid login credentialsâ€, check **Authentication** â†’ **Users**. If youâ€™re sent back to login after signing in, check **Site URL** and **Redirect URLs** and that `.env.local` matches the project and you restarted the server.

