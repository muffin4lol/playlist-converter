// Run daily using a trusted scheduler with DATABASE_URL configured.
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
try {
  const now = new Date();
  await db.$transaction([
    db.session.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.platformConnection.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.verificationToken.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.oAuthAttempt.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.rateLimit.deleteMany({ where: { expiresAt: { lt: now } } }),
  ]);
} finally {
  await db.$disconnect();
}
