# 0003 Deploy on Vercel instead of Cloudflare Workers

**Status:** accepted

## Context
The course recommends Cloudflare Workers and lists Vercel and Google Cloud Run as alternatives. Python Workers run on Pyodide, have a 10 ms CPU limit on the free plan, and cannot load native packages such as `psycopg`, which we need for real Postgres transactions and row locks (ADR 0001).

## Decision
Deploy both parts on Vercel, as in our CU FDE2 Kanban project: the backend as a FastAPI project (`backend/main.py`), the frontend as a Vite static site with an SPA rewrite.

## Consequences
- No code changes between local and production; secrets are Vercel environment variables.
- The backend connects through Supabase's transaction pooler (port 6543), with prepared statements off.
