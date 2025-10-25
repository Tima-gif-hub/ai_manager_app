# AI Manager App

Full-stack task management demo with a Django REST API (`server/`) and a React + Vite frontend (`frontend/`). The backend exposes authenticated JSON endpoints for tasks, AI history, and user management; the frontend consumes those contracts through a shared API client.

## Requirements

- Python 3.11
- Node.js 18+ and npm 9+
- Docker with Compose v2 (for PostgreSQL)

## Environment configuration

Create the following environment files before running the stack.

### `server/.env`

```
POSTGRES_DB="ai_task_manager_db"
POSTGRES_USER="postgres"
POSTGRES_PASSWORD="change-me"

PGHOST="localhost"
PGPORT="5432"
PGDATABASE="ai_task_manager_db"
PGUSER="postgres"
PGPASSWORD="change-me"

SECRET_KEY="replace-with-a-strong-secret"
DEBUG="True"
ALLOWED_HOSTS="localhost,127.0.0.1"

OPENAI_API_KEY=""
```

> Wrap values that contain special characters (`#`, `=`) in quotes so they are not parsed as comments.

### `frontend/.env`

```
VITE_API_URL="http://localhost:8000/api"
# Optional legacy override; normally the same as VITE_API_URL
VITE_API_BASE_URL="http://localhost:8000/api"
```

Supabase keys are no longer used. Remove the generated `frontend/.env` from Git with `git rm --cached frontend/.env` if necessary.

## Running the backend

1. Start PostgreSQL:
   ```sh
   cd server
   docker compose up -d
   ```
2. Create a virtual environment and install requirements:
   ```sh
   python -m venv .venv
   .venv\Scripts\activate  # PowerShell on Windows
   pip install -r requirements.txt
   ```
3. Apply migrations and run the API:
   ```sh
   python manage.py migrate
   python manage.py runserver 8000
   ```
4. Optionally seed an admin account:
   ```sh
   python manage.py createsuperuser
   ```

## Running the frontend

```
cd frontend
npm install
npm run dev -- --host
```

The development server listens on <http://localhost:5173/> and proxies requests to the Django API defined in `VITE_API_URL`.

## Quality and automation

- **Tests:** (from `server/`) `pytest`
- **Linters / formatters:** (from `server/`) `ruff check .`, `black .`, `isort .`
- **Frontend lint:** (from `frontend/`) `npm run lint`

Install and enable the pre-commit hooks for consistent formatting:

```
cd server
pip install pre-commit
pre-commit install
```

## API quick reference

All routes are rooted at `http://localhost:8000/api/`.

### Auth

- `POST /auth/register/` → `{email, password, name}` → `{access, refresh}`
- `POST /auth/login/` → `{email, password}` → `{access, refresh}`
- `GET /auth/me/` (Bearer) → `{id, email, name, profile: {name, avatarUrl, theme, language, aiResponseStyle}}`

### Tasks

- `GET /tasks/?status=todo&dueDate__lte=YYYY-MM-DD`
- `POST /tasks/` → `{title, description, dueDate, priority, status}`
- `PATCH /tasks/{id}/`
- `DELETE /tasks/{id}/`

### AI assistant

- `GET /ai/history/` → list `{id, title, query, response, createdAt}`
- `DELETE /ai/history/{id}/`
- `POST /ai/ask/` → `{message, tasks}` → `{response, historyId}`

Stop the database when finished:

```
cd server
docker compose down -v
```
