import { existsSync, writeFileSync } from "node:fs";
import { emitKeypressEvents } from "node:readline";
import { createInterface } from "node:readline/promises";
import { parseConfig } from "../src/config.ts";

async function hiddenToken() {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) throw new Error("tty");
  process.stdout.write("Bot token (hidden / gizli): ");
  emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    const finish = (cancel) => {
      process.stdin.off("keypress", onKey);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
      if (cancel) reject(new Error("cancel"));
      else resolve(value);
      value = "";
    };
    const onKey = (text, key) => {
      if (key?.ctrl && key.name === "c") return finish(true);
      if (key?.name === "return" || key?.name === "enter") return finish(false);
      if (key?.name === "backspace") {
        value = value.slice(0, -1);
        return;
      }
      if (
        text &&
        !key?.ctrl &&
        !/[\p{Cc}\p{Cf}]/u.test(text) &&
        value.length + text.length <= 512
      )
        value += text;
    };
    process.stdin.on("keypress", onKey);
  });
}

try {
  if (existsSync(".env")) throw new Error("exists");
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error("tty");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  let applicationId, guildId, roleIds;
  try {
    applicationId = (
      await rl.question("Application ID / Uygulama kimliği: ")
    ).trim();
    guildId = (await rl.question("Server ID / Sunucu kimliği: ")).trim();
    roleIds = (
      await rl.question(
        "1–4 cosmetic role IDs, comma-separated / Kozmetik rol kimlikleri, virgülle: ",
      )
    ).trim();
  } finally {
    rl.close();
  }
  const token = await hiddenToken();
  const config = parseConfig({
    DISCORD_TOKEN: token,
    APPLICATION_ID: applicationId,
    GUILD_ID: guildId,
    ROLE_IDS: roleIds,
  });
  writeFileSync(
    ".env",
    `DISCORD_TOKEN=${config.token}\nAPPLICATION_ID=${config.applicationId}\nGUILD_ID=${config.guildId}\nROLE_IDS=${config.roleIds.join(",")}\n`,
    { flag: "wx", mode: 0o600 },
  );
  console.log("Saved .env / .env kaydedildi. Keep it private / Gizli tutun.");
  console.log(
    `Invite / Davet: https://discord.com/oauth2/authorize?client_id=${config.applicationId}&scope=bot%20applications.commands&permissions=268438528&guild_id=${config.guildId}&disable_guild_select=true`,
  );
  console.log("Next / Sonraki: npm run register, then / ardından npm start");
} catch {
  console.error(
    "Setup stopped. Use an interactive terminal and valid IDs/token. Existing .env is never overwritten. / Kurulum durdu; etkileşimli terminal ve geçerli kimlik/token kullanın. Var olan .env üzerine yazılmaz.",
  );
  process.exitCode = 1;
}
