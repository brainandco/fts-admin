# Admin portal – Node.js production build

After `npm run build`, the deployable standalone output is:

**Folder:** `fts-admin/.next/standalone/`

To get a **complete** deployable folder (e.g. for HosterPK):

1. Build: `npm run build`
2. Copy static assets and public:
   - Copy `fts-admin/.next/static` → `fts-admin/.next/standalone/.next/static`
   - Copy `fts-admin/public` → `fts-admin/.next/standalone/public` (if it exists)

Then upload the **contents** of `fts-admin/.next/standalone/` (or the whole `standalone` folder) and run:
`node server.js`
(Port is 3000 by default; set `PORT` env if needed.)

Environment variables must be set where you run `server.js`.
