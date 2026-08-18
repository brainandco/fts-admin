import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { provisionDriverRiggerLogins } from "../lib/employees/provision-driver-rigger-logins";

function loadEnvLocal(envPath: string) {
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const adminRoot = join(here, "..");
  loadEnvLocal(join(adminRoot, ".env.local"));

  const result = await provisionDriverRiggerLogins();
  const dir = join(adminRoot, "private");
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const xlsxPath = join(dir, `driver-rigger-logins-${stamp}.xlsx`);
  writeFileSync(xlsxPath, result.workbook);
  console.log(`OK ${result.okCount}  ERROR ${result.errorCount}`);
  console.log(`Wrote ${xlsxPath}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
