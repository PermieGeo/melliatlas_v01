/** Only specifically named local databases can receive synthetic example evidence. */
export function requireDemoDatabase(
  connectionString: string,
  databaseName: string,
): void {
  const url = new URL(connectionString);
  const allowed = new Set(["melliatlas_demo", "melliatlas_demo_e2e"]);
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    !allowed.has(databaseName) ||
    url.pathname !== `/${databaseName}` ||
    process.env.NODE_ENV === "production"
  ) {
    throw new Error(
      "Synthetic data requires a dedicated local MelliAtlas demo database in non-production mode",
    );
  }
}
