# Installation

MelliAtlas runs as a responsive web application plus a Node.js API with PostgreSQL/PostGIS. The supported local development path is **Node.js 22+, pnpm 11, and Docker Compose**. Internet access is needed to download packages, fetch OpenStreetMap tiles and request Open-Meteo data.

## Platform setup

| Platform                       | Install and verify                                                                                                  | Notes                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| macOS (Apple Silicon or Intel) | Install Node.js 22, enable Corepack/pnpm 11, and install Docker Desktop or an equivalent Compose-compatible engine. | Both applications run directly on macOS; PostgreSQL runs in a container.                               |
| Linux (x86-64 or ARM64)        | Install Node.js 22, pnpm 11, Docker Engine and the Compose plugin.                                                  | Docker daemon access must work without requiring changes to project files.                             |
| Windows 11/10                  | Recommended: Docker Desktop with WSL 2 and a Linux distribution; install Node.js 22/pnpm 11 **inside WSL**.         | Clone and run the repository in the WSL Linux filesystem.                                              |
| Windows native PowerShell      | Node.js 22 and pnpm 11 run natively; Docker Desktop supplies PostgreSQL.                                            | Use the PowerShell environment-file copy command below. Containerized services require Docker Desktop. |

Verify prerequisites in your development shell:

```bash
node --version
pnpm --version
docker compose version
```

If pnpm is unavailable, use the package-manager method supported by the installed Node.js distribution (for example `corepack enable` and `corepack prepare pnpm@11.25.0 --activate`). The repository pins `pnpm@11.25.0` in `package.json`.

## Start the database

From the repository root:

```bash
docker compose up -d db
docker compose ps
```

The database container exposes PostgreSQL at `127.0.0.1:5433` and uses PostgreSQL 16 / PostGIS 3.4. The Compose default password is for **local development only**. Do not publish port 5433 or reuse the default password in shared environments.

## Configure and run

macOS, Linux and WSL:

```bash
cp apps/api/.env.example apps/api/.env
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm dev
```

Windows PowerShell (run from the repository root):

```powershell
Copy-Item apps/api/.env.example apps/api/.env
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm dev
```

The API starts at `http://127.0.0.1:3001`; the Vite web application starts at `http://127.0.0.1:5173`. Open the latter in a browser. The API requires a reachable database at startup. See [CONFIGURATION](CONFIGURATION.md) to change connection settings and [USAGE](USAGE.md) for app operation.

## Verify the installation

```bash
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
python3 tools/specs/validate_state.py
```

Python 3 is needed for the specification validator, not to run the product. Playwright browser tests additionally require a compatible Chromium installation; see [TESTS](TESTS.md).

## Deployment notes

The repository currently provides application build scripts and a **local-development database Compose stack**, not a production deployment manifest. Production deployment must configure real secrets, TLS/reverse proxy, persistent database backups, database migrations, source permissions, rate limits and health monitoring. Run the API and web builds independently; publish the `apps/web/dist` assets through an HTTPS static host with `/api/v1` proxied to the API. Deployment-specific automation is a separate scope.
