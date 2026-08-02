import mongoose from "mongoose";

/**
 * Mongo connection, cached across hot reloads.
 *
 * Next's dev server re-evaluates modules on every edit. Without a cache on
 * `globalThis`, each reload would open a fresh connection pool and Mongo would
 * be holding dozens of them within a few minutes of work.
 */

const globalCache = globalThis as unknown as {
  __typesketchMongo?: {
    connection: Promise<typeof mongoose> | null;
    failedAt: number;
  };
};

const cache = (globalCache.__typesketchMongo ??= {
  connection: null,
  failedAt: 0,
});

/** How long to stop retrying after a failure, so every save does not stall. */
const BACKOFF_MS = 30_000;

export function databaseUrl(): string | null {
  return process.env.MONGODB_URI?.trim() || null;
}

/**
 * Returns `null` rather than throwing when there is no database.
 *
 * A missing Mongo is an entirely normal state for this app — the client falls
 * back to localStorage — so it is a condition to report, not an exception. The
 * short timeout matters: Mongo's default server-selection timeout is 30s, which
 * would make every save appear to hang when nothing is listening.
 */
export async function connectToDatabase(): Promise<typeof mongoose | null> {
  const uri = databaseUrl();
  if (!uri) return null;

  if (!cache.connection && Date.now() - cache.failedAt < BACKOFF_MS) return null;

  if (!cache.connection) {
    cache.connection = mongoose
      .connect(uri, {
        serverSelectionTimeoutMS: 2000,
        connectTimeoutMS: 2000,
        bufferCommands: false,
      })
      .catch((error: unknown) => {
        cache.connection = null;
        cache.failedAt = Date.now();
        throw error;
      });
  }

  try {
    return await cache.connection;
  } catch {
    return null;
  }
}
