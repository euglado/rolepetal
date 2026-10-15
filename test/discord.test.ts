import assert from "node:assert/strict";
import test from "node:test";
import {
  ChannelType,
  type Client,
  Collection,
  GatewayIntentBits,
  type Interaction,
  MessageFlags,
  MessageFlagsBitField,
  PermissionFlagsBits,
  PermissionsBitField,
} from "discord.js";
import {
  command,
  discordPort,
  handleInteraction,
  makeClient,
  panel,
} from "../src/discord.ts";
import { type Snapshot, safeRole } from "../src/policy.ts";
import { RoleService } from "../src/service.ts";

const roleId = "333333333333333333";
const who = {
  user: "111111111111111111",
  guild: "222222222222222222",
  channel: "444444444444444444",
};
const botId = "555555555555555555";
const config = {
  guildId: who.guild,
  applicationId: botId,
  roleIds: [roleId],
  token: "placeholder-not-used-for-network-tests",
};
function adapterRig() {
  let reads = 0;
  const changes: unknown[][] = [];
  const role = {
    id: roleId,
    name: "Cosmetic",
    permissions: new PermissionsBitField(0n),
    managed: false,
    position: 10,
    comparePositionTo(other: { position: number }) {
      return this.position - other.position;
    },
  };
  const member = {
    id: who.user,
    user: { bot: false },
    pending: false,
    permissions: new PermissionsBitField(PermissionFlagsBits.ManageRoles),
    isCommunicationDisabled: () => false,
    roles: {
      highest: { position: 30 },
      cache: new Collection<string, unknown>(),
      add: async (...args: unknown[]) => {
        changes.push(["add", ...args]);
      },
      remove: async (...args: unknown[]) => {
        changes.push(["remove", ...args]);
      },
    },
  };
  const bot = {
    permissions: new PermissionsBitField(PermissionFlagsBits.ManageRoles),
    roles: { highest: { position: 20 } },
  };
  let memberChannel = true;
  let botChannel = true;
  const channel = {
    type: ChannelType.GuildText,
    rateLimitPerUser: 0,
    permissionOverwrites: { cache: new Collection<string, unknown>() },
    permissionsFor(value: unknown) {
      return new PermissionsBitField(
        (value === member ? memberChannel : botChannel)
          ? PermissionFlagsBits.ViewChannel | PermissionFlagsBits.SendMessages
          : 0n,
      );
    },
    async send(payload: unknown) {
      changes.push(["send", payload]);
    },
  };
  const privateChannel = {
    permissionOverwrites: { cache: new Collection<string, unknown>() },
  };
  const channels = new Collection<string, unknown>([
    [who.channel, channel],
    ["private", privateChannel],
  ]);
  const guild = {
    ownerId: "owner",
    roles: {
      async fetch() {
        reads++;
        return new Collection([[roleId, role]]);
      },
      cache: new Collection([[roleId, role]]),
    },
    channels: {
      async fetch() {
        reads++;
        return channels;
      },
      cache: channels,
    },
    members: {
      async fetch(options: { user: string; force: boolean; cache: boolean }) {
        assert.equal(options.force, true);
        assert.equal(options.cache, false);
        reads++;
        return options.user === botId ? bot : member;
      },
    },
  };
  const client = {
    user: { id: botId },
    guilds: {
      async fetch(id: string | { guild: string; force: boolean }) {
        if (typeof id === "string") assert.equal(id, who.guild);
        else {
          assert.equal(id.guild, who.guild);
          assert.equal(id.force, true);
        }
        return guild;
      },
    },
  } as unknown as Client;
  return {
    role,
    member,
    bot,
    guild,
    channel,
    privateChannel,
    channels,
    changes,
    reads: () => reads,
    denyMember: () => {
      memberChannel = false;
    },
    denyBot: () => {
      botChannel = false;
    },
    port: discordPort(client, config),
  };
}
test("Discord snapshot refreshes full roles/channels and single members without member-list access", async () => {
  const r = adapterRig();
  const s = await r.port.snapshot(who);
  assert(s.access);
  assert(s.manager);
  assert.equal(safeRole(s, roleId, [roleId], true).name, "Cosmetic");
  assert.equal(r.reads(), 4);
});
for (const variant of [
  "permission",
  "managed",
  "hierarchy",
  "privateOverwrite",
  "missingChannel",
] as const) {
  test(`real Discord adapter rejects ${variant}`, async () => {
    const r = adapterRig();
    if (variant === "permission")
      r.role.permissions = new PermissionsBitField(
        PermissionFlagsBits.Administrator,
      );
    if (variant === "managed") r.role.managed = true;
    if (variant === "hierarchy") r.bot.roles.highest.position = 10;
    if (variant === "privateOverwrite")
      r.privateChannel.permissionOverwrites.cache.set(roleId, {
        allow: 0n,
        deny: 1024n,
      });
    if (variant === "missingChannel") r.channels.set("unknown", null);
    const s = await r.port.snapshot(who);
    assert.throws(() => safeRole(s, roleId, [roleId]));
    assert.deepEqual(r.changes, []);
  });
}
for (const variant of [
  "timeout",
  "pending",
  "botMember",
  "administrator",
  "missingManageRoles",
  "memberView",
  "botView",
  "slowmode",
  "thread",
] as const) {
  test(`real Discord adapter denies access for ${variant}`, async () => {
    const r = adapterRig();
    if (variant === "timeout") r.member.isCommunicationDisabled = () => true;
    if (variant === "pending") r.member.pending = true;
    if (variant === "botMember") r.member.user.bot = true;
    if (variant === "administrator")
      r.bot.permissions = new PermissionsBitField(
        PermissionFlagsBits.Administrator,
      );
    if (variant === "missingManageRoles")
      r.bot.permissions = new PermissionsBitField(0n);
    if (variant === "memberView") r.denyMember();
    if (variant === "botView") r.denyBot();
    if (variant === "slowmode") r.channel.rateLimitPerUser = 61;
    if (variant === "thread") r.channel.type = ChannelType.PublicThread;
    assert.equal((await r.port.snapshot(who)).access, false);
    assert.deepEqual(r.changes, []);
  });
}
test("60 second slowmode and owner hierarchy exception are accepted", async () => {
  const r = adapterRig();
  r.channel.rateLimitPerUser = 60;
  r.guild.ownerId = who.user;
  r.member.roles.highest.position = 0;
  assert(safeRole(await r.port.snapshot(who), roleId, [roleId], true));
});
test("single-role add/remove never replace the whole member role list", async () => {
  const r = adapterRig();
  await r.port.setRole(who, roleId, true);
  await r.port.setRole(who, roleId, false);
  assert.deepEqual(
    r.changes.map((x) => x.slice(0, 2)),
    [
      ["add", roleId],
      ["remove", roleId],
    ],
  );
});
test("publication suppresses mentions/embeds and enables nonce deduplication", async () => {
  const r = adapterRig();
  await r.port.publish(who, [roleId], "tr", "nonce");
  const payload = r.changes[0]?.[1] as {
    nonce: string;
    enforceNonce: boolean;
    allowedMentions: { parse: unknown[] };
    flags: number;
  };
  assert.equal(payload.nonce, "nonce");
  assert.equal(payload.enforceNonce, true);
  assert.deepEqual(payload.allowedMentions.parse, []);
  assert.equal(payload.flags, MessageFlags.SuppressEmbeds);
});
test("Gateway requests Guilds only; privileged and message intents are absent", () => {
  const client = makeClient();
  assert.equal(client.options.intents.bitfield, GatewayIntentBits.Guilds);
  assert.equal(client.rest.options.retries, 0);
  client.destroy();
  assert.equal(
    command.toJSON().default_member_permissions,
    String(PermissionFlagsBits.ManageRoles),
  );
});
test("maximum-size public panel fits Discord limits and has usable role labels", () => {
  const card = panel(
    [3, 4, 5, 6].map((n) => ({
      id: String(n).repeat(18),
      name: "@everyone*".repeat(10),
    })),
    "en",
  );
  assert(card.content.length < 2000);
  const row = card.components[0]?.toJSON();
  assert.equal(row?.components.length, 4);
  for (const button of row?.components ?? []) {
    assert("label" in button);
    assert((button.label?.length ?? 0) <= 80);
  }
});

function interactionRig(kind: "command" | "button", id = "") {
  const calls: { method: string; payload?: unknown }[] = [];
  const raw = {
    locale: "tr",
    guildId: who.guild,
    channelId: who.channel,
    user: { id: who.user },
    commandName: "rolepetal",
    customId: id,
    options: { getString: () => "en" },
    deferred: false,
    replied: false,
    message: {
      id: "public",
      author: { id: botId },
      webhookId: null as string | null,
      flags: new MessageFlagsBitField(0),
    },
    isChatInputCommand: () => kind === "command",
    isButton: () => kind === "button",
    async deferReply(payload: unknown) {
      raw.deferred = true;
      calls.push({ method: "deferReply", payload });
    },
    async deferUpdate() {
      raw.deferred = true;
      calls.push({ method: "deferUpdate" });
    },
    async editReply(payload: unknown) {
      calls.push({ method: "editReply", payload });
      return { id: "private" };
    },
    async reply(payload: unknown) {
      raw.replied = true;
      calls.push({ method: "reply", payload });
    },
  };
  const writes: unknown[] = [];
  const s: Snapshot = {
    access: true,
    manager: true,
    memberRoles: new Set(),
    roles: [
      {
        id: roleId,
        name: "Cosmetic",
        permissions: 0n,
        managed: false,
        belowBot: true,
        belowMember: true,
        overwritten: false,
      },
    ],
  };
  const service = new RoleService(who.guild, [roleId], {
    async snapshot() {
      return s;
    },
    async publish() {
      writes.push("publish");
    },
    async setRole(_who, _role, add) {
      writes.push(add);
    },
  });
  return {
    raw,
    calls,
    service,
    writes,
    s,
    interaction: raw as unknown as Interaction,
  };
}
test("command defers privately and creates a bound preview without publication", async () => {
  const r = interactionRig("command");
  await handleInteraction(r.interaction, r.service, botId);
  assert.equal(r.calls[0]?.method, "deferReply");
  assert.equal(
    (r.calls[0]?.payload as { flags: number } | undefined)?.flags,
    MessageFlags.Ephemeral,
  );
  const d = [...r.service.drafts.values()][0];
  assert.equal(d?.message, "private");
  assert.deepEqual(r.writes, []);
});
test("public role selection then private confirm uses deferUpdate/editReply and changes only self", async () => {
  const r = interactionRig("button", `rp:pick:en:${roleId}`);
  await handleInteraction(r.interaction, r.service, botId);
  const d = [...r.service.drafts.values()][0];
  assert(d);
  assert.deepEqual(r.writes, []);
  r.raw.customId = `rp:yes:en:${d.id}`;
  r.raw.message.id = "private";
  r.raw.message.flags = new MessageFlagsBitField(MessageFlags.Ephemeral);
  r.raw.deferred = false;
  r.calls.length = 0;
  await handleInteraction(r.interaction, r.service, botId);
  assert.deepEqual(
    r.calls.map((x) => x.method),
    ["deferUpdate", "editReply"],
  );
  assert.deepEqual(r.writes, [true]);
});
test("private cancellation removes controls and never changes roles", async () => {
  const r = interactionRig("button", `rp:pick:tr:${roleId}`);
  await handleInteraction(r.interaction, r.service, botId);
  const d = [...r.service.drafts.values()][0];
  assert(d);
  r.raw.customId = `rp:no:tr:${d.id}`;
  r.raw.message.id = "private";
  r.raw.message.flags = new MessageFlagsBitField(MessageFlags.Ephemeral);
  r.raw.deferred = false;
  await handleInteraction(r.interaction, r.service, botId);
  assert.deepEqual(r.writes, []);
  assert.equal(r.service.drafts.size, 0);
  assert.deepEqual(
    (r.calls.at(-1)?.payload as { components: unknown[] } | undefined)
      ?.components,
    [],
  );
});
for (const variant of [
  "foreignAuthor",
  "webhook",
  "otherGuild",
  "malformed",
  "privatePick",
  "publicConfirm",
] as const) {
  test(`component adapter rejects ${variant} before changes`, async () => {
    const r = interactionRig("button", `rp:pick:en:${roleId}`);
    if (variant === "foreignAuthor") r.raw.message.author.id = "other";
    if (variant === "webhook") r.raw.message.webhookId = "webhook";
    if (variant === "otherGuild") r.raw.guildId = "other";
    if (variant === "malformed") r.raw.customId = "rp:broken";
    if (variant === "privatePick")
      r.raw.message.flags = new MessageFlagsBitField(MessageFlags.Ephemeral);
    if (variant === "publicConfirm") r.raw.customId = "rp:yes:en:abc-def";
    await handleInteraction(r.interaction, r.service, botId);
    assert.equal(r.service.drafts.size, 0);
    assert.deepEqual(r.writes, []);
    assert.equal(r.calls[0]?.method, "reply");
  });
}
test("unexpected API error is sanitized and never displayed verbatim", async () => {
  const r = interactionRig("command");
  r.service.port.snapshot = async () => {
    throw new Error("private-token-and-payload");
  };
  await handleInteraction(r.interaction, r.service, botId);
  assert(!JSON.stringify(r.calls).includes("private-token-and-payload"));
  assert.deepEqual(r.writes, []);
});
test("failed preview delivery releases draft capacity", async () => {
  const r = interactionRig("command");
  r.raw.editReply = async () => {
    throw new Error("network");
  };
  await handleInteraction(r.interaction, r.service, botId);
  assert.equal(r.service.drafts.size, 0);
});

test("old public panel works with new process state but removed allowlist roles do not", async () => {
  const r = interactionRig("button", `rp:pick:en:${roleId}`);
  assert.equal(r.service.drafts.size, 0);
  await handleInteraction(r.interaction, r.service, botId);
  assert.equal(r.service.drafts.size, 1);
  const removed = new RoleService(who.guild, [], r.service.port);
  r.raw.deferred = false;
  r.calls.length = 0;
  await handleInteraction(r.interaction, removed, botId);
  assert.equal(removed.drafts.size, 0);
  assert.deepEqual(r.writes, []);
});
