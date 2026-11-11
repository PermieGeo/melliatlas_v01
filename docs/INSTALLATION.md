# Installation and Local Development

MelliAtlas consists of two React/Vite applications, a Node.js API, shared TypeScript contracts, and a PostgreSQL/PostGIS database. For local development, **the database runs in Docker; the API and two frontends run on your computer**. The root `pnpm dev` command starts all three applications.

This guide covers macOS (Intel and Apple Silicon), Windows with WSL 2 (recommended), and native Windows PowerShell. For Linux, follow the WSL terminal steps with a working Docker Engine and Compose plugin.

## Quick start: existing macOS/Linux/WSL installation

Use this if Node.js 22, pnpm 11.25.0, Docker, and repository dependencies are already installed. Run commands **from the MelliAtlas repository root** (the directory containing `package.json` and `compose.yaml`):

```bash
cd /path/to/melliatlas
nvm use 22                         # Only if Node.js is managed by NVM
docker compose up -d db
pnpm db:migrate                    # First launch or after a new migration
pnpm dev
```

The `apps/api/.env` file must already exist and point to the database on host port `5433`. For the first installation, follow the platform instructions below; they include `pnpm install --frozen-lockfile` and environment-file creation. Open the local URL printed by Vite (normally `http://localhost:5173`) and check `http://127.0.0.1:3001/health/ready` in another terminal. `Ctrl+C` stops the three development servers but leaves the database running.

**Only configuring the external treatment provider?** The map/weather view does not need a token. The separate local administrator frontend at `http://127.0.0.1:5174` needs no token in this localhost-only slice; saving settings does not fetch. Explicit import fetches one batch. Valid structured pending polygons also appear on the beekeeper map with an unverified label; administrator-only evidence and review actions remain separate. See [CONFIGURATION](CONFIGURATION.md) and [USAGE](USAGE.md).

## Requirements and ports

| Requirement        | Version / role                                                          |
| ------------------ | ----------------------------------------------------------------------- |
| Node.js            | 22 or newer; use Node.js 22 for the documented setup                    |
| pnpm               | 11.25.0, pinned by the repository                                       |
| Docker             | Running Docker engine with the Compose plugin                           |
| PostgreSQL/PostGIS | Provided by `postgis/postgis:16-3.4` in `compose.yaml`                  |
| Internet           | Dependency downloads, OpenStreetMap tiles, and live Open-Meteo requests |

| Address                 | Service      | Notes                                                                                   |
| ----------------------- | ------------ | --------------------------------------------------------------------------------------- |
| `http://localhost:5173` | Beekeeper UI | Public/read-only map, forecast and source-attributed treatment plans with review status |
| `http://localhost:5174` | Admin UI     | Local-only source settings, import, evidence review                                     |
| `http://127.0.0.1:3001` | API          | Vite forwards `/api` requests here                                                      |
| `127.0.0.1:5433`        | PostgreSQL   | Host port; Docker container internally uses 5432                                        |

Do not run an additional API process alongside the root `pnpm dev` command: it already starts `@melliatlas/api`, `@melliatlas/web` and `@melliatlas/admin`.

## macOS: first-time setup

### 1. Install Node.js 22

**Recommended: NVM.** It allows different projects to use different Node.js versions without replacing an existing installation.

1. Check whether NVM is already available: `command -v nvm`.
2. If absent, install it using the [official NVM instructions](https://github.com/nvm-sh/nvm#installing-and-updating), then reopen the terminal.
3. Run:

```bash
nvm install 22
nvm use 22
node --version
npm --version
```

An existing Node.js 20 installation can remain installed. For an alternative without NVM, use the macOS installer from the [official Node.js 22 download archive](https://nodejs.org/en/download/archive/v22) and select the package appropriate for the Mac architecture.

**Intel Mac note:** On some Homebrew configurations, `brew install node@22` builds dependencies such as Python from source and may take a long time. If Node.js is already managed by NVM, install Node.js 22 through NVM instead; Homebrew is not required for Node.js.

### 2. Install pnpm 11

```bash
npm install -g pnpm@11.25.0
pnpm --version
```

Keep pnpm 11 for this repository. A notice offering pnpm 12 is informational, not an instruction to upgrade.

### 3. Start Docker

Install and launch [Docker Desktop for Mac](https://docs.docker.com/desktop/setup/install/mac-install/). If you already use a Compose-compatible alternative such as Colima, start it with `colima start` and verify that its Docker CLI and Compose plugin work.

```bash
docker info
docker compose version
```

Both commands must succeed before starting the database.

### 4. Prepare the repository

Open a terminal in the MelliAtlas repository root (the directory containing `package.json` and `compose.yaml`):

```bash
cd /path/to/melliatlas
nvm use 22
pnpm install --frozen-lockfile
```

The `nvm use 22` step is needed only when using NVM. If pnpm reports blocked `esbuild` build scripts, see [dependency diagnostics](DIAGNOSTIC.md#blocked-pnpm-dependency-builds).

Continue with [Database, configuration, and first launch](#database-configuration-and-first-launch).

## Windows: recommended WSL 2 setup

WSL 2 provides a Linux development shell on Windows. This is the recommended Windows path because the same shell commands apply to local macOS/Linux development.

### 1. Install WSL 2 and Ubuntu

Open **PowerShell as Administrator**:

```powershell
wsl --install -d Ubuntu
```

Restart Windows if prompted, open Ubuntu, and finish the initial Linux user setup. Verify from PowerShell:

```powershell
wsl --list --verbose
```

Ubuntu should show WSL version **2**. See [Microsoft's WSL setup guide](https://learn.microsoft.com/windows/wsl/install) if installation or virtualization fails.

### 2. Install Docker Desktop with WSL integration

Install [Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/) and select the **WSL 2 backend**. Start Docker Desktop; in **Settings → Resources → WSL Integration**, enable the Ubuntu distribution if needed.

Run the following **inside the Ubuntu terminal**, not PowerShell:

```bash
docker info
docker compose version
```

If the Docker CLI cannot reach the daemon, check that Docker Desktop is running and WSL integration is enabled. Follow the [Docker WSL 2 guidance](https://docs.docker.com/desktop/features/wsl/).

### 3. Install Node.js and pnpm inside Ubuntu

Install NVM **inside Ubuntu**, following its [official Linux instructions](https://github.com/nvm-sh/nvm#installing-and-updating). A Windows Node.js installation is not a substitute for the Ubuntu runtime.

```bash
nvm install 22
nvm use 22
npm install -g pnpm@11.25.0
node --version
pnpm --version
```

Clone or place the repository in the **WSL Linux filesystem**, for example `~/work/melliatlas`; avoid using `/mnt/c/...` for active development because filesystem performance and watch behavior can differ.

```bash
cd ~/work/melliatlas
pnpm install --frozen-lockfile
```

Continue with [Database, configuration, and first launch](#database-configuration-and-first-launch). Run those Bash commands from Ubuntu. Open the web UI from a Windows browser at `http://127.0.0.1:5173`.

## Windows: native PowerShell alternative

WSL 2 is recommended, but the application can also run directly in Windows PowerShell.

1. Install the **Windows Node.js 22 MSI** from the [official Node.js 22 download archive](https://nodejs.org/en/download/archive/v22). Open a new PowerShell terminal after installation.
2. Install and start Docker Desktop using **Linux containers**.
3. Open PowerShell in the repository root and run:

```powershell
node --version
npm --version
npm install -g pnpm@11.25.0
pnpm --version
docker info
docker compose version
pnpm install --frozen-lockfile
```

Use the PowerShell copy command in the next section instead of Bash `cp`. Do not run Windows and WSL copies of the API simultaneously on the same ports.

## Database, configuration, and first launch

Run these steps from the **repository root**, after installing packages and starting Docker.

### 1. Start PostGIS

```bash
docker compose up -d db
docker compose ps
```

Wait for `melliatlas-db-1` (or the equivalent Compose service name) to become `healthy`. The service is `db`, exposed to applications on the host at `127.0.0.1:5433`.

The database log may show a temporary server shutdown and restart while PostGIS initializes; that is normal when the final status is `ready to accept connections` and Compose reports `healthy`.

### 2. Create the API environment file

**macOS, Linux, or WSL:**

```bash
cp apps/api/.env.example apps/api/.env
```

**Native Windows PowerShell:**

```powershell
Copy-Item apps/api/.env.example apps/api/.env
```

These commands are for **first-time setup**. Do not overwrite an existing `apps/api/.env` that contains valid local settings.

These are the expected local-development values based on the API configuration and `compose.yaml`; review the actual example before making changes:

```dotenv
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://melliatlas:local_development_only@127.0.0.1:5433/melliatlas
OPEN_METEO_TIMEOUT_MS=8000
# No administrator token is needed for localhost-only provider settings.
```

The default database password is **local-only**. If `POSTGRES_PASSWORD` was overridden when the Docker database was first initialized, update the password in `DATABASE_URL` accordingly. Docker does not automatically replace the password of an already-initialized persistent database when that environment variable changes.

The API loads `apps/api/.env` through `dotenv`. The source editor no longer requires `SOURCE_OPERATOR_TOKEN`: its administrative API binds to `127.0.0.1`. Do not expose it via a public reverse proxy. See [CONFIGURATION](CONFIGURATION.md) for deployment boundaries.

### 3. Apply database migrations

```bash
pnpm db:migrate
```

The root command builds the shared contracts and runs the API's checksummed SQL migrations. Run it before the first API launch and after pulling updates that introduce new migrations. Do not edit historical SQL migrations that have already been applied.

### 4. Initialize the reference treatment provider (optional)

After migrations, populate the existing `source_catalog` row using the repository-owned preset:

```bash
pnpm provider:seed:saturn
```

This loads `apps/api/config/providers/fgis-saturn.json`: provider name, `treatment` type, full HTTPS endpoint, `POST` request settings and **no external API key** (`api_key` is SQL `NULL`). It does not contact the provider or import treatment plans. The reference endpoint and region filter are taken from the historical prototype and are **not independently verified** for automated collection.

The command is repeatable. It preserves operator-modified settings. To intentionally reset to the preset, use `pnpm --dir apps/api provider:seed config/providers/fgis-saturn.json --replace`; this clears associated credentials and pagination state. See [Usage](USAGE.md#local-operator-workflow).

### 5. Start API and both frontends

```bash
pnpm dev
```

Leave this terminal running. The root script builds `@melliatlas/contracts` and launches the API, beekeeper Web and local Admin development servers.

Open the **Local** URL printed by Vite (normally **http://localhost:5173**) in a browser. The API listens on port 3001. Its readiness endpoints are:

```bash
curl -i http://127.0.0.1:3001/health/live
curl -i http://127.0.0.1:3001/health/ready
```

Both should return HTTP 200 when the API and database are available. In PowerShell, use `curl.exe` instead of `curl` if the shell maps `curl` to a different command.

### 6. Stop and restart

- Stop the development servers with **Ctrl+C** in the `pnpm dev` terminal.
- Stop only the database container with `docker compose stop db`. This preserves its volume.
- To restart later: open the repository root, select Node.js 22 if using NVM, run `docker compose up -d db`, then `pnpm dev`.
- After receiving a repository update, run `pnpm install --frozen-lockfile` if `pnpm-lock.yaml` or dependencies changed, and `pnpm db:migrate` if a new SQL migration was introduced (the current source history includes migrations `001` through `015`).
- Do **not** use `docker compose down -v` during routine shutdown: the `-v` option removes the database volume and its data.

`pnpm install`, environment-file creation, and migrations are not required on every normal restart. Never re-copy `.env.example` over an existing `.env` merely to restart.

## Next steps

See [Usage](USAGE.md) for beekeeper/operator workflows, demo data and maintenance commands, [Tests](TESTS.md) for Playwright and the canonical test runner, and [Diagnostics](DIAGNOSTIC.md) for installation or runtime errors. Python 3 is needed for repository validation scripts but not to run MelliAtlas itself.

## Deployment boundary

These steps configure a **local development environment**, not a production deployment. The Compose file supplies only a local PostGIS database; it is not a production stack. Production hosting requires managed secrets, HTTPS, persistent backups, explicit network controls, and deployment-specific health monitoring. Do not expose private apiary coordinates or local database credentials. See [ARCHITECTURE](ARCHITECTURE.md) and [CONFIGURATION](CONFIGURATION.md) for service boundaries.
