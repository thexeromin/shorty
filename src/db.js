import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("shorty.db");

export default db;
