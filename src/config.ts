import { existsSync } from "node:fs";

export interface Config {
  token: string;
  applicationId: string;
  guildId: string;
  roleIds: string[];
}
export const isId = (value: string): boolean => /^\d{17,20}$/.test(value);
export function parseConfig(env: NodeJS.ProcessEnv): Config {
  const token = env.DISCORD_TOKEN?.trim() ?? "";
  const applicationId = env.APPLICATION_ID?.trim() ?? "";
  const guildId = env.GUILD_ID?.trim() ?? "";
  const roleIds = (env.ROLE_IDS ?? "").split(",").map((s) => s.trim());
  if (
    !/^[A-Za-z\d_.-]{30,512}$/.test(token) ||
    token.includes("replace_") ||
    !isId(applicationId) ||
    !isId(guildId) ||
    roleIds.length < 1 ||
    roleIds.length > 4 ||
    roleIds.some((id) => !isId(id) || id === guildId) ||
    new Set(roleIds).size !== roleIds.length
  )
    throw new Error(
      "Configuration missing or invalid. Run npm run setup / Yapılandırma geçersiz; npm run setup çalıştırın.",
    );
  return { token, applicationId, guildId, roleIds };
}
export function loadConfig(): Config {
  try {
    if (existsSync(".env")) process.loadEnvFile(".env");
  } catch {
    throw new Error("Cannot read .env / .env okunamadı. Run npm run setup.");
  }
  return parseConfig(process.env);
}
