export type Language = "tr" | "en";
export type ErrorCode =
  | "expired"
  | "busy"
  | "capacity"
  | "unsafe"
  | "access"
  | "manager"
  | "stale"
  | "delivery";
export class SafeError extends Error {
  readonly code: ErrorCode;
  constructor(code: ErrorCode) {
    super(code);
    this.code = code;
  }
}
export interface RoleInfo {
  id: string;
  name: string;
  permissions: bigint;
  managed: boolean;
  belowBot: boolean;
  belowMember: boolean;
  overwritten: boolean;
}
export interface Snapshot {
  roles: RoleInfo[];
  memberRoles: Set<string>;
  manager: boolean;
  access: boolean;
}
export function safeRole(
  s: Snapshot,
  roleId: string,
  allowed: readonly string[],
  manager = false,
): RoleInfo {
  if (!s.access) throw new SafeError("access");
  if (manager && !s.manager) throw new SafeError("manager");
  const role = s.roles.find((r) => r.id === roleId);
  if (
    !allowed.includes(roleId) ||
    !role ||
    role.permissions !== 0n ||
    role.managed ||
    !role.belowBot ||
    role.overwritten ||
    (manager && !role.belowMember)
  )
    throw new SafeError("unsafe");
  return role;
}
export function visibleName(value: string): string {
  return (
    value
      .normalize("NFC")
      .replace(/[\p{Cc}\p{Cf}]/gu, " ")
      .replace(/[@`*_~|<>[\]\\]/g, "")
      .trim()
      .slice(0, 80) || "Role / Rol"
  );
}
export const messages = {
  en: {
    expired:
      "This preview expired, was used, or belongs to another person/channel. Start again.",
    busy: "Please wait a few seconds before trying again.",
    capacity: "The bot is busy. Try again after a few minutes.",
    unsafe:
      "Role unavailable: it must be allowlisted, unmanaged, below the bot, have no permissions and no channel overrides. Additions must also be below your existing highest role. Ask a server manager.",
    access:
      "Use a normal text channel you can view and write in. Check the bot's View Channel, Send Messages and Manage Roles permissions, role order and your timeout status. Administrator is not supported.",
    manager:
      "Manage Roles and a higher role are required to publish this panel.",
    stale:
      "Your roles changed after the preview. Nothing changed; choose the role again.",
    delivery:
      "Discord did not confirm the operation. Check the channel/your roles before trying again; the bot will not retry it.",
    publish: "Publish panel",
    cancel: "Cancel",
    confirm: "Confirm",
    panel: "Choose a cosmetic role",
    done: "Confirmed. Check your roles in your server profile.",
    posted: "Panel published.",
    cancelled: "Cancelled. No change made.",
    intro:
      "Choose a role to privately preview adding or removing it. Only your explicit confirmation changes your roles. Roles are public in your profile.",
  },
  tr: {
    expired:
      "Önizleme süresi doldu, kullanıldı veya başka kişiye/kanala ait. Yeniden başlayın.",
    busy: "Yeniden denemeden önce birkaç saniye bekleyin.",
    capacity: "Bot meşgul. Birkaç dakika sonra yeniden deneyin.",
    unsafe:
      "Rol kullanılamıyor: izin listesinde olmalı, entegrasyona bağlı olmamalı, bottan aşağıda olmalı, hiçbir izni veya kanal geçersiz kılması olmamalı. Eklenen rol mevcut en yüksek rolünüzden de aşağıda olmalı. Bir yöneticiye danışın.",
    access:
      "Görebildiğiniz ve yazabildiğiniz normal bir metin kanalı kullanın. Botun Kanalı Görüntüle, Mesaj Gönder ve Rolleri Yönet izinlerini, rol sırasını ve zaman aşımınızı kontrol edin. Yönetici izni desteklenmez.",
    manager:
      "Panel yayımlamak için Rolleri Yönet izni ve daha yüksek bir rol gerekir.",
    stale:
      "Önizlemeden sonra rolleriniz değişti. İşlem yapılmadı; rolü yeniden seçin.",
    delivery:
      "Discord işlemi doğrulamadı. Tekrar denemeden önce kanalı/rollerinizi kontrol edin; bot işlemi tekrarlamaz.",
    publish: "Paneli yayımla",
    cancel: "Vazgeç",
    confirm: "Onayla",
    panel: "Kozmetik rol seçin",
    done: "Onaylandı. Sunucu profilinizde rollerinizi kontrol edin.",
    posted: "Panel yayımlandı.",
    cancelled: "Vazgeçildi. Değişiklik yapılmadı.",
    intro:
      "Eklemek veya kaldırmak için bir rol seçip size özel önizlemeyi görün. Rolleriniz yalnızca açık onayınızla değişir. Roller profilinizde herkese görünür.",
  },
} as const;
