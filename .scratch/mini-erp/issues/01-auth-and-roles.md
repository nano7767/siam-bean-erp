# 01 Auth and roles (US-3)

**Module:** Login and dashboard · **Owner:** _fill in_ · **Status:** done

## What
Log in with Supabase Auth (email + password) through `POST /auth/login`. Every other endpoint reads the Bearer token, loads the user's row in `users` and checks the role. Wrong role → 403 with a message naming the role.

## Acceptance
- [x] Login with a wrong password returns 401 "Wrong email or password"
- [x] No token → 401, unknown or deactivated user → 403
- [x] Warehouse calling `POST /orders/{id}/confirm` → 403
- [x] Sales calling `GET /payments` (Accounting) → 403; Admin → 200
- [x] Frontend shows an access-denied page when the API returns 403

## Tests
`tests/test_roles.py`
