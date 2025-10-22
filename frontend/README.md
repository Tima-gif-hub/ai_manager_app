# DO Smart AI – Monorepo

This repository now contains both the React front-end (`do-smart-ai/`) and the Django back-end (`server/`). The apps communicate over a JSON REST API secured with JWT access/refresh tokens.

## Requirements

- Node.js 18+
- npm 9+
- Python 3.11+ with `pip`
- PostgreSQL (for local development you can reuse any existing instance)

## Environment variables

### Front-end (`do-smart-ai/.env`)

```
VITE_API_BASE_URL="http://localhost:8000/api"
```

> Copy `do-smart-ai/.env.example` if you need a starter file. The Supabase keys are no longer used.

### Back-end (`server/.env`)

Use `server/.env.example` as a template. You need a valid `SECRET_KEY` and database credentials. Example:

```
PGHOST=localhost
PGPORT=5432
PGDATABASE=postgres
PGUSER=postgres
PGPASSWORD=postgres
SECRET_KEY=change-me
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
```

## Local development

Run the back-end first (from `server/`):

```sh
python -m venv .venv
.venv\Scripts\activate  # or source .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 8000
```

Then start the front-end (from `do-smart-ai/`):

```sh
npm install
npm run dev
```

The React app will proxy API calls to `http://localhost:8000/api`.

## Repository layout

```
AI Task manager/
├── do-smart-ai/   # Vite + React front-end
└── server/        # Django REST back-end
```

If your Git repository currently lives inside `do-smart-ai/.git`, run these commands from `AI Task manager/` to move the root up one level so both apps are tracked together:

1. `cd do-smart-ai`
2. `git status` (make sure there are no uncommitted changes)
3. Move the `.git` directory to the parent folder  
   - PowerShell: `Move-Item .git ..\`  
   - macOS/Linux: `mv .git ..`
4. `cd ..`
5. `git config core.worktree "."`
6. `git status`

Alternatively, initialize a new repository in `AI Task manager/` and add both directories.

## Available API routes

- `POST /api/auth/register/` – create an account and receive tokens
- `POST /api/auth/login/` – obtain tokens
- `POST /api/auth/logout/` – revoke the refresh token
- `GET /api/auth/me/` – current user profile
- `GET|POST|PATCH|DELETE /api/tasks/` – CRUD for tasks (authenticated)
- `GET|POST|DELETE /api/ai-history/` – AI assistant history
- `GET|PUT /api/profile/` – profile details (name, avatar)
- `GET|PUT /api/settings/` – theme, AI style, language preferences

All endpoints expect and return JSON. Supply the access token via `Authorization: Bearer <token>`.
