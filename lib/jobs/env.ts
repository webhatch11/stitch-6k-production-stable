import dotenv from "dotenv";
import fs from "fs";
import path from "path";

// Support loading from .env.local if present (Next.js standard)
const envPath = fs.existsSync(path.resolve(process.cwd(), ".env.local"))
  ? path.resolve(process.cwd(), ".env.local")
  : path.resolve(process.cwd(), ".env");

dotenv.config({ path: envPath });
