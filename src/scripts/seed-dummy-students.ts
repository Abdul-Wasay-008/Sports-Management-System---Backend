import { env } from "../config/env.js";
import { connectDatabase, disconnectDatabase } from "../lib/db.js";
import { createStudent } from "../services/admin.service.js";

const DUMMY_STUDENTS = [
  {
    name: "Ali Khan",
    email: "dummy.bio@cust.pk",
    registrationNumber: "BIO-DUMMY-001",
    gender: "male" as const,
    department: "Bioinformatics and Biosciences",
  },
  {
    name: "Sara Ahmed",
    email: "dummy.civil@cust.pk",
    registrationNumber: "CIV-DUMMY-001",
    gender: "female" as const,
    department: "Civil Engineering",
  },
  {
    name: "Hassan Raza",
    email: "dummy.pharmacy@cust.pk",
    registrationNumber: "PHR-DUMMY-001",
    gender: "male" as const,
    department: "Pharmacy",
  },
  {
    name: "Ayesha Malik",
    email: "dummy.psychology@cust.pk",
    registrationNumber: "PSY-DUMMY-001",
    gender: "female" as const,
    department: "Psychology",
  },
] as const;

const DUMMY_PASSWORD = "DummyPass1";

async function run() {
  if (!env.mongodbUri) {
    throw new Error("MONGODB_URI is required.");
  }

  await connectDatabase(env.mongodbUri);

  const created: string[] = [];
  const skipped: string[] = [];

  for (const student of DUMMY_STUDENTS) {
    try {
      const row = await createStudent({ ...student, password: DUMMY_PASSWORD });
      created.push(`${row.name} (${row.department})`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("already in use")) {
        skipped.push(`${student.name} (${student.department}) — already exists`);
      } else {
        throw err;
      }
    }
  }

  console.log("Dummy students seed finished.");
  if (created.length > 0) {
    console.log("Created:", created.join("; "));
  }
  if (skipped.length > 0) {
    console.log("Skipped:", skipped.join("; "));
  }
  console.log(`Default password for new accounts: ${DUMMY_PASSWORD}`);
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDatabase();
  });
