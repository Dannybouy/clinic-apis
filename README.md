# Koya Clinic

A clinic appointment booking project built with React, Go, and PostgreSQL.

**Current stage:** all five assessment levels are implemented. The page at `/` is a booking app with a built-in API inspector and a checklist that exercises each level against the live API.

## Reviewing this project

Live site: <https://clinic-apis.onrender.com>. It runs on Render's free plan, so the first request after a quiet spell can take about a minute while the server wakes up. The dot in the header turns green once the server and database answer.

1. Open **Demo controls → Load sample schedule**. This replaces all slots and deletes every booking in the shared demo, then loads 4 doctors over the next 5 weekdays plus one slot from yesterday.
2. Book a slot from **Find a slot**, then open **My bookings**.
3. In **Demo controls**, choose **Run all** to check every scenario below. Each scenario uses its own random email, so the rate limit never interferes between them.

| Spec level | Where it shows up in the UI | Scenario |
| --- | --- | --- |
| Level 1: booking succeeds with 201 | Booking dialog | 1 |
| Level 2: validation, 404, slot already started, trimming and lowercasing | Booking dialog errors, **Started** badge | 5, 6, 7 |
| Level 3: 409, including under concurrency | **Booked** badge, booking dialog error | 1, 2 |
| Level 4: `Idempotency-Key`, replay and 422 | Every booking from the dialog sends a key | 3, 4 |
| Level 5: rate limit, 429 with `Retry-After` | Booking dialog message | 10 |
| List, pagination, find by ID, cancel | **My bookings** tab (page size, **Load more**, **Find a booking by ID**, **Cancel**) | 8, 9, 11 |

The **API inspector** (right-hand panel on desktop, **Inspector** button on mobile) logs every request the page makes: method, URL, status, timing, request and response headers such as `Idempotency-Key` and `Retry-After`, and both bodies. **Copy as curl** on any entry reproduces that request from a terminal.

## How the app fits together

```text
Patient's browser → React page → Go API → Neon PostgreSQL
```

| Folder or file | Purpose |
| --- | --- |
| `frontend/` | What a visitor sees, built with Vite, React, TypeScript, Tailwind, and shadcn/ui |
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

Open [localhost:5173](http://localhost:5173). A green dot in the header means the page reached Go, and Go reached PostgreSQL. **Load sample schedule** wipes slots and bookings, so point `DATABASE_URL` at a throwaway database such as `clinic_test` before using it locally.

| Command | What it does |
| --- | --- |
| `npm run dev` | Starts frontend and backend together |
| `npm run build` | Builds the frontend and Go executable |
| `npm start` | Runs the built app at localhost:8080 |
| `npm run lint` | Checks frontend code |
| `npm test` | Loads local settings, then runs Go tests and race detection |
| `npm run db:generate` | Regenerates Go database code from SQL |
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
| `API_KEY` | Go | Value callers send in the `X-API-Key` header |

The backend reads existing environment variables first, then `.env.local`, then `.env`. Existing values win. `.env.example` documents placeholders; do not replace the real Neon file with it.

Real credentials stay out of Git and Docker images. No frontend environment variables are required. Anything named `VITE_*` is public browser configuration, so never put database credentials there. `API_KEY` is the assessment key you choose. The page reads it from the server and sends it back as `X-API-Key`.

Local development uses `clinic_dev`, and integration tests use `clinic_test`. Set the local connection strings in `.env.local`; the original Neon configuration can be kept separately in the ignored `.env.neon.local` file. Render continues to use its own Neon environment variable. Tests must use `TEST_DATABASE_URL`; they never automatically reuse `DATABASE_URL`.

Running `neon deploy` pulls the linked branch's credentials into the local environment file again. Check the database target before continuing local development after that command.

## Local schema and queries

Goose applies the versioned SQL files in `backend/database/schema/`. sqlc reads those same files plus `backend/database/queries/`, then writes Go code into `backend/internal/database/`. Do not edit generated files.

After setting these variables to your local databases, apply migrations to both databases:

```sh
export DATABASE_URL_UNPOOLED='postgresql://YOUR_LOCAL_USER@127.0.0.1:5432/clinic_dev?sslmode=disable'
export TEST_DATABASE_URL='postgresql://YOUR_LOCAL_USER@127.0.0.1:5432/clinic_test?sslmode=disable'
GOOSE_DRIVER=postgres GOOSE_DBSTRING="$DATABASE_URL_UNPOOLED" goose -dir backend/database/schema up
GOOSE_DRIVER=postgres GOOSE_DBSTRING="$TEST_DATABASE_URL" goose -dir backend/database/schema up
npm run db:generate
npm test
```

Replace `YOUR_LOCAL_USER` with your PostgreSQL role. These commands use exported values; a shell does not automatically load `.env.local`.

Migration `001` stays unchanged because it was already applied locally. Migration `002` accepts string slot IDs and timezone-aware timestamps, treating original timestamps as UTC. Migration `003` adds bookings so availability can be calculated. Reverting migration `002` requires all remaining slot IDs to be valid UUIDs; production schema changes should normally move forward with new migrations.

Slot tests use temporary tables copied from the migrated schema and roll back their fixtures. Existing development and test records are not cleared.

## GitHub checks

Every pull request, push to `main`, or manual workflow run checks:

- Go formatting, static checks, tests, and race detection.
- Applying migrations and checking generated sqlc code.
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

Before deploying code that reads slots, apply the schema migrations to Neon using its direct `DATABASE_URL_UNPOOLED` connection. The Docker image does not run goose automatically. `neon deploy` does not apply these SQL migrations.

The Blueprint selects the free plan and deploys future changes after GitHub checks pass. `/healthz` checks that the server is running; `/api/health` also checks PostgreSQL. Render hosting has not been provisioned by the Neon setup.

The free Render service sleeps after 15 idle minutes, so its first request may take about a minute. [Render free hosting](https://render.com/docs/free).

## Current endpoints

| Request | Result |
| --- | --- |
| `GET /` | Built frontend |
| `GET /healthz` | Server health |
| `GET /api/health` | Server and database health |
| `GET /slots` | Every slot, ordered by start time |
| `GET /slots?provider=Dr%20Ade` | Slots for exactly this provider |

The slots response is `{"slots":[...]}`. Each entry contains `id`, `provider`, `start`, `end`, and `available`. Missing provider means all providers; a supplied provider matches exactly, including its case and whitespace. No matching slots returns `{"slots":[]}`.

The [assessment contract](https://koyaacademy.com/assessment-api) includes past and booked slots in this response. `available` is false only while a confirmed booking exists. Cancelled bookings do not block a slot. The already-started check belongs to creating a booking, not listing slots.

With `npm run dev` running, test through the frontend proxy:

```sh
curl --get --data-urlencode 'provider=Dr Ade' http://127.0.0.1:5173/slots
```

`/slots`, `/bookings`, and `/reset` require the `X-API-Key` header. A missing or wrong key returns 401 with `{"error":"invalid API key"}`. Health checks and the web page do not. The page loads the key from `GET /api/config`, then sends it on later requests.

Connection choices follow [Neon's Go guide](https://neon.com/docs/guides/go): `pgx/v5`, a small connection pool, timeouts, and server-side credentials. The proxy follows [Vite's server configuration](https://vite.dev/config/server-options#server-proxy).
