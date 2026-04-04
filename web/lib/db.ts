import "server-only";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Missing DATABASE_URL for server-side SQL");
}

/** Raw SQL pool (priority queue, transactions). Use only in server code. */
export const db = postgres(connectionString, { max: 5 });
