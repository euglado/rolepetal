import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  Events,
  GatewayIntentBits,
  type Interaction,
  MessageFlags,
  Options,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import type { Config } from "./config.ts";
import { type Language, messages, SafeError, visibleName } from "./policy.ts";
import type { Draft, Identity, Port, RoleService } from "./service.ts";

export const noMentions = { parse: [] as never[], repliedUser: false };
export const command = new SlashCommandBuilder()
  .setName("rolepetal")
  .setDescription(
    "Preview a cosmetic role panel / Kozmetik rol panelini önizle",
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
  .addStringOption((option) =>
    option
      .setName("language")
      .setDescription("Panel language / Panel dili")
      .setRequired(true)
      .addChoices(
        { name: "Türkçe", value: "tr" },
        { name: "English", value: "en" },
      ),
  );

export function panel(roles: { id: string; name: string }[], lang: Language) {
  const text = messages[lang];
  return {
    content: `**RolePetal — ${text.panel}**\n${text.intro}\n\n${roles.map((role, i) => `${i + 1}. ${visibleName(role.name)} (${role.id})`).join("\n")}`,
    allowedMentions: noMentions,
    flags: MessageFlags.SuppressEmbeds as const,
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        roles.map((role) =>
          new ButtonBuilder()
            .setCustomId(`rp:pick:${lang}:${role.id}`)
            .setLabel(visibleName(role.name))
            .setStyle(ButtonStyle.Secondary),
        ),
      ),
    ],
  };
}
export function previewCard(d: Draft, ids: readonly string[]) {
  const t = messages[d.lang];
  const detail =
    d.kind === "panel"
      ? panel(
          ids.map((id, index) => ({
            id,
            name: d.names[index] ?? "Role / Rol",
          })),
          d.lang,
        ).content
      : d.lang === "tr"
        ? `${d.add ? "Eklenecek" : "Kaldırılacak"} rol: ${visibleName(d.names[0] ?? "")} (${d.role})\nYalnızca kendi rolünüz değişecek. Rol profilinizde görünür.`
        : `Role to ${d.add ? "add" : "remove"}: ${visibleName(d.names[0] ?? "")} (${d.role})\nOnly your own role will change. The role is visible in your profile.`;
  return {
    content: `${detail}\n\n${d.lang === "tr" ? "Önizleme 2 dakika geçerli." : "Preview expires in 2 minutes."}`,
    allowedMentions: noMentions,
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`rp:yes:${d.lang}:${d.id}`)
          .setLabel(d.kind === "panel" ? t.publish : t.confirm)
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`rp:no:${d.lang}:${d.id}`)
          .setLabel(t.cancel)
          .setStyle(ButtonStyle.Secondary),
      ),
    ],
  };
}

export function makeClient(): Client {
  return new Client({
    intents: [GatewayIntentBits.Guilds],
    makeCache: Options.cacheWithLimits({
      ...Options.DefaultMakeCacheSettings,
      MessageManager: 0,
      GuildMemberManager: 0,
      UserManager: 0,
    }),
    allowedMentions: noMentions,
    rest: { retries: 0, timeout: 15000, rejectOnRateLimit: () => true },
  });
}

export function discordPort(client: Client, config: Config): Port {
  return {
    async snapshot(who) {
      if (who.guild !== config.guildId || !client.user)
        throw new SafeError("access");
      const guild = await client.guilds.fetch({
        guild: config.guildId,
        force: true,
      });
      const roles = await guild.roles.fetch();
      const channels = await guild.channels.fetch();
      const [member, bot] = await Promise.all([
        guild.members.fetch({ user: who.user, force: true, cache: false }),
        guild.members.fetch({
          user: client.user.id,
          force: true,
          cache: false,
        }),
      ]);
      const channel = channels.get(who.channel);
      const access =
        channel?.type === ChannelType.GuildText &&
        !member.user.bot &&
        !member.pending &&
        !member.isCommunicationDisabled() &&
        !bot.permissions.has(PermissionFlagsBits.Administrator) &&
        bot.permissions.has(PermissionFlagsBits.ManageRoles) &&
        (channel
          .permissionsFor(member)
          ?.has([
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
          ]) ??
          false) &&
        (channel
          .permissionsFor(bot)
          ?.has([
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
          ]) ??
          false) &&
        (channel.rateLimitPerUser ?? 0) <= 60;
      // Guild channel listing includes private channel overwrites; threads inherit their parent.
      // If any channel is unavailable to inspect, fail closed instead of assuming safety.
      const complete = [...channels.values()].every(
        (c) => c !== null && "permissionOverwrites" in c,
      );
      return {
        access: access && complete,
        manager: member.permissions.has(PermissionFlagsBits.ManageRoles),
        memberRoles: new Set(member.roles.cache.keys()),
        roles: config.roleIds.flatMap((id) => {
          const role = roles.get(id);
          return role
            ? [
                {
                  id,
                  name: role.name,
                  permissions: role.permissions.bitfield,
                  managed: role.managed,
                  belowBot: role.comparePositionTo(bot.roles.highest) < 0,
                  belowMember:
                    member.id === guild.ownerId ||
                    role.comparePositionTo(member.roles.highest) < 0,
                  overwritten: [...channels.values()].some(
                    (c) =>
                      c &&
                      "permissionOverwrites" in c &&
                      c.permissionOverwrites.cache.has(id),
                  ),
                },
              ]
            : [];
        }),
      };
    },
    async publish(who, ids, lang, nonce) {
      const guild = await client.guilds.fetch(who.guild);
      const channel = guild.channels.cache.get(who.channel);
      if (channel?.type !== ChannelType.GuildText)
        throw new SafeError("access");
      const roles = ids.map((id) => ({
        id,
        name: guild.roles.cache.get(id)?.name ?? "Role / Rol",
      }));
      await channel.send({ ...panel(roles, lang), nonce, enforceNonce: true });
    },
    async setRole(who, role, add) {
      // Singular, idempotent PUT/DELETE preserves every other role. Never replace a member's role list.
      const guild = await client.guilds.fetch(who.guild);
      const member = await guild.members.fetch({
        user: who.user,
        force: true,
        cache: false,
      });
      if (add)
        await member.roles.add(
          role,
          "RolePetal: member confirmed cosmetic role addition",
        );
      else
        await member.roles.remove(
          role,
          "RolePetal: member confirmed cosmetic role removal",
        );
    },
  };
}

export async function handleInteraction(
  interaction: Interaction,
  service: RoleService,
  botId: string,
): Promise<void> {
  if (!interaction.isChatInputCommand() && !interaction.isButton()) return;
  if (
    interaction.isChatInputCommand() &&
    interaction.commandName !== "rolepetal"
  )
    return;
  if (interaction.isButton() && !interaction.customId.startsWith("rp:")) return;
  let lang: Language = interaction.locale.startsWith("tr") ? "tr" : "en";
  let draft: Draft | undefined;
  try {
    if (
      !interaction.guildId ||
      !interaction.channelId ||
      interaction.guildId !== service.guild
    )
      throw new SafeError("access");
    const who: Identity = {
      user: interaction.user.id,
      guild: interaction.guildId,
      channel: interaction.channelId,
    };
    if (interaction.isChatInputCommand()) {
      lang =
        interaction.options.getString("language", true) === "tr" ? "tr" : "en";
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      draft = await service.preview(who, lang);
    } else {
      const match = /^rp:(pick|yes|no):(en|tr):([\da-f-]+)$/.exec(
        interaction.customId,
      );
      if (
        !match ||
        interaction.message.author.id !== botId ||
        interaction.message.webhookId
      )
        throw new SafeError("expired");
      lang = match[2] === "tr" ? "tr" : "en";
      const action = match[1];
      const id = match[3] ?? "";
      if (action === "pick") {
        if (interaction.message.flags.has(MessageFlags.Ephemeral))
          throw new SafeError("expired");
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        draft = await service.preview(who, lang, id);
      } else {
        if (!interaction.message.flags.has(MessageFlags.Ephemeral))
          throw new SafeError("expired");
        await interaction.deferUpdate();
        let result: "cancel" | "panel" | "role";
        if (action === "no") {
          service.discard(id, who, interaction.message.id);
          result = "cancel";
        } else result = await service.confirm(id, who, interaction.message.id);
        await interaction.editReply({
          content:
            result === "cancel"
              ? messages[lang].cancelled
              : result === "panel"
                ? messages[lang].posted
                : messages[lang].done,
          components: [],
          allowedMentions: noMentions,
        });
        return;
      }
    }
    const reply = await interaction.editReply(
      previewCard(draft, service.allowed),
    );
    service.bind(draft.id, reply.id);
  } catch (error) {
    if (draft) service.forget(draft.id);
    const content =
      messages[lang][error instanceof SafeError ? error.code : "delivery"];
    try {
      if (interaction.deferred || interaction.replied)
        await interaction.editReply({
          content,
          components: [],
          allowedMentions: noMentions,
        });
      else
        await interaction.reply({
          content,
          flags: MessageFlags.Ephemeral,
          allowedMentions: noMentions,
        });
    } catch {
      /* No payloads, user IDs or credentials in logs. */
    }
  }
}

export function connectHandlers(client: Client, service: RoleService): void {
  client.on(Events.InteractionCreate, (i) => {
    void handleInteraction(i, service, client.user?.id ?? "");
  });
  client.on(Events.Error, () => {
    console.error("Discord connection error / Discord bağlantı hatası.");
  });
}
