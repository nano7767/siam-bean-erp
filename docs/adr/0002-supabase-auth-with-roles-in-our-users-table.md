# 0002 Supabase Auth for passwords, roles in our own `users` table

**Status:** accepted

## Context
US-3 needs four roles enforced on the server. The course says: use Supabase Auth, never write our own password hashing.

## Decision
- Supabase Auth stores emails and passwords. The backend proxies `POST /auth/login` and `/auth/refresh` to Supabase, so the frontend needs no Supabase key at all.
- Every request carries `Authorization: Bearer <access token>`. The backend asks Supabase who owns the token (cached 60 s), then loads that id from `users` to get `company_id`, `role` and `active`.
- Each endpoint declares its roles with `Depends(require("admin", "sales"))`; any other role gets 403 before the handler runs.
- RLS is enabled on every table with no policy: only FastAPI (direct Postgres connection) can read the data.

## Consequences
- Hiding a button is never the protection; the permission matrix in the spec is tested cell by cell (`tests/test_roles.py`).
- Admin creates staff from the Users screen, which calls the Supabase admin API with the secret key.
