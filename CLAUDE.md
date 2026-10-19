# Siam Bean Co. Mini ERP

Read `docs/scenario.md` (the brief: it wins over everything else), `GLOSSARY.md` and `.scratch/mini-erp/spec.md` before changing behaviour.

- Backend: `backend/` (FastAPI + SQLAlchemy, `uv run pytest`, `uv run fastapi dev main.py`)
- Frontend: `frontend/` (React + TS + Vite, `npm run dev`, `npm run build`)
- Every business rule is enforced in the backend; write the failing test first.
- Never commit `.env` or paste secret keys into the chat.

## Agent skills

### Issue tracker

Local markdown under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
