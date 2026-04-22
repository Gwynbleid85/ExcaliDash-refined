ALTER TABLE "SystemConfig" ADD COLUMN "registrationMode" TEXT NOT NULL DEFAULT 'disabled';

UPDATE "SystemConfig"
SET "registrationMode" = CASE
  WHEN "registrationEnabled" = 1 THEN 'public'
  ELSE 'disabled'
END
WHERE "registrationMode" NOT IN ('disabled', 'public', 'link_only');

CREATE TABLE "SignupLink" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tokenHash" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "expiresAt" DATETIME,
  "revokedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "SignupLink_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SignupLink_tokenHash_key" ON "SignupLink"("tokenHash");
CREATE INDEX "SignupLink_createdByUserId_idx" ON "SignupLink"("createdByUserId");
CREATE INDEX "SignupLink_revokedAt_expiresAt_idx" ON "SignupLink"("revokedAt", "expiresAt");
