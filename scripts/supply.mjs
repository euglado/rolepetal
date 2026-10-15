import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const allowed = new Set([
  "MIT",
  "Apache-2.0",
  "MIT OR Apache-2.0",
  "(MIT OR Apache-2.0)",
  "BSD-3-Clause",
  "BSD-2-Clause",
  "ISC",
  "0BSD",
]);
let count = 0;
for (const [name, pkg] of Object.entries(lock.packages)) {
  if (!name) continue;
  assert(allowed.has(pkg.license), `Review dependency license: ${name}`);
  assert(
    /^https:\/\/registry\.npmjs\.org\//.test(pkg.resolved),
    `Untrusted registry: ${name}`,
  );
  assert(
    /^sha512-[A-Za-z\d+/]+=*$/.test(pkg.integrity),
    `Missing SHA-512: ${name}`,
  );
  assert(!pkg.hasInstallScript, `Install script requires review: ${name}`);
  count++;
}
const patterns = [
  new RegExp("gh" + "[pousr]_[A-Za-z0-9]{36,}"),
  new RegExp("github" + "_pat_[A-Za-z0-9_]{40,}"),
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /[A-Za-z0-9_-]{23,30}\.[A-Za-z0-9_-]{6}\.[A-Za-z0-9_-]{27,}/,
];
let files = 0;
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (
      ["node_modules", ".git", ".env", "coverage"].includes(entry.name) ||
      entry.name.startsWith(".env.")
    )
      continue;
    const target = join(dir, entry.name);
    assert(!entry.isSymbolicLink(), "Symlink requires review");
    if (entry.isDirectory()) walk(target);
    else {
      const data = readFileSync(target, "utf8");
      assert(
        !patterns.some((pattern) => pattern.test(data)),
        `Potential credential in ${relative(root, target)}; content withheld`,
      );
      files++;
    }
  }
}
walk(root);
console.log(
  `Supply check passed: ${count} dependency licenses/registry/SHA-512/no-install-script records; ${files} source credential-pattern scans. Pattern scanning is not a guarantee.`,
);
