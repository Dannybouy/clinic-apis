# Koya Clinic

A clinic appointment booking project built with React, Go, and PostgreSQL.

**Current stage:** the frontend, API, and Neon database are connected. The page lets you check that connection. Appointment booking comes next; assessment levels are not implemented yet.

## How the app fits together

```text
Patient's browser → React page → Go API → Neon PostgreSQL
```

| Folder or file | Purpose |
| --- | --- |
| `frontend/` | What a visitor sees, built with Vite, React, and TypeScript |
| `backend/api/` | HTTP endpoints and their tests |
| `backend/database/` | PostgreSQL connection |
| `backend/main.go` | Starts the Go server |
| `neon.ts` | Neon service configuration |
| `.github/workflows/ci.yml` | Automatic checks on GitHub |
| `render.yaml` | Hosting configuration for Render |

One repository, one npm lockfile. The Go module stays at the root so commands work from here. No monorepo framework is needed.

## Start locally

Requirements: Node 24, npm, and the Go version in `go.mod`. Docker is optional for local development.

Run all commands from this folder:

```sh
npm ci
go mod download
```

For a fresh checkout, connect the supplied Neon project:

```sh
npm i -g neon@latest
neon login
neon init -y --org-id org-gentle-scene-26598325 --project-id royal-fog-69570762 --branch production --services postgres
neon deploy
```

Complete sign-in in your browser. If global installation fails, use `npx neon@latest` instead of `neon`. Initialization may also install Neon plugins and skills for detected coding tools.

`neon deploy` provisions the services declared in `neon.ts` and pulls connection strings into `.env.local`, or `.env` if it already exists. PostgreSQL is the only requested service. The Go app runs separately from Neon.

```sh
npm run dev
```

Open [localhost:5173](http://localhost:5173) and choose **Check connection**. A successful check means the page reached Go, and Go reached PostgreSQL.

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts frontend and backend together |
| `npm run build` | Builds the frontend and Go executable |
| `npm start` | Runs the built app at localhost:8080 |
| `npm run lint` | Checks frontend code |
| `npm test` | Runs Go tests, including race detection |
| `npm run test:smoke` | Checks a running app through HTTP |

## The proxy

During development, Vite runs on port **5173**, and Go runs on **8080**. React requests relative paths such as `/api/health`. Vite forwards API requests to Go without changing the path. This also covers the assessment's future `/slots`, `/bookings`, and `/reset` routes.

After building, Go serves the React files and API from **one address**. No production proxy or browser CORS configuration is needed for that deployment. `vite preview` only previews frontend assets; use `npm start` to test the complete built app.

Set `PORT` in the root environment file to change Go's port; the development proxy follows it. `BACKEND_URL` optionally points the development proxy at another backend. The browser still uses relative URLs.

## Environment variables

| Variable | Used by | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Go | Pooled Neon connection for app requests |
| `DATABASE_URL_UNPOOLED` | Future migration commands | Direct connection for goose migrations |
| `NEON_BRANCH` | Neon CLI | Branch selected by Neon |
| `PORT` | Go and local proxy | Backend port, defaults to 8080 |
| `FRONTEND_DIST` | Go | Built frontend folder, defaults to `frontend/dist` |
| `BACKEND_URL` | Vite configuration | Optional development proxy target |
| `TEST_DATABASE_URL` | Tests | Separate PostgreSQL test database |

The backend reads existing environment variables first, then `.env.local`, then `.env`. Existing values win. `.env.example` documents placeholders; do not replace the real Neon file with it.

Real credentials stay out of Git and Docker images. No frontend environment variables are required. Anything named `VITE_*` is public browser configuration, so never put database credentials or API keys there. The future assessment API key will need its own access-control implementation.

This initial connection uses the requested `production` branch. Before implementing booking writes, use a separate development branch. Tests must use `TEST_DATABASE_URL`; they never automatically reuse `DATABASE_URL`.

## GitHub checks

Every pull request, push to `main`, or manual workflow run checks:

- Go formatting, static checks, tests, and race detection.
- A real PostgreSQL connection through an HTTP endpoint.
- Frontend lint, TypeScript checking, and production build.
- The built app's page, JavaScript, database connection, and handling of private files.
- Building and running the Docker container used for deployment.

GitHub starts a temporary PostgreSQL 17 database. It needs **no Neon credentials or repository secrets**. Locally, the database integration test skips unless `TEST_DATABASE_URL` is set.

Work on a branch, open a pull request, and merge after **App checks / Build and test** passes. Branch protection must also require that check if you want GitHub to block unverified merges.

## Deploy on Render

1. Connect this GitHub repository to Render as a Blueprint using `render.yaml`.
2. Supply the pooled `DATABASE_URL` from Neon as a secret environment variable in Render.
3. Render builds React and Go with the root Dockerfile. It supplies the server port automatically.
4. Verify the page and `/api/health` on the resulting HTTPS URL.

The Blueprint selects the free plan and deploys future changes after GitHub checks pass. `/healthz` checks that the server is running; `/api/health` also checks PostgreSQL. Render hosting has not been provisioned by the Neon setup.

The free Render service sleeps after 15 idle minutes, so its first request may take about a minute. [Render free hosting](https://render.com/docs/free).

## Current endpoints

| Request | Result |
| --- | --- |
| `GET /` | Built frontend |
| `GET /healthz` | Server health |
| `GET /api/health` | Server and database health |

The assessment's booking endpoints and database migrations will be added level by level. Health checks do not create patient records or change the database schema.

Connection choices follow [Neon's Go guide](https://neon.com/docs/guides/go): `pgx/v5`, a small connection pool, timeouts, and server-side credentials. The proxy follows [Vite's server configuration](https://vite.dev/config/server-options#server-proxy).
