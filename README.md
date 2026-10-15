# RolePetal

Gönüllü kozmetik rol seçimi için gerçek bir Discord botu. / A real Discord bot for voluntary cosmetic role choices.

[Türkçe](#türkçe) · [English](#english) · [Privacy / Gizlilik](PRIVACY.md) · [Security / Güvenlik](SECURITY.md) · [Contributing / Katkı](CONTRIBUTING.md)

## Türkçe

### Amaç ve özellikler

Kitap, oyun, üretim veya müzik topluluğunuzdaki üyeler, örneğin “Bahçıvan” veya “Bulmaca sever” gibi **yalnızca görünüm/ilgi belirten** rolleri gönüllü seçebilir. Yönetici `/rolepetal language:Türkçe` ile paneli önce yalnızca kendisi görür ve **Paneli yayımla** düğmesine basar. Üye public panelde bir rol seçer; bot “eklenecek” veya “kaldırılacak” rolü yalnızca o üyeye gösterir. **Onayla** tıklanmadan rol değişmez. **Vazgeç** işlem yapmaz.

- Bir sunucu ve yapılandırmada açıkça izin verilen 1–4 mevcut rol; Türkçe/İngilizce panel ve açıklamalar.
- İki dakikalık, kişiye/sunucuya/kanala/özel mesaja bağlı tek kullanımlık önizlemeler.
- Yayından ve rol değişiminden önce REST üzerinden güncel rol, kanal ve üye kontrolleri.
- Botun altında, yönetilmeyen, izin bitleri sıfır olan ve sunucudaki hiçbir kanalda rol geçersiz kılması bulunmayan roller.
- **Rol ekleme mevcut en yüksek üye rolünü yükseltemez.** Bu, izin bitleri sıfır olsa bile moderatörün rol hiyerarşisi kapsamının genişlemesini engellemek içindir. Mevcut rolü kaldırırken bu üyeye göre sıra şartı uygulanmaz.
- Tekil rol ekleme/kaldırma uç noktaları; diğer rollerin listesi değiştirilmez. Otomatik yeniden deneme yok; belirsiz sonuçta kullanıcı mevcut rollerini kontrol eder.
- Panel düğmeleri yeniden başlatmadan sonra çalışabilir; yeniden başlatma bekleyen özel onayları sonlandırır. Discord'daki roller ve panel mesajları kalır.

Bot rol oluşturmaz, kendiliğinden rol dağıtmaz, başka üyeye rol vermez, tepki veya mesaj okumaz, DM göndermez, ses kanalına bağlanmaz ve veritabanı/analitik kullanmaz. Erişim, doğrulama, abonelik, moderasyon veya harici hizmet yetkilendirmesi için kullanmayın. Roller aynı anda seçilebilir; birbirini dışlayan gruplar veya otomatik süre sonu yoktur. Rol adları paylaşılır; hassas kimlik, sağlık veya kişisel bilgileri rol adına koymayın.

### Gereksinimler

Node.js **24.13.0 veya daha yeni bir 24.x** sürümü, beraberindeki npm, internet bağlantısı, kendi Discord bot uygulamanız ve sunucuda kurulum yetkisi gerekir. Windows/macOS/Linux desteklenir. Kaynak kodu düzenlemeniz gerekmez. Bot çalıştığı sürece çevrimiçi olur; bilgisayar uykuya girerse durur. GitHub Actions botu barındırmaz. Testler gerçek Discord bağlantısı yerine sahte etkileşimler kullanır; canlı kurulum ve mobil/ekran okuyucu davranışı operatör tarafından denenmelidir.

### 1. Sunucudaki rolleri hazırlayın

1. Sunucu Ayarları → Roller'de 1–4 yeni kozmetik rol oluşturun. **Bütün izin anahtarlarını kapatın.** Entegrasyona veya aboneliğe bağlı rolleri kullanmayın.
2. Sunucudaki **her kategori ve kanalın** izin ayarlarında bu rollere ait kayıtları tamamen kaldırın. İzinleri nötr gösteren bir geçersiz kılma kaydı bile kabul edilmez. Özel kanallar da kontrol edilir.
3. Mevcut olağan üyelik rolünüz (“Üye” gibi) kozmetik rollerin üstünde olmalıdır. Henüz bu tür bir rolü olmayan yeni üyeler rol ekleyemez; bot üyelik rolü dağıtmaz. Güvenlik doğrulamanızı bu bot üzerinden kurmayın.
4. Bot kurulduktan sonra rol sırası, örneğin **yönetici/moderatör > bot > mevcut Üye > kozmetik roller > @everyone** olsun. Bot rolünü yalnızca gerekli yere yükseltin; hiçbir yönetici/moderatör veya erişim rolünü botun altına taşımayın.
5. Discord Kullanıcı Ayarları → Gelişmiş → Geliştirici Modu'nu açın. Sunucuya sağ tıklayıp **Sunucu Kimliğini Kopyala**, her kozmetik rolün menüsünden **Rol Kimliğini Kopyala** seçin. Bunlar token değildir.

Rolleri harici botların veya web hizmetlerinin erişim anahtarı olarak kullanmayın. RolePetal bu hizmetlerin kurallarını göremez. Yönetici sonradan rol izni/kanal ayarı değiştirirse daha önce verilmiş roller kullanıcılarda kalır ve yeni erişimler sağlayabilir. Rolü yeniden amaçlandırmadan önce mevcut atamaları ve bütün entegrasyonları insan olarak inceleyin.

### 2. Developer Portal ve bot daveti

1. [Discord Developer Portal](https://discord.com/developers/applications) → **New Application**. Kendi botunuz için yeni bir uygulama oluşturun; adı RolePetal veya topluluğunuza uygun bir ad olabilir.
2. **General Information** ekranından **Application ID** değerini kopyalayın.
3. **Bot** ekranından token oluşturun/Reset Token yapın. Bu, hesabınızın kullanıcı tokenı değildir. Tokenı yalnızca kendi bilgisayarınızdaki gizli kurulum istemine girin. Sohbet, ekran görüntüsü, issue veya GitHub'a koymayın. Sızarsa hemen Reset Token yapın ve yerel kurulumu yenileyin.
4. **Privileged Gateway Intents** altındaki Message Content, Server Members ve Presence seçeneklerini **kapalı** bırakın. Bot yalnızca `Guilds` kullanır; tek bir üyeyi REST ile kontrol etmek için üye listesi intent'i istemez.
5. **Installation** içinde **Guild Install** kullanın; User Install gerekmez. Kapsamlar `bot` ve `applications.commands`. Bot izinleri yalnızca **View Channels / Kanalı Görüntüle**, **Send Messages / Mesaj Gönder**, **Manage Roles / Rolleri Yönet**: toplam `268438528`. **Administrator / Yönetici vermeyin; bot bunu reddeder.** Embed Links, Read Message History, Manage Messages veya Manage Channels gerekmez.
6. Aşağıdaki kurulum aracı bu izinlerle tıklanabilir davet bağlantısı verir. Bağlantıyı açıp doğru sunucuyu seçin. Davet için sunucuda uygulama ekleme yetkiniz olmalıdır.
7. Bir önceki bölümdeki rol sırasını ayarlayın. Panelin gönderileceği normal metin kanalında bot ve kullanıcı görebilmeli/yazabilmelidir. Thread/forum/duyuru kanalları desteklenmez; yavaş mod 60 saniyeden büyükse bot işlem yapmaz.

**Rolleri Yönet** güçlü bir Discord iznidir: uygulama tokenı ele geçirilirse saldırgan botun altındaki rolleri yönetebilir. Bot rolünü ayrı tutun, mümkün olduğunca aşağıda bırakın ve güvenilir bir makinede çalıştırın. Uygulamadaki korumalar, Discord'un tokena verdiği yetkiyi daraltmaz.

### 3. İndirme ve kurulum

Bu deponun **Code → Download ZIP** seçeneğiyle kaynakları indirin, ZIP'i çıkartın. [Node.js](https://nodejs.org/) 24.x kurup terminali yeniden açın. Windows'ta `setup.cmd` çalıştırabilirsiniz. macOS/Linux'ta klasörde terminal açıp `bash setup.sh` kullanın. Alternatif olarak proje klasöründe:

```sh
npm ci --ignore-scripts
npm run setup
```

Araç Application ID, Server ID ve virgülle ayrılmış 1–4 kozmetik Role ID ister. En son bot tokenını **gizli** ister: yazarken/paste ederken karakter veya yıldız gösterilmemesi normaldir. Enter ile tamamlayın; Ctrl+C ile vazgeçin. Kurulum gerçek etkileşimli terminal gerektirir; tokenı komut satırı argümanı yapmayın. Mevcut `.env` asla üzerine yazılmaz; hata varsa hiçbir yeni `.env` yazılmaz.

Aracın verdiği davet bağlantısını açın. Ardından Windows'ta `register.cmd`, macOS/Linux'ta `bash register.sh` veya:

```sh
npm run register
npm start
```

Kayıt yalnızca seçilen sunucudaki `/rolepetal` komutunu oluşturur/günceller; başka isimli uygulama komutlarını silmez. “RolePetal hazır” mesajından sonra bot çalışır. Sonraki açılışlarda `start.cmd` veya `bash start.sh` yeterlidir; kaynak değişmedikçe yeniden kayıt gerekmez. Ctrl+C ile durdurun.

### Yapılandırma ve çalışır tutma

`.env` içinde `DISCORD_TOKEN`, `APPLICATION_ID`, `GUILD_ID`, `ROLE_IDS` bulunur. Kurulum aracı bunları sizin için yazar. Sunucu/rol/token değişikliğinde botu durdurun, eski `.env` dosyasını güvenli şekilde kaldırın ve `npm run setup` çalıştırın; kaynak kodunu düzenlemeyin. Token dışındaki kimlikler gizli kimlik bilgisi sayılmaz, yine de gereksiz paylaşmayın. Gelişmiş barındırmada aynı adlarla ortam değişkenleri kullanabilirsiniz; mevcut süreç ortamı `.env` değerlerine üstün gelir. `.env.example` yalnızca örnektir.

Her bot uygulaması/sunucu için **tek bir süreç** çalıştırın. Birden fazla kopya çift yanıt ve yarış yaratabilir. Sürekli açık ve uyumayan bir bilgisayar veya Node.js 24 çalıştıran güvenilir barındırma kullanın; çalışma klasörü proje klasörü, başlangıç komutu `npm start` olsun. Tokenı barındırma hizmetinin secret bölümünde tutun. Ücretli hizmet satın almak zorunda değilsiniz; maliyet ve şartlar operatöre aittir. Yeniden başlatma otomasyonu için işletim sisteminizin servis yöneticisini kullanabilirsiniz; bu depo üretim makinenize servis kurmaz.

### Kullanım

Rolleri Yönet yetkisi olan ve seçilen rollerin üstünde bulunan bir yönetici normal metin kanalında `/rolepetal language:Türkçe` kullanır. Özel önizlemedeki roller doğruysa **Paneli yayımla** seçilir. Üye public panelden rol düğmesine basar; ekleme/kaldırma önizlemesini kontrol edip **Onayla** seçer. Başka kişiye rol verme yoktur. Rol adları Markdown/mention/control karakterlerinden arındırılır; rol kimliği de gösterilerek aynı adlı roller ayırt edilir. Paneldeki dil özel akışta korunur.

Üye başına önizleme açma aralığı 5 saniye; kanal başına public panel yayımlama aralığı 60 saniyedir. En fazla 200 bekleyen önizleme ve 1000 kısa ömürlü cooldown kaydı vardır; 30 saniyelik bakım süresi dolmuş kayıtları temizler. Onaylar kullanıldıktan sonra kaldırılır. Eski mesajları silmek yöneticiye aittir. Paneli silmek, daha önce açılmış iki dakikalık özel onayları tek başına iptal etmez; acil durdurmada botu durdurun. İzin listesini değiştirip yeniden başlatmak bekleyen onayları temizler ve eski panelde kaldırılan rolleri engeller. Daha önce verilmiş roller otomatik kaldırılmaz.

### Güvenlik ve gizlilik

Mesaj geçmişi, DM, tepki veya bütün üye listesi okunmaz. Discord'un normal denetim günlüğünde rol değişikliği ve bot kimliği görünebilir. Rol isimleri, kimlikleri ve seçilen roller Discord profillerinde görünür; gizli oylama/tercih aracı değildir. Botun RAM'inde bekleyen istek için üye/sunucu/kanal/özel mesaj kimliği, rol kimliği/adı ve hedef işlem en fazla iki dakika, kısa cooldown kimlikleri 5/60 saniye kalır. SDK çalışma sırasında sunucu/rol/kanal metaverisini önbellekte tutar; mesaj, üye ve kullanıcı yönetici önbellekleri devre dışıdır. Geçici REST yanıtları çöp toplama gerçekleşene kadar bellekte bulunabilir. Diskte operasyon geçmişi tutulmaz; `.env` token içerir ve gitignore kapsamındadır. Windows'ta dosya ACL'lerini kontrol edin; Unix izin modu `0600` kullanılır.

Discord verileri kendi saklama kurallarına göre işler. Panel mesajları, rol atamaları ve Discord denetim kayıtları RAM önizlemesi sona erince silinmez. Hata mesajları ham API içeriği, token veya üye kimliği yazdırmaz. Bağımlılıklar sabitlenmiştir; güvenlik güncellemelerini ve [Discord Developer Policy](https://support-dev.discord.com/hc/en-us/articles/8563934450327-Discord-Developer-Policy) şartlarını düzenli izleyin. Kontrol ile rol değişikliği Discord'da atomik bir işlem değildir: yöneticinin aynı anda rol/kanal ayarı değiştirmesiyle oluşabilecek yarış tamamen engellenemez. Kritik izin değişikliği sırasında botu durdurun. Ayrıntılar [PRIVACY.md](PRIVACY.md) ve [SECURITY.md](SECURITY.md).

### Sorun giderme

- **Komut yok:** Davet kapsamlarında `applications.commands` bulunduğunu, doğru Application/Server ID ve `npm run register` başarısını kontrol edin. Discord'u yenileyin. Sunucu Entegrasyonlar ayarları da komut erişimini kısıtlayabilir.
- **Rol kullanılamıyor:** Rol kimliği izin listesinde mi? Bütün izin bitleri kapalı mı? Özel kanallar dahil herhangi bir kanalda bu rol kaydı var mı? Rol bottan ve ekleme yapılacak üyenin mevcut en yüksek rolünden aşağıda mı? Entegrasyon rolü mü? Rol seçildikten sonra adı/sırası değiştiyse yeni önizleme açın.
- **Yeni üyeler alamıyor:** Onların mevcut en yüksek rolü kozmetik rolün üstünde olmalı. Bot bir üyelik/giriş denetimi sağlamaz; sunucunun mevcut üyelik sürecini kullanın.
- **Erişim/403:** Botta yalnızca gereken üç izin olsun; Yönetici kapalı olsun. Kanalda bot ve kullanıcı görebilmeli/yazabilmeli. Kullanıcının zaman aşımı/üyelik taraması tamamlanmalı. Sunucunun 2FA şartı gibi ek Discord kuralları da işlemi reddedebilir.
- **Süre doldu/meşgul:** İki dakika içinde yeniden önizleme açın; 5 saniyelik üye ve 60 saniyelik yayın aralığını bekleyin. Yeniden başlatmadan önceki onaylar kullanılamaz.
- **Sonuç belirsiz:** Rol profilini veya panel kanalını kontrol edin. Bot belirsiz işlemi tekrarlamaz. Aynı değişikliği görmeden tekrar onaylamayın.
- **Token/kurulum/PowerShell hatası:** Node 24.x ve `node --version` kontrolü; gerçek terminal kullanın. PowerShell `npm.ps1` engelliyorsa `npm.cmd` veya `.cmd` yardımcılarını kullanın; güvenlik politikasını değiştirmeyin. Var olan `.env` üzerine yazılmaz. Token sızıntısında Portal'dan sıfırlayın.
- **Çevrimdışı:** Terminal açık, makine uyanık ve bağlantı çalışır olsun. GitHub'da deponun public olması botun canlı olduğu anlamına gelmez.

### Testler, katkı ve lisans

```sh
npm ci --ignore-scripts
npm run check
npm audit --audit-level=low
```

`check`: Biome önerilen kuralları/formatı, katı TypeScript (bağımlılık tipleri dahil), Node testleri, kilitli bağımlılık lisans/registry/SHA-512/install-script kontrolü ve kaynakta kimlik bilgisi örüntüsü taraması. Tarama tüm sırları bulma garantisi vermez. CI aynı kontrolleri Ubuntu, Windows ve macOS 15 Intel'de, token olmadan çalıştırır; yardımcı Bash/Node dosyalarının sözdizimini ve temiz Git farkını da kontrol eder. Testler gerçek giriş noktalarının yapılandırmasız güvenli kapanmasını, izin ve hiyerarşi kontrollerini, kişiye bağlı onayları, eşzamanlılığı ve belirsiz teslimatı kapsar. Canlı Discord kurulumu, gizli token girişi, ekran okuyucu ve uzun süreli barındırma ayrıca insan tarafından doğrulanmalıdır.

Hata/özellik talebi için [Issues](https://github.com/euglado/rolepetal/issues) kullanın; token veya kişisel veri eklemeyin. Değişiklikler için [CONTRIBUTING.md](CONTRIBUTING.md). MIT lisanslıdır; [LICENSE](LICENSE). Bağımlılıklar kendi lisanslarını korur; toplulukla veya Discord ile resmi bağlantı iddiası yoktur.

## English

### Purpose and features

RolePetal lets community members voluntarily add/remove **purely cosmetic, non-authorizing** roles such as “Gardener” or “Puzzle fan.” A manager runs `/rolepetal language:English`, checks a private preview and presses **Publish panel**. A member selects a public role button, reviews a personal “add” or “remove” preview and presses **Confirm**. Selecting a button alone does not change roles. **Cancel** makes no change.

- One configured server, 1–4 explicitly allowlisted existing roles, English/Turkish UI.
- Two-minute, one-use previews bound to member/server/channel/private message.
- Fresh REST role/channel/member checks before posting or changing a role.
- Roles must be unmanaged, below the bot, have zero permission bits and no role overwrite record in **any** server channel, including private channels.
- Additions must be below the member's **existing highest role**. A zero-permission role can still expand a moderator's hierarchy, so increasing that hierarchy is rejected. Removing an existing cosmetic role does not require it to be below the member.
- Singular idempotent role endpoints preserve all other roles. Uncertain operations are not automatically retried. Check the actual profile/channel before acting again.
- Public panels can work after restart; private confirmations expire on restart. Assigned Discord roles and public messages persist.

No role creation, automatic assignment, changes to other members, message/reaction reading, DMs, voice access, database or analytics. Do not use for access control, verification, subscriptions, moderation or external authorization. Roles are independently selectable, with no exclusive groups or automatic expiry. Do not encode sensitive identity, health or personal data in role names.

### Requirements

Node.js **24.13.0 or later within 24.x**, npm, internet, your own Discord application and permission to install it in the server. Windows/macOS/Linux supported; no source editing needed. The bot runs only while its process and host are awake. GitHub Actions does not host it. Automated tests mock Discord; live installation and mobile/screen-reader behavior need operator validation.

### 1. Prepare server roles

1. In Server Settings → Roles, create 1–4 cosmetic roles. Turn **all permission switches off**. Do not use managed integration/subscription roles.
2. Remove every overwrite entry for these roles from every category/channel, including private ones. Even an all-neutral overwrite record is rejected.
3. Members must already have a normal membership role above the cosmetic roles. New members whose only role is `@everyone` cannot add a cosmetic role. RolePetal does not distribute membership roles or implement verification.
4. After invitation, arrange roles for example as **administrators/moderators > bot > existing Member > cosmetic roles > @everyone**. Place the bot only as high as necessary. Keep administrative, moderation and access roles above it.
5. Enable User Settings → Advanced → Developer Mode. Right-click the server → **Copy Server ID**; use each role's menu to **Copy Role ID**. IDs are different from the bot token.

Never use these roles as authorization keys in other bots/web services; RolePetal cannot inspect external rules. If an administrator later gives a previously cosmetic role permissions or channel overrides, already assigned roles remain and may grant new access. Review existing assignments and integrations before repurposing a role.

### 2. Developer Portal and invitation

1. Open [Discord Developer Portal](https://discord.com/developers/applications), choose **New Application** and create your own bot application.
2. Copy **Application ID** from General Information.
3. Under **Bot**, generate/reset the bot token. Use only your own application token, never a Discord user token. Enter it only into the local hidden setup prompt; never share it in chats, screenshots, issues or GitHub. Reset a leaked token immediately.
4. Leave **Message Content, Server Members and Presence privileged intents disabled**. Only `Guilds` is requested. Looking up a single acting member via REST does not require member-list access.
5. In **Installation**, use **Guild Install** with `bot` and `applications.commands`. Request only **View Channels, Send Messages, Manage Roles**, permission integer `268438528`. **Do not grant Administrator; the bot rejects it.** Read Message History, Embed Links, Manage Messages and Manage Channels are unnecessary.
6. Setup prints a clickable invitation with those scopes/permissions. Open it and install in the intended server using an account permitted to add apps.
7. Adjust role order as above. Use a normal text channel where both the bot and acting member can view/send. Threads, forums and announcement channels are unsupported. Slowmode over 60 seconds is rejected.

**Manage Roles is powerful:** a stolen application token can manage roles below the bot. Keep its role separate and as low as possible, and run on a trusted host. Application safeguards do not narrow the permissions Discord grants to that token.

### 3. Download and setup

Use **Code → Download ZIP** on this repository and extract it. Install [Node.js](https://nodejs.org/) 24.x and reopen your terminal. Windows: run `setup.cmd`. macOS/Linux: open a terminal in the folder and run `bash setup.sh`. Or run:

```sh
npm ci --ignore-scripts
npm run setup
```

Enter Application ID, Server ID and 1–4 comma-separated cosmetic Role IDs. The last prompt asks for the bot token **without echoing characters or stars**; paste/type and press Enter. Ctrl+C cancels. Use a real interactive terminal; do not pass a token as a command-line argument. Setup never overwrites an existing `.env` and writes no new configuration on invalid input.

Open the printed invitation. Windows: run `register.cmd`; macOS/Linux: `bash register.sh`. Or:

```sh
npm run register
npm start
```

Registration upserts only this server's `/rolepetal` command, preserving other named application commands. After “RolePetal ready,” use the bot in Discord. On later launches, `start.cmd` or `bash start.sh` is enough; registration only needs repeating when the command definition changes. Ctrl+C stops the bot.

### Configuration and keeping it online

Setup writes `DISCORD_TOKEN`, `APPLICATION_ID`, `GUILD_ID`, `ROLE_IDS` into `.env`. To change them, stop the bot, securely remove the old `.env` and rerun setup; do not edit source. Advanced hosts may supply the same environment variables; existing process variables take precedence over `.env`. `.env.example` is illustrative only.

Run **one process per application/server** to avoid duplicate responses/races. Use an awake computer or trusted Node 24 host, set this project as working directory and `npm start` as startup command. Keep the token in the host's secret store. No paid service is required; hosting costs/terms are the operator's responsibility. Your OS service manager may supervise the process; this repository does not install a production service for you.

### Usage

A manager with **Manage Roles** and a role above every offered role runs `/rolepetal language:English` in a normal text channel. Review the private panel and select **Publish panel**. Members select a public button, check the private add/remove action and press **Confirm**. Only the acting member changes. Role names have mentions, Markdown and control characters removed; IDs disambiguate duplicate names. The panel's language continues through the personal flow.

Member previews are limited to one per 5 seconds; public panels to one per channel per 60 seconds. Maximum 200 pending previews and 1000 short-lived cooldown entries; periodic pruning every 30 seconds. Confirmations are consumed once. Managers manually delete old public panels. Deleting a panel does not cancel already opened two-minute private confirmations; stop the bot for an emergency halt. Changing the allowlist and restarting clears pending confirmations and blocks removed roles on old panels. Previously assigned roles are not automatically removed.

### Permissions, security and privacy

The bot reads no message history, DMs, reactions or full member list. It reads role/channel metadata and the acting member/bot's current role/permission state. Role changes can appear in Discord's normal audit log. Panel names/IDs and profile roles are public; this is not a private preference tool. RAM previews hold member/server/channel/private-message IDs, role names/IDs and intended action for up to two minutes; cooldown IDs remain for 5/60 seconds. The SDK caches guild/role/channel metadata while running; message/member/user manager caches are disabled. Temporary REST responses can remain until garbage collection. No operation history is written to disk. `.env` contains the token and is ignored by Git; Unix creation uses mode `0600`, while Windows operators should review file ACLs.

Discord processes data under its own retention policies. Public messages, assigned roles and Discord audit entries outlive RAM previews. Errors omit raw API payloads, tokens and member IDs. Keep pinned dependencies updated and follow the [Discord Developer Policy](https://support-dev.discord.com/hc/en-us/articles/8563934450327-Discord-Developer-Policy). Safety checks and role mutation cannot be atomic across Discord endpoints: concurrent administrator changes can still race with an operation. Stop the bot during critical permission changes. See [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md).

### Troubleshooting

- **Missing command:** verify invitation includes `applications.commands`, application/server IDs match, registration succeeded and server integration restrictions allow the command. Refresh Discord.
- **Role unavailable:** check allowlist, zero permissions, absence of all channel overwrite entries (including private channels), bot hierarchy and member's existing highest role for additions. Managed roles cannot be selected. Name/state changes require a new preview.
- **New members cannot add:** an existing membership role must be above cosmetics. Use your server's established membership process; RolePetal does not provide one.
- **Access/403:** check the three required bot permissions, Administrator disabled, channel visibility/send rights, timeout/membership screening and role order. Discord may impose additional server rules such as 2FA requirements.
- **Expired/busy:** open a new preview and confirm within two minutes; respect 5-second member and 60-second publication delays. Confirmations from before a restart are invalid.
- **Uncertain result:** inspect your actual role profile or panel channel. There is no automatic mutation retry. Do not blindly repeat an operation.
- **Setup/token/PowerShell failure:** install Node 24.x, check `node --version`, use a real terminal. If `npm.ps1` is blocked, use `npm.cmd` or `.cmd` helpers instead of changing security policy. Existing `.env` is protected from overwrites. Reset leaked tokens in the Portal.
- **Offline:** keep the process, machine and connection running. A public GitHub repository does not imply a running bot.

### Tests

```sh
npm ci --ignore-scripts
npm run check
npm audit --audit-level=low
```

`check` runs recommended Biome lint/format, strict TypeScript including dependency types, Node tests, dependency license/registry/SHA-512/no-install-script checks and source credential-pattern scanning. Pattern scanning cannot guarantee absence of secrets. CI runs these on Ubuntu, Windows and macOS 15 Intel without Discord tokens, along with helper syntax and clean Git diff checks. Tests exercise real unconfigured entry points, safety/hierarchy checks, owner-bound confirmations, concurrency and uncertain delivery with mocked Discord interactions. Actual installation, hidden-token input, mobile/screen-reader access and continuous hosting require operator validation.

### Contribution and license

Report bugs/features or policy concerns through [Issues](https://github.com/euglado/rolepetal/issues), without tokens or personal data. See [CONTRIBUTING.md](CONTRIBUTING.md) for changes and [SECURITY.md](SECURITY.md) for sensitive reports. MIT licensed: [LICENSE](LICENSE). Dependencies retain their own licenses. No official affiliation with Discord is claimed.
