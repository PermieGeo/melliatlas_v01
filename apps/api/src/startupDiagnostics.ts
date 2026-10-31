import { ZodError } from "zod";

const configKeys = new Set([
  "NODE_ENV",
  "PORT",
  "DATABASE_URL",
  "OPEN_METEO_TIMEOUT_MS",
]);

function errorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }
  if ("code" in error && typeof error.code === "string") {
    return error.code;
  }
  if ("errors" in error && Array.isArray(error.errors)) {
    for (const nested of error.errors) {
      const code = errorCode(nested);
      if (code !== null) {
        return code;
      }
    }
  }
  return null;
}

export function describeStartupFailure(error: unknown): string {
  if (error instanceof ZodError) {
    const names = [
      ...new Set(
        error.issues
          .map((issue) => issue.path[0])
          .filter(
            (key): key is string =>
              typeof key === "string" && configKeys.has(key),
          ),
      ),
    ];
    const suffix = names.length ? " (" + names.join(", ") + ")" : "";
    return (
      "Invalid API configuration" +
      suffix +
      ". Check apps/api/.env against apps/api/.env.example."
    );
  }

  switch (errorCode(error)) {
    case "ECONNREFUSED":
      return "PostgreSQL connection refused. Check the Docker database and DATABASE_URL host/port (local Compose uses 127.0.0.1:5433).";
    case "ENOTFOUND":
    case "EAI_AGAIN":
      return "Database host could not be resolved. Check DATABASE_URL.";
    case "ETIMEDOUT":
      return "PostgreSQL connection timed out. Check Docker and DATABASE_URL.";
    case "28P01":
      return "PostgreSQL authentication failed. Check DATABASE_URL against the initialized database credentials.";
    case "3D000":
      return "PostgreSQL database does not exist. Check DATABASE_URL database name.";
    case "42P01":
      return "Database table is missing. Run pnpm db:migrate.";
    default:
      return "Check apps/api/.env, PostgreSQL readiness and pnpm db:migrate.";
  }
}
