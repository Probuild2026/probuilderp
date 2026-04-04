import { execSync } from "node:child_process";

function run(command) {
  console.log(`$ ${command}`);
  execSync(command, {
    stdio: "inherit",
    env: process.env,
  });
}

run("node scripts/clean-next.mjs");
run("npx prisma generate");

if (process.env.VERCEL_ENV === "production") {
  run("npx prisma migrate deploy");
} else {
  console.log(`Skipping prisma migrate deploy because VERCEL_ENV=${process.env.VERCEL_ENV ?? "undefined"}.`);
}

run("npx next build --webpack");
