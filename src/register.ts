import { REST, Routes } from "discord.js";
import { loadConfig } from "./config.ts";
import { command } from "./discord.ts";

try {
  const config = loadConfig();
  const rest = new REST({
    version: "10",
    retries: 0,
    timeout: 15000,
    rejectOnRateLimit: () => true,
  }).setToken(config.token);
  const data = command.toJSON();
  // POST upserts only this named guild command; never replaces other application commands.
  await rest.post(
    Routes.applicationGuildCommands(config.applicationId, config.guildId),
    { body: data },
  );
  console.log("/rolepetal registered / /rolepetal kaydedildi. Run npm start.");
} catch {
  console.error(
    "Registration failed. Run npm run setup; check bot token, application/server IDs, invitation and connection. / Kayıt başarısız; kurulum, kimlikler, davet ve bağlantıyı kontrol edin.",
  );
  process.exitCode = 1;
}
