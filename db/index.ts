import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema.js";

// Set directly by vibemeasite-mcp on the Vercel project at provisioning
// time (US-VMAS-DEPLOY-04) — this is this site's own dedicated database,
// not shared with any other VibeMeASite site.
const sql = neon(process.env.POSTGRES_URL!);
export const db = drizzle(sql, { schema });
