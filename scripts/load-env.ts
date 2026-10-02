// Loads .env.local (and .env) before anything else reads settings.
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });
