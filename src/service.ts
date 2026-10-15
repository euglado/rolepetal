import { randomUUID } from "node:crypto";
import { type Language, SafeError, type Snapshot, safeRole } from "./policy.ts";

export interface Identity {
  user: string;
  guild: string;
  channel: string;
}
export interface Port {
  snapshot(who: Identity): Promise<Snapshot>;
  publish(
    who: Identity,
    roles: string[],
    lang: Language,
    nonce: string,
  ): Promise<void>;
  setRole(who: Identity, role: string, add: boolean): Promise<void>;
}
export interface Draft {
  id: string;
  who: Identity;
  lang: Language;
  expires: number;
  message: string | null;
  kind: "panel" | "role";
  role: string;
  add: boolean;
  names: string[];
}
export class RoleService {
  readonly drafts = new Map<string, Draft>();
  private readonly busy = new Set<string>();
  private readonly cooldowns = new Map<string, number>();
  readonly guild: string;
  readonly allowed: readonly string[];
  readonly port: Port;
  readonly now: () => number;
  constructor(
    guild: string,
    allowed: readonly string[],
    port: Port,
    now: () => number = Date.now,
  ) {
    this.guild = guild;
    this.allowed = [...allowed];
    this.port = port;
    this.now = now;
  }
  prune(): void {
    for (const [id, d] of this.drafts)
      if (d.expires <= this.now()) this.drafts.delete(id);
    for (const [key, until] of this.cooldowns)
      if (until <= this.now()) this.cooldowns.delete(key);
  }
  private gate(who: Identity): void {
    if (who.guild !== this.guild) throw new SafeError("access");
    this.prune();
    if (this.drafts.size >= 200) throw new SafeError("capacity");
    this.throttle(`user:${who.user}`, 5000);
  }
  private throttle(key: string, duration: number): void {
    this.prune();
    if ((this.cooldowns.get(key) ?? 0) > this.now())
      throw new SafeError("busy");
    if (this.cooldowns.size >= 1000) throw new SafeError("capacity");
    this.cooldowns.set(key, this.now() + duration);
  }
  private async locked<T>(key: string, run: () => Promise<T>): Promise<T> {
    if (this.busy.has(key)) throw new SafeError("busy");
    if (this.busy.size >= 100) throw new SafeError("capacity");
    this.busy.add(key);
    try {
      return await run();
    } finally {
      this.busy.delete(key);
    }
  }
  private save(
    who: Identity,
    lang: Language,
    kind: Draft["kind"],
    names: string[],
    role = "",
    add = false,
  ): Draft {
    // Recheck capacity after awaited REST reads; concurrent previews cannot exceed it.
    this.prune();
    if (this.drafts.size >= 200) throw new SafeError("capacity");
    const draft: Draft = {
      id: randomUUID(),
      who: { ...who },
      lang,
      kind,
      names,
      role,
      add,
      message: null,
      expires: this.now() + 120000,
    };
    this.drafts.set(draft.id, draft);
    return draft;
  }
  async preview(who: Identity, lang: Language, role?: string): Promise<Draft> {
    this.gate(who);
    return this.locked(`user:${who.user}`, async () => {
      const snapshot = await this.port.snapshot(who);
      if (role !== undefined) {
        const valid = safeRole(snapshot, role, this.allowed);
        // Adding a higher cosmetic role can still expand a moderator's hierarchy.
        // Keep additions below the member's existing highest role; removal may lower it.
        if (!snapshot.memberRoles.has(role) && !valid.belowMember)
          throw new SafeError("unsafe");
        return this.save(
          who,
          lang,
          "role",
          [valid.name],
          role,
          !snapshot.memberRoles.has(role),
        );
      }
      const names = this.allowed.map(
        (id) => safeRole(snapshot, id, this.allowed, true).name,
      );
      return this.save(who, lang, "panel", names);
    });
  }
  bind(id: string, message: string): void {
    const d = this.drafts.get(id);
    if (d) d.message = message;
  }
  forget(id: string): void {
    this.drafts.delete(id);
  }
  private take(id: string, who: Identity, message: string): Draft {
    this.prune();
    const d = this.drafts.get(id);
    if (
      !d ||
      d.who.user !== who.user ||
      d.who.guild !== who.guild ||
      d.who.channel !== who.channel ||
      d.message !== message ||
      who.guild !== this.guild
    )
      throw new SafeError("expired");
    this.drafts.delete(id);
    return d;
  }
  discard(id: string, who: Identity, message: string): Language {
    return this.take(id, who, message).lang;
  }
  async confirm(
    id: string,
    who: Identity,
    message: string,
  ): Promise<"panel" | "role"> {
    const d = this.take(id, who, message);
    return this.locked(`user:${who.user}`, async () => {
      const work = async () => {
        const snapshot = await this.port.snapshot(who);
        if (d.expires <= this.now()) throw new SafeError("expired");
        if (d.kind === "panel") {
          const names = this.allowed.map(
            (role) => safeRole(snapshot, role, this.allowed, true).name,
          );
          if (names.some((name, i) => name !== d.names[i]))
            throw new SafeError("stale");
          this.throttle(`channel:${who.channel}`, 60000);
          try {
            await this.port.publish(
              who,
              [...this.allowed],
              d.lang,
              d.id.replaceAll("-", "").slice(0, 24),
            );
          } catch {
            throw new SafeError("delivery");
          }
        } else {
          const role = safeRole(snapshot, d.role, this.allowed);
          if (d.add && !role.belowMember) throw new SafeError("unsafe");
          if (role.name !== d.names[0]) throw new SafeError("stale");
          if (snapshot.memberRoles.has(d.role) === d.add)
            throw new SafeError("stale");
          try {
            await this.port.setRole(who, d.role, d.add);
          } catch {
            throw new SafeError("delivery");
          }
        }
        return d.kind;
      };
      return d.kind === "panel"
        ? this.locked(`channel:${who.channel}`, work)
        : work();
    });
  }
}
