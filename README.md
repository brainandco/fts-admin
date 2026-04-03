# FTS Admin Portal

Admin portal for Fast Tech Solutions (FTS). Built with Next.js (App Router), TypeScript, Supabase (Postgres + Auth), and TailwindCSS.

**If login or register is not working:** see **[AUTH_SETUP.md](./AUTH_SETUP.md)** for the exact Supabase settings and checklist.

**Scope:** Admin portal only. Employee portal will be built later; database and RBAC are designed to support both.

**Domain (for deployment):** `admin.fts-ksa.com` (this app). Supabase handles DB + Auth.

---

## Local setup

### 1. Install dependencies

```bash
cd fts-admin
npm install
```

### 2. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. In **Project Settings > API**: copy **Project URL** and **anon public** key.
3. Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Run database setup

In Supabase Dashboard go to **SQL Editor** → **New query**, then run the **entire** file:

- **`supabase/FTS_COMPLETE_SETUP.sql`**

This creates all tables, triggers, seed data, and RLS. It also defines the **first-super-user** rule: the **first person to register** is automatically made Super User + ACTIVE (no permissions or approval needed) and can access the dashboard right away.

### 4. First Super User (no approval needed)

- **First user ever:** Register at `/register`. The trigger in the DB makes that user Super User + ACTIVE automatically. They can log in at `/login` and access the dashboard immediately (no roles/permissions are required for Super User).
- **Every other user:** After registering they stay **PENDING_ACCESS**. The first super user (or any admin) must approve them from the dashboard: **Users** → open the user → set **Status** to **Active**, assign **Region**, **Roles**, and **Reports to** → save. Only then can that user log in and access the portal.

**If you already have data:** To promote an existing user to Super User manually, run in SQL Editor:

```sql
UPDATE public.users_profile
SET is_super_user = true, status = 'ACTIVE'
WHERE id = (SELECT id FROM auth.users WHERE email = 'admin@fts-ksa.com');
```

### 5. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Register the first user (they become Super User automatically), then sign in to access the dashboard. Approve all other users from **Users**.

---

## Deployment

- **App:** Deploy to Vercel (or any Node host). Set env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Optional: `NEXT_PUBLIC_APP_URL` for redirects.
- **Domain:** Point `admin.fts-ksa.com` to the deployed app.
- **Supabase:** Use the same project; ensure production URL and anon key are set in the host env.

---

## Module overview

| Module            | Description                                      |
|-------------------|--------------------------------------------------|
| **Auth**          | Supabase email/password; access gate (pending/active). |
| **Dashboard**     | Stats: employees, assets, vehicles, approvals, tasks, maintenance. Region filter for PMs. |
| **Regions**       | CRUD; assign Regional PM (with history).         |
| **Projects**      | Per region, type MS/Rollout; assign PM.          |
| **Teams**         | Per project; add/remove members.                 |
| **Users**         | List, edit status/region/roles/reports-to; Super User creation (Super Users only). |
| **Tasks**         | Admin → PM → Team; status workflow; comments; history. |
| **Approvals**     | Generic requests (leave, asset, vehicle, etc.); PM then Admin flow. |
| **Assets**        | Devices/equipment; assign/return; maintenance flag. |
| **Vehicles**      | Vehicle-specific fields; maintenance logs.      |
| **Audit logs**    | Filters and CSV export.                         |
| **Settings**      | Roles & permissions (view).                      |

---

## RBAC (roles and permissions)

- **Super User:** Full access; only Super Users can create other Super Users.
- **Administrator:** All operational permissions (seeded in `00006`).
- **Regional PM:** Region-scoped (RLS + same permission codes, data filtered by region).
- **Admin Staff:** Limited set (view users, tasks, assets, approvals, audit).

Permissions are stored in `permissions`; role–permission mapping in `role_permissions`; user–role in `user_roles`. Optional overrides in `user_permission_overrides`. RLS enforces access.

---

## Audit

All important actions write to `audit_logs` (actor, entity_type, entity_id, old/new value, description). Detail pages show an “History” section for that entity.

---

## License

Private – Fast Tech Solutions.
