import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parseConfig } from "../src/config.ts";

const env = {
  DISCORD_TOKEN: "test-placeholder-without-periods-0000000000",
  APPLICATION_ID: "111111111111111111",
  GUILD_ID: "222222222222222222",
  ROLE_IDS: "333333333333333333",
};
test("valid explicit configuration accepts four unique cosmetic roles", () => {
  assert.equal(parseConfig(env).roleIds.length, 1);
  assert.equal(
    parseConfig({
      ...env,
      ROLE_IDS: [3, 4, 5, 6].map((n) => String(n).repeat(18)).join(","),
    }).roleIds.length,
    4,
  );
});
for (const [key, value] of [
  ["DISCORD_TOKEN", ""],
  ["DISCORD_TOKEN", "replace_with_your_own_bot_token"],
  ["DISCORD_TOKEN", "space ".repeat(10)],
  ["APPLICATION_ID", "bad"],
  ["GUILD_ID", "-111111111111111111"],
  ["ROLE_IDS", ""],
  ["ROLE_IDS", "222222222222222222"],
  ["ROLE_IDS", "333333333333333333,333333333333333333"],
  ["ROLE_IDS", [3, 4, 5, 6, 7].map((n) => String(n).repeat(18)).join(",")],
] as const) {
  test(`invalid ${key} (${value.length} characters) is rejected without exposing values`, () => {
    assert.throws(
      () => parseConfig({ ...env, [key ?? ""]: value }),
      /Configuration missing or invalid/,
    );
  });
}
for (const file of ["src/main.ts", "src/register.ts", "scripts/setup.mjs"]) {
  test(`real unconfigured ${file} exits safely without writes`, () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
    const target = join(root, file);
    assert(existsSync(target));
    const temp = mkdtempSync(join(tmpdir(), "rolepetal-smoke-"));
    const cleanEnv = { ...process.env };
    for (const key of Object.keys(env)) delete cleanEnv[key];
    try {
      const result = spawnSync(process.execPath, [target], {
        cwd: temp,
        env: cleanEnv,
        encoding: "utf8",
        timeout: 15000,
      });
      assert.equal(result.error, undefined);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /setup|Setup/);
      assert.doesNotMatch(
        result.stderr,
        /MODULE_NOT_FOUND|ERR_MODULE_NOT_FOUND/,
      );
      assert.deepEqual(readdirSync(temp), []);
    } finally {
      const resolved = realpathSync(temp);
      assert(resolved.startsWith(realpathSync(tmpdir()) + sep));
      assert(resolved.includes("rolepetal-smoke-"));
      rmSync(resolved, { recursive: true });
    }
  });
}
