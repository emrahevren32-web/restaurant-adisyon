# Faz 20.9.1 - Authentication Flow Analysis

Bu rapor mevcut RestaurantOS/EVREN360 uygulamasindaki authentication, authorization, session ve tenant akisini belgelemek icin hazirlanmistir. Faz 20.9.1 kapsaminda calisan login davranisi degistirilmemis, yeni routing veya JWT davranisi eklenmemistir.

## Analiz Edilen Ana Dosyalar

- `src/pages/Login.tsx`
- `src/App.tsx`
- `src/storage.ts`
- `src/tenant.ts`
- `src/components/AppShell.tsx`
- `src/types.ts`

## Mevcut Mimari Ozeti

Uygulamada authentication tamamen frontend tarafinda, localStorage destekli demo/veri kati uzerinden calisir. Backend API, server middleware veya JWT uretimi bulunmaz. Login formu kullanici adi ve sifreyi `storage.authenticateUser` fonksiyonuna gonderir; dogrulanan kullanici `ra_auth` localStorage anahtarina kullanici nesnesi olarak yazilir ve `App` state'ine aktarilir.

Uygulama route guard mantigini merkezi bir router veya middleware ile degil, `App.tsx` icindeki conditional rendering ve `AppShell` menusu uzerindeki rol/platform kontrolleri ile uygular. Tenant izolasyonu ise `src/tenant.ts` helper fonksiyonlari ve `src/storage.ts` icindeki `filterTenantScope` / `assertTenantScope` sarmalayicilari ile veri seviyesinde saglanir.

## Login Istegi Nereden Basliyor?

Login akisi `src/pages/Login.tsx` dosyasindaki form submit handler ile baslar. Kullanici `username` ve `password` alanlarini doldurup "Giris Yap" butonuna bastiginda:

1. `submit` fonksiyonu form submit olayini yakalar.
2. `authenticateUser(username, password)` cagrilir.
3. Kullanici bulunursa `onLogin(u)` callback'i `App.tsx` tarafina iletilir.
4. Kullanici bulunamazsa ekranda hata mesaji gosterilir.

## Authentication Hangi Katmanda Gerceklesiyor?

Authentication `src/storage.ts` veri yardimci katmaninda gerceklesir. `authenticateUser` fonksiyonu:

- `loadUsers({ allTenants: true })` ile tum kullanicilari okur.
- `username`, `password` ve `active` alanlarini dogrular.
- Basariliysa `setCurrentUser(u)` ile kullaniciyi localStorage'a yazar.

Bu nedenle mevcut sistemde authentication bir API endpoint'i veya backend servisi tarafindan degil, frontend storage helper'i tarafindan yapilir.

## JWT Nasil Olusturuluyor?

JWT olusturulmuyor. Projede `jwt`, `accessToken`, `refreshToken`, `Bearer`, `Authorization` header veya benzeri token uretim/parse mantigi bulunmuyor.

## JWT Payload Icerisinde Hangi Bilgiler Bulunuyor?

JWT bulunmadigi icin JWT payload da bulunmuyor.

Mevcut session verisi localStorage'da saklanan `User` nesnesidir. `User` modeli su alanlari tasir:

- `id`
- `tenantId?`
- `companyId?`
- `fullName`
- `username`
- `password`
- `role`
- `active`

## Token Nerede Saklaniyor?

Token saklanmiyor. Bunun yerine aktif kullanici nesnesi `localStorage` icinde `ra_auth` anahtariyla saklaniyor.

Ilgili fonksiyonlar:

- `setCurrentUser(user)`
- `getCurrentUser()`
- `authenticateUser(username, password)`

Logout isleminde `setCurrentUser(null)` cagrisi ile `ra_auth` anahtari siliniyor.

## Kullanici Bilgisi Frontend'e Nasil Aktariliyor?

Kullanici bilgisi zaten frontend tarafinda uretilir ve saklanir.

Ilk sayfa yuklenmesinde `App.tsx` icinde `getCurrentUser()` cagrilir ve sonuc `initialUser` olarak React state'e tasinir. Login sonrasi `Login` component'i `onLogin(u)` callback'i ile dogrulanan kullaniciyi `App` component'ine aktarir. `App` bu kullaniciyi:

- `currentUser` state'inde saklar.
- `AppShell` component'ine prop olarak verir.
- Yetki, menu ve sayfa render kontrollerinde kullanir.

## Route Guard Mevcut mu?

Merkezi bir `ProtectedRoute`, router middleware veya route guard component'i bulunmuyor.

Mevcut koruma sekli:

- `/qr/:tableId` public QR menu olarak login olmadan acilir.
- `/basvuru` ve `/apply` public basvuru formu olarak login olmadan acilir.
- Bu public route'lar disinda `currentUser` yoksa `Login` ekrani render edilir.
- Kullanici varsa `AppShell` ve secili sayfa render edilir.
- Admin-only sayfalar `currentUser.role === 'Admin'` kosulu ile render edilir.
- Platform admin ekranlari `isPlatformAdmin` kontrolu ile korunur.

Bu yapi calisir durumdadir ancak gelecekte merkezi Identity Router veya Access Gateway icin tek bir guard soyutlamasina tasinmasi gerekecektir.

## Middleware Yapisi Nasil Calisiyor?

Server veya client middleware yapisi bulunmuyor. Routing ve access kararlarini su katmanlar verir:

- `App.tsx`: sayfa render kosullari, public route istisnalari, platform admin kontrolu.
- `AppShell.tsx`: menu gorunurlugu ve menu item filtreleme.
- `storage.ts`: veri okuma/yazma, lisans kontrolu, branch permission kontrolu, tenant assert/filter.
- `tenant.ts`: tenant cozumleme ve izolasyon helper'lari.

## Authorization Nasil Saglaniyor?

Authorization dort farkli mekanizma ile parcalanmis durumdadir:

1. Role kontrolu
   - `User.role` modeli `Admin` veya `Garson` degerlerini alir.
   - Admin ekranlari `currentUser.role === 'Admin'` ile sinirlanir.

2. Platform admin kontrolu
   - `isPlatformAdminUser(user)` kullanici `Admin` rolundeyse ve herhangi bir `companyId` cozumlenmiyorsa true doner.
   - EVREN360 menuleri `platformAdminOnly` ile isaretlidir.
   - Restaurant kullanicilarina EVREN360 ekranlari menu seviyesinde gizlenir, render seviyesinde de `PlatformAccessDenied` gosterilir.

3. Lisans/modul kontrolu
   - `canUserAccessLicensedModule(user, moduleKey)` ile modullere paket/lisans bazli erisim kontrol edilir.
   - Basarisiz kontroller `addLicenseAccessFailureLog` ile ActionHistory'ye yazilabilir.

4. Sube permission kontrolu
   - `BranchPermission` modeli `canView`, `canCreate`, `canEdit`, `canDelete` alanlarini kullanir.
   - Admin kullanicilar sube seviyesinde varsayilan olarak yetkili kabul edilir.
   - Admin olmayan kullanicilar icin aktif sube ve CRUD yetkisi kontrol edilir.

## Tenant Mantigi Mevcut mu?

Evet. Tenant mantigi `src/tenant.ts` dosyasinda merkezi helper olarak bulunur.

Mevcut ana fonksiyonlar:

- `getCurrentTenant`
- `isTenantOwner`
- `filterByTenant`
- `withTenantId`
- `resolveTenantIdForRecord`
- `assertTenantAccess`
- `recordBelongsToTenant`

`src/storage.ts` tarafinda bu helper'lar su amaclarla kullanilir:

- Kayitlara `tenantId` eklemek.
- Listelemeleri aktif kullanici tenant'ina gore filtrelemek.
- Yazma islemlerinde farkli tenant'a ait kayit gelirse hata firlatmak.

Platform admin kullanicisi icin belirli kosullarda tenant filtresi genis tutulabilir.

## Role Mantigi Mevcut mu?

Evet, fakat dar kapsamli ve iki seviyelidir.

Auth akisi icin `Role` tipi:

- `Admin`
- `Garson`

SaaS firma kullanicilari icin ayrica `CompanyUserRole` modeli vardir:

- `Firma Sahibi`
- `Admin`
- `Mudur`
- `Kasiyer`
- `Garson`
- `Mutfak`
- `Kurye`
- `Muhasebe`

Ancak `CompanyUserRole` mevcut login kararinda merkezi identity modeli olarak kullanilmiyor; daha cok SaaS/firma yonetimi veri modeli olarak duruyor.

## Permission Mantigi Mevcut mu?

Evet, fakat merkezi ve genel bir permission modeli yoktur.

Mevcut permission kaynaklari:

- `BranchPermission`: sube bazli goruntuleme/olusturma/duzenleme/silme yetkileri.
- Lisans modul yetkileri: pakete ve lisansa bagli modul erisimi.
- Menu bayraklari: `adminOnly`, `platformAdminOnly`, `locked`, `hidden`.

Gelecekteki Identity Resolver ve Access Gateway icin bu parcalar tek bir standart `permissions: string[]` sonuc modelinde birlestirilebilir.

## Login Sonrasinda Kullanici Hangi Akisla Sisteme Giriyor?

Login basarili oldugunda:

1. `authenticateUser` kullaniciyi dogrular ve `ra_auth` icine yazar.
2. `Login` component'i `onLogin(u)` callback'ini cagirir.
3. `App.tsx` icindeki `onLogin` calisir.
4. `getDefaultNavigation(u)` ile kullanici tipi/rolune gore ilk ekran belirlenir:
   - Platform admin: `evren360-dashboard`
   - Admin ve boss-dashboard lisansi olan restaurant kullanicisi: `business-summary`
   - Diger kullanicilar: `tables`
5. `migrateBranchScopedData(u)` cagrilir.
6. Gorunur subeler ve aktif sube state'i guncellenir.
7. AppShell acilir ve ilgili menu/sayfa render edilir.

## Guclu Yonler

- Login davranisi basit, okunabilir ve kolay izlenebilir.
- Public QR menu ve public basvuru formu login akisini bozmadan ayrilmis.
- EVREN360 paneli ile RestaurantOS menuleri rol ve platform admin kosullariyla ayrilmaya baslamis.
- Tenant helper merkezi bir dosyada toplanmis.
- Storage katmani bircok CRUD akisi icin tenant filtreleme ve tenant assert uyguluyor.
- Lisans/modul erisim kontrolleri ActionHistory ile izlenebilir hale getirilmis.
- Branch permission modeli CRUD seviyesinde ayrim yapabilecek sekilde hazir.

## Eksik Gorulen Mimari Noktalar

- JWT veya server-side session bulunmuyor.
- Password dogrulama plain text localStorage verisiyle yapiliyor.
- Merkezi Identity Resolver henuz aktif degil.
- Merkezi Login Router henuz yok.
- Merkezi Access Gateway / route guard abstraction bulunmuyor.
- Authorization kararlarini role, lisans, menu flag, tenant ve branch permission katmanlari ayri ayri veriyor.
- `Role` modeli platform/firma/public kullanici ayrimini tasimiyor.
- Session state icin expiry, refresh, invalidation veya device/session metadata bulunmuyor.
- API katmani olmadigi icin middleware, request-level tenant enforcement ve backend audit trail yok.

## Faz 20.9.1 Foundation Karari

Bu fazda mevcut login sistemi korunarak pasif bir Identity Foundation eklenmelidir. Yeni yapi henuz `App.tsx`, `Login.tsx` veya `storage.ts` akisine baglanmamalidir.

Hazirlanan foundation su sonraki fazlara zemin olusturur:

- Faz 20.9.2 Identity Resolution
- Faz 20.9.3 Login Routing
- Faz 20.9.4 Access Gateway
- Faz 20.9.5 Integration & Refactor
- Faz 20.10 Full Login Architecture

## Faz 20.9.2 Icin Degerlendirme

Sistem Faz 20.9.2 icin hazir hale getirilebilir durumdadir. Bir sonraki fazda onerilen ilk adim, mevcut `ra_auth` kullanici nesnesini okumaya devam eden fakat sonucu yeni `IdentityResult` modeline map eden pasif resolver'in kontrollu sekilde entegre edilmesidir. Bu entegrasyon yapilirken mevcut login, public route ve tenant izolasyon davranislari aynen korunmalidir.
