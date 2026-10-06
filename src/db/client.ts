// import mysql from "mysql2/promise";
// import { drizzle } from "drizzle-orm/mysql2";

// const pool = mysql.createPool({
//   uri: import.meta.env.DATABASE_URL,
//   waitForConnections: true,
//   connectionLimit: 10,
//   queueLimit: 0,
// });

// export const db = drizzle(pool);

// export {pool};

import "dotenv/config";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is not defined."
  );
}

const pool = mysql.createPool({
  uri: databaseUrl,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export const db = drizzle(pool);

export { pool };