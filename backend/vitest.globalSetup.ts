import { assertDatabaseUrlIsLocal } from "./src/config/dbGuard.js";

export default function setup() {
  assertDatabaseUrlIsLocal(process.env.DATABASE_URL);
}
