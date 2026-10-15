import { Events } from "discord.js";
import { loadConfig } from "./config.ts";
import { connectHandlers, discordPort, makeClient } from "./discord.ts";
import { RoleService } from "./service.ts";

try {
  const config = loadConfig();
  const client = makeClient();
  const service = new RoleService(
    config.guildId,
    config.roleIds,
    discordPort(client, config),
  );
  connectHandlers(client, service);
  const timer = setInterval(() => service.prune(), 30000);
  timer.unref();
  const stop = () => {
    clearInterval(timer);
    client.destroy();
    service.drafts.clear();
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  client.once(Events.ClientReady, () => {
    if (client.user?.id !== config.applicationId) {
      stop();
      console.error(
        "Application ID does not match token / Uygulama kimliği token ile eşleşmiyor.",
      );
      process.exitCode = 1;
      return;
    }
    console.log(
      "RolePetal ready / RolePetal hazır. Use /rolepetal in the configured server.",
    );
  });
  try {
    await client.login(config.token);
  } catch {
    stop();
    console.error(
      "Discord login failed. Check token and connection / Tokenı ve bağlantıyı kontrol edin.",
    );
    process.exitCode = 1;
  }
} catch (error) {
  console.error(
    error instanceof Error
      ? error.message
      : "Setup required / Kurulum gerekli.",
  );
  process.exitCode = 1;
}
