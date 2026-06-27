import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";

const root = process.cwd();

const copies = [
  [".next/static", ".next/standalone/.next/static"],
  ["public", ".next/standalone/public"],
] as const;

for (const [fromRelative, toRelative] of copies) {
  const from = join(root, fromRelative);
  const to = join(root, toRelative);

  if (!existsSync(from)) {
    throw new Error(`Missing build artifact: ${fromRelative}`);
  }

  mkdirSync(dirname(to), { recursive: true });
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
  console.log(`Copied ${fromRelative} -> ${toRelative}`);
}
