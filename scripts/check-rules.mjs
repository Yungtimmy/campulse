import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const roots = ["app", "components", "lib"];
const files = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(ts|tsx)$/.test(name)) files.push(path);
  }
}

for (const root of roots) walk(root);

const failures = [];
for (const file of files) {
  const text = readFileSync(file, "utf8");
  if (/leaderboard/i.test(text)) {
    failures.push(`${file} mentions a leaderboard`);
  }
  if (text.includes("use client") && /SUPABASE_SERVICE_ROLE_KEY|GROQ_API_KEY/.test(text)) {
    failures.push(`${file} is a client module and references a server secret`);
  }
  if (/NEXT_PUBLIC_GROQ|NEXT_PUBLIC_SUPABASE_SERVICE_ROLE/.test(text)) {
    failures.push(`${file} exposes a server secret through NEXT_PUBLIC_`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`check:rules ok (${files.length} files)`);
