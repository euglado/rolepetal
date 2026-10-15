import assert from "node:assert/strict";
import test from "node:test";
import {
  SafeError,
  type Snapshot,
  safeRole,
  visibleName,
} from "../src/policy.ts";
import { type Identity, type Port, RoleService } from "../src/service.ts";

const who: Identity = { user: "member", guild: "guild", channel: "channel" };
function rig() {
  let time = 1000;
  const snapshot: Snapshot = {
    access: true,
    manager: true,
    memberRoles: new Set(),
    roles: [
      {
        id: "role",
        name: "Gardener",
        permissions: 0n,
        managed: false,
        belowBot: true,
        belowMember: true,
        overwritten: false,
      },
    ],
  };
  const writes: {
    kind: string;
    user: string;
    role?: string;
    add?: boolean;
    lang?: string;
    nonce?: string;
  }[] = [];
  let reads = 0;
  const port: Port = {
    async snapshot() {
      reads++;
      return snapshot;
    },
    async publish(w, _roles, lang, nonce) {
      writes.push({ kind: "publish", user: w.user, lang, nonce });
    },
    async setRole(w, role, add) {
      writes.push({ kind: "role", user: w.user, role, add });
    },
  };
  const service = new RoleService(who.guild, ["role"], port, () => time);
  return {
    service,
    snapshot,
    writes,
    port,
    reads: () => reads,
    advance: (ms: number) => {
      time += ms;
    },
  };
}
const rejects = (run: Promise<unknown>, code: string) =>
  assert.rejects(run, (e) => e instanceof SafeError && e.code === code);

test("viewing and cancelling never assign roles or publish", async () => {
  const r = rig();
  const d = await r.service.preview(who, "tr", "role");
  r.service.bind(d.id, "private");
  assert.equal(d.add, true);
  assert.equal(r.service.discard(d.id, who, "private"), "tr");
  assert.deepEqual(r.writes, []);
});
for (const present of [false, true]) {
  test(`explicit confirmation ${present ? "removes" : "adds"} only the requested own role`, async () => {
    const r = rig();
    if (present) r.snapshot.memberRoles.add("role");
    r.snapshot.memberRoles.add("untouched");
    const d = await r.service.preview(who, "en", "role");
    r.service.bind(d.id, "private");
    assert.equal(await r.service.confirm(d.id, who, "private"), "role");
    assert.deepEqual(r.writes, [
      { kind: "role", user: "member", role: "role", add: !present },
    ]);
    assert.equal(r.reads(), 2);
    assert(r.snapshot.memberRoles.has("untouched"));
    await rejects(r.service.confirm(d.id, who, "private"), "expired");
  });
}
test("publishing requires confirmation, persists language, and carries a deduplication nonce", async () => {
  const r = rig();
  const d = await r.service.preview(who, "tr");
  r.service.bind(d.id, "private");
  assert.equal(r.writes.length, 0);
  assert.equal(await r.service.confirm(d.id, who, "private"), "panel");
  assert.equal(r.writes[0]?.lang, "tr");
  assert.equal(r.writes[0]?.nonce?.length, 24);
  assert.equal(r.reads(), 2);
});
for (const variant of [
  "user",
  "guild",
  "channel",
  "message",
  "unbound",
] as const) {
  test(`confirmation is bound to ${variant}`, async () => {
    const r = rig();
    const d = await r.service.preview(who, "en", "role");
    if (variant !== "unbound") r.service.bind(d.id, "private");
    const identity = { ...who };
    if (variant === "user" || variant === "guild" || variant === "channel")
      identity[variant] = "other";
    await rejects(
      r.service.confirm(
        d.id,
        identity,
        variant === "message" ? "other" : "private",
      ),
      "expired",
    );
    assert.deepEqual(r.writes, []);
    // Another person's failed attempt must not consume the owner's preview.
    assert(r.service.drafts.has(d.id));
  });
}
for (const mutation of [
  "permissions",
  "managed",
  "belowBot",
  "overwritten",
  "removed",
  "access",
] as const) {
  test(`fresh ${mutation} check prevents a previously previewed assignment`, async () => {
    const r = rig();
    const d = await r.service.preview(who, "en", "role");
    r.service.bind(d.id, "private");
    const role = r.snapshot.roles[0];
    assert(role);
    if (mutation === "permissions") role.permissions = 8n;
    else if (mutation === "managed" || mutation === "overwritten")
      role[mutation] = true;
    else if (mutation === "belowBot") role.belowBot = false;
    else if (mutation === "removed") r.snapshot.roles = [];
    else r.snapshot.access = false;
    await rejects(
      r.service.confirm(d.id, who, "private"),
      mutation === "access" ? "access" : "unsafe",
    );
    assert.deepEqual(r.writes, []);
    assert.equal(r.service.drafts.size, 0);
  });
}
for (const mutation of ["manager", "belowMember"] as const) {
  test(`publication rechecks ${mutation}`, async () => {
    const r = rig();
    const d = await r.service.preview(who, "en");
    r.service.bind(d.id, "private");
    if (mutation === "manager") r.snapshot.manager = false;
    else {
      const role = r.snapshot.roles[0];
      assert(role);
      role.belowMember = false;
    }
    await rejects(
      r.service.confirm(d.id, who, "private"),
      mutation === "manager" ? "manager" : "unsafe",
    );
    assert.deepEqual(r.writes, []);
  });
}
test("ordinary members can choose roles but cannot publish", async () => {
  const r = rig();
  r.snapshot.manager = false;
  await rejects(r.service.preview(who, "en"), "manager");
  r.advance(5000);
  assert.equal((await r.service.preview(who, "en", "role")).kind, "role");
});
for (const kind of ["panel", "role"] as const) {
  test(`${kind} role rename requires a new preview`, async () => {
    const r = rig();
    const d = await r.service.preview(
      who,
      "en",
      kind === "role" ? "role" : undefined,
    );
    r.service.bind(d.id, "private");
    const role = r.snapshot.roles[0];
    assert(role);
    role.name = "Changed";
    await rejects(r.service.confirm(d.id, who, "private"), "stale");
    assert.deepEqual(r.writes, []);
  });
  test(`${kind} network uncertainty is consumed without retries`, async () => {
    const r = rig();
    let attempts = 0;
    const fail = async () => {
      attempts++;
      throw new Error("sensitive API payload");
    };
    r.port.publish = fail;
    r.port.setRole = fail;
    const d = await r.service.preview(
      who,
      "en",
      kind === "role" ? "role" : undefined,
    );
    r.service.bind(d.id, "private");
    await rejects(r.service.confirm(d.id, who, "private"), "delivery");
    await rejects(r.service.confirm(d.id, who, "private"), "expired");
    assert.equal(attempts, 1);
  });
}
test("changed role membership never toggles an unexpected state", async () => {
  const r = rig();
  const d = await r.service.preview(who, "en", "role");
  r.service.bind(d.id, "private");
  r.snapshot.memberRoles.add("role");
  await rejects(r.service.confirm(d.id, who, "private"), "stale");
  assert.deepEqual(r.writes, []);
});
test("unconfigured role and other server fail closed", async () => {
  const r = rig();
  await rejects(r.service.preview(who, "en", "other"), "unsafe");
  await rejects(
    r.service.preview({ ...who, guild: "other" }, "en", "role"),
    "access",
  );
  assert.deepEqual(r.writes, []);
});
test("member previews are throttled and recover at boundary", async () => {
  const r = rig();
  await r.service.preview(who, "en", "role");
  r.advance(4999);
  await rejects(r.service.preview(who, "en", "role"), "busy");
  r.advance(1);
  await r.service.preview(who, "en", "role");
});
test("another manager cannot bypass channel publication cooldown", async () => {
  const r = rig();
  const d = await r.service.preview(who, "en");
  r.service.bind(d.id, "a");
  await r.service.confirm(d.id, who, "a");
  const other = { ...who, user: "other" };
  const e = await r.service.preview(other, "en");
  r.service.bind(e.id, "b");
  await rejects(r.service.confirm(e.id, other, "b"), "busy");
  assert.equal(r.writes.length, 1);
  r.advance(60000);
  const f = await r.service.preview(other, "en");
  r.service.bind(f.id, "c");
  await r.service.confirm(f.id, other, "c");
  assert.equal(r.writes.length, 2);
});
test("expired preview never performs fresh writes", async () => {
  const r = rig();
  const d = await r.service.preview(who, "en", "role");
  r.service.bind(d.id, "a");
  r.advance(120000);
  await rejects(r.service.confirm(d.id, who, "a"), "expired");
  assert.deepEqual(r.writes, []);
  assert.equal(r.service.drafts.size, 0);
});
test("expiry during permission refresh fails closed", async () => {
  const r = rig();
  const d = await r.service.preview(who, "en", "role");
  r.service.bind(d.id, "a");
  r.port.snapshot = async () => {
    r.advance(120000);
    return r.snapshot;
  };
  await rejects(r.service.confirm(d.id, who, "a"), "expired");
  assert.deepEqual(r.writes, []);
});
test("concurrent duplicate confirmation causes exactly one write", async () => {
  const r = rig();
  const d = await r.service.preview(who, "en", "role");
  r.service.bind(d.id, "a");
  const results = await Promise.allSettled([
    r.service.confirm(d.id, who, "a"),
    r.service.confirm(d.id, who, "a"),
  ]);
  assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(r.writes.length, 1);
});
test("concurrent confirmations from one member cannot compete", async () => {
  const r = rig();
  const d = await r.service.preview(who, "en", "role");
  r.service.bind(d.id, "a");
  r.advance(5000);
  const e = await r.service.preview(who, "en", "role");
  r.service.bind(e.id, "b");
  const results = await Promise.allSettled([
    r.service.confirm(d.id, who, "a"),
    r.service.confirm(e.id, who, "b"),
  ]);
  assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(r.writes.length, 1);
});
test("simultaneous different-member previews obey global capacity", async () => {
  const r = rig();
  for (let i = 0; i < 150; i++)
    await r.service.preview({ ...who, user: `existing${i}` }, "en", "role");
  const results = await Promise.allSettled(
    Array.from({ length: 101 }, (_, i) =>
      r.service.preview({ ...who, user: `u${i}` }, "en", "role"),
    ),
  );
  assert.equal(results.filter((x) => x.status === "fulfilled").length, 50);
  assert.equal(r.service.drafts.size, 200);
  r.advance(120000);
  r.service.prune();
  assert.equal(r.service.drafts.size, 0);
});
test("in-flight REST work is bounded before previews have finished", async () => {
  const r = rig();
  const results = await Promise.allSettled(
    Array.from({ length: 101 }, (_, i) =>
      r.service.preview({ ...who, user: `u${i}` }, "en", "role"),
    ),
  );
  assert.equal(results.filter((x) => x.status === "fulfilled").length, 100);
  assert.equal(r.reads(), 100);
});
test("cooldown storage stays bounded and prunes", async () => {
  const r = rig();
  for (let i = 0; i < 1000; i++) {
    const d = await r.service.preview({ ...who, user: `u${i}` }, "en", "role");
    r.service.forget(d.id);
  }
  await rejects(
    r.service.preview({ ...who, user: "overflow" }, "en", "role"),
    "capacity",
  );
  r.advance(5000);
  assert(
    (await r.service.preview({ ...who, user: "overflow" }, "en", "role")).id,
  );
});
test("names cannot inject mentions, control characters or Markdown", () => {
  assert.equal(
    visibleName("**@everyone**\n<@123>\u202e`test`"),
    "everyone 123 test",
  );
  assert.equal(visibleName("@<>"), "Role / Rol");
  assert.equal(visibleName("x".repeat(100)).length, 80);
});
test("safe role must be explicitly allowlisted", () => {
  const r = rig();
  assert.throws(() => safeRole(r.snapshot, "role", []), SafeError);
});

test("adding a zero-permission role cannot raise member hierarchy", async () => {
  const r = rig();
  const role = r.snapshot.roles[0];
  assert(role);
  role.belowMember = false;
  await rejects(r.service.preview(who, "en", "role"), "unsafe");
  assert.deepEqual(r.writes, []);
});
test("losing the higher membership role after preview prevents addition", async () => {
  const r = rig();
  const d = await r.service.preview(who, "en", "role");
  r.service.bind(d.id, "private");
  const role = r.snapshot.roles[0];
  assert(role);
  role.belowMember = false;
  await rejects(r.service.confirm(d.id, who, "private"), "unsafe");
  assert.deepEqual(r.writes, []);
});
test("a member may remove a cosmetic role even if it became their highest", async () => {
  const r = rig();
  const role = r.snapshot.roles[0];
  assert(role);
  role.belowMember = false;
  r.snapshot.memberRoles.add("role");
  const d = await r.service.preview(who, "en", "role");
  r.service.bind(d.id, "private");
  await r.service.confirm(d.id, who, "private");
  assert.equal(r.writes[0]?.add, false);
});
test("two managers confirming concurrently cannot publish duplicate panels", async () => {
  const r = rig();
  const other = { ...who, user: "other" };
  const d = await r.service.preview(who, "en");
  r.service.bind(d.id, "a");
  const e = await r.service.preview(other, "en");
  r.service.bind(e.id, "b");
  const results = await Promise.allSettled([
    r.service.confirm(d.id, who, "a"),
    r.service.confirm(e.id, other, "b"),
  ]);
  assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(r.writes.length, 1);
});
