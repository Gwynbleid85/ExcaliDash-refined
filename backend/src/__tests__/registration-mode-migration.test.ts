import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";

const createTempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "excalidash-migration-"));

const openWritableDb = (filePath: string): any => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { DatabaseSync } = require("node:sqlite") as any;
    return new DatabaseSync(filePath, { enableForeignKeyConstraints: false });
  } catch (_err) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Database = require("better-sqlite3") as any;
    return new Database(filePath);
  }
};

const migrationSql = fs.readFileSync(
  path.resolve(
    __dirname,
    "../../prisma/migrations/20260422150000_add_signup_links_and_registration_mode/migration.sql"
  ),
  "utf8"
);

const createPreMigrationDb = (registrationEnabled: boolean) => {
  const dir = createTempDir();
  const filePath = path.join(dir, "migration.db");
  const db = openWritableDb(filePath);

  db.exec(`
    CREATE TABLE "User" (
      "id" TEXT NOT NULL PRIMARY KEY
    );

    CREATE TABLE "SystemConfig" (
      "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
      "registrationEnabled" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    );
  `);

  db.prepare(
    `INSERT INTO "SystemConfig" ("id", "registrationEnabled", "createdAt", "updatedAt")
     VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  ).run("default", registrationEnabled ? 1 : 0);

  return { db, filePath, dir };
};

const readRegistrationMode = (db: any, id = "default"): string => {
  const row = db.prepare(`SELECT "registrationMode" FROM "SystemConfig" WHERE "id" = ?`).get(id) as
    | { registrationMode: string }
    | undefined;

  if (!row) {
    throw new Error(`SystemConfig row not found for id=${id}`);
  }

  return row.registrationMode;
};

describe("signup link migration registration mode backfill", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0, tempDirs.length)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("backfills public registration for existing installs that had registration enabled", () => {
    const { db, dir } = createPreMigrationDb(true);
    tempDirs.push(dir);

    try {
      db.exec(migrationSql);
      expect(readRegistrationMode(db)).toBe("public");
    } finally {
      db.close();
    }
  });

  it("backfills disabled registration for existing installs that had registration disabled", () => {
    const { db, dir } = createPreMigrationDb(false);
    tempDirs.push(dir);

    try {
      db.exec(migrationSql);
      expect(readRegistrationMode(db)).toBe("disabled");
    } finally {
      db.close();
    }
  });

  it("preserves the disabled default for rows inserted after the migration", () => {
    const { db, dir } = createPreMigrationDb(false);
    tempDirs.push(dir);

    try {
      db.exec(migrationSql);
      db.prepare(
        `INSERT INTO "SystemConfig" ("id", "registrationEnabled", "createdAt", "updatedAt")
         VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).run("fresh", 0);

      expect(readRegistrationMode(db, "fresh")).toBe("disabled");
    } finally {
      db.close();
    }
  });
});
