# Faz 20.9.5 - Authentication Pipeline

Bu dokuman Faz 20.9.1-20.10.3 arasinda hazirlanan Authentication, Session, JWT Foundation, Tenant Context, Identity, Login Router ve Security Gateway katmanlarinin guncel mimarisini aciklar.

Bu fazda yeni kullanici deneyimi, JWT, permission engine veya route guard eklenmemistir. Mevcut RestaurantOS login davranisi korunmustur.

## Pipeline Sirasi

Guncel Authentication Pipeline su sirayla calisir:

1. Authentication
2. Session
3. JWT Foundation
4. Tenant Context
5. Identity Resolver
6. Login Router
7. Security Gateway
8. Application

Merkezi giris noktasi:

- `src/auth/authentication-pipeline.ts`

Tip modeli:

- `src/auth/authentication-pipeline.types.ts`

## Authentication

Mevcut authentication davranisi degismemistir.

Canli login formu `src/pages/Login.tsx` icinden `authentication.service.ts` servisini cagirir. Servis geriye donuk uyumluluk icin legacy `storage.authenticateUser(username, password)` davranisini kullanir. Basarili kullanici `ra_auth` localStorage anahtarinda saklanir. Pipeline bu legacy kullanici nesnesini input olarak alir.

Bu katmanda JWT yoktur.

## Identity Resolver

Dosyalar:

- `src/identity/identity-resolver.ts`
- `src/identity/identity.types.ts`

Identity Resolver legacy kullanici nesnesini standart `IdentityResult` modeline cevirir.

UserType eslemesi:

- `Admin` ve company yoksa: `SUPER_ADMIN`
- `Admin` ve company varsa: `COMPANY_ADMIN`
- Diger aktif kullanicilar: `COMPANY_USER`
- Kullanici yok veya gecersizse: `PUBLIC`

Tenant bilgisi once kullanici uzerindeki `tenantId` alanindan, yoksa `companyId` uzerinden mevcut tenant helper ile okunur.

## Session Foundation

Dosyalar:

- `src/session/session.types.ts`
- `src/session/session.service.ts`

Pipeline, `IdentityResult` sonucundan in-memory `SessionSnapshot` uretir. Authentication Service ayrica merkezi `SessionModel` olusturur.

Mevcut durumda session source `local-storage` olarak kalir. Refresh token, timeout enforcement veya server session henuz aktif degildir.

## JWT Foundation

Dosyalar:

- `src/auth/jwt.types.ts`
- `src/auth/jwt.service.ts`

JWT payload modeli hazirdir ancak imzali token uretimi aktif degildir. Authentication State authenticated kullanicilar icin `signed: false` olan bir `JwtDescriptor` tasir.

## Tenant Context

Dosyalar:

- `src/tenant/tenant.types.ts`
- `src/tenant/tenant.context.ts`
- `src/tenant/tenant.service.ts`

Pipeline sonucunda `tenantContext` uretilir. Bu context `tenantId`, `companyId`, `companyName`, `tenantName` ve `initialized` alanlarini tasir. Bu fazda tenant isolation veya veri filtreleme davranisi eklenmemistir.

## Login Router

Dosyalar:

- `src/routing/login-router.ts`
- `src/routing/routing.types.ts`

Login Router sadece `IdentityResult` okur. Storage, tenant, browser state veya kullanici modeli okumaz.

Routing karar modeli:

- `SUPER_ADMIN` -> `/evren360`
- `COMPANY_ADMIN` -> `restaurantos-admin`
- `COMPANY_USER` -> `restaurantos-user`
- `PUBLIC` -> `/apply`

Bu karar henuz browser redirect yapmaz. App mevcut internal route state davranisini korur.

## Security Gateway

Dosyalar:

- `src/security/security-gateway.ts`
- `src/security/security.types.ts`

Security Gateway `IdentityResult`, `LoginRedirectResult` ve hedef target uzerinden `SecurityDecision` uretir.

Kontroller:

- Authentication var mi?
- Identity var ve tutarli mi?
- UserType bilinen tiplerden biri mi?
- Login Router sonucu var ve tutarli mi?
- Router target ile talep edilen target uyumlu mu?

Bu fazda gateway sadece karar uretir. Redirect, route blocking, permission enforcement veya JWT validation yapmaz.

## Application Entegrasyonu

`src/App.tsx` artik auth akisini dogrudan parca parca kurmak yerine merkezi pipeline'i cagirir.

Ana kullanim:

- `resolveAuthenticationPipeline(...)`
- `evaluateAuthenticationPipelineTarget(...)`

App hala mevcut kullanici deneyimini korur:

- Super Admin icin EVREN360 dashboard acilir.
- Firma admin kullanicisi eski admin davranisini korur.
- Firma kullanicisi operasyon ekranina gider.
- Public QR menu ve public basvuru formu davranisi degismez.

## Katman Sorumluluklari

Authentication:

- Authentication service uzerinden legacy login sonucunu uretir.
- `ra_auth` davranisini korur.

Identity:

- Kullanici kimligini standart modele cevirir.
- UserType, companyId, tenantId, role ve permissions alanlarini uretir.

Session:

- Identity sonucundan session snapshot ve authentication state icin session model uretir.
- Henuz timeout enforcement veya backend session yonetmez.

JWT Foundation:

- Identity sonucundan standart payload ve imzasiz descriptor hazirlar.
- Henuz backend imzalama/dogrulama yapmaz.

Tenant Context:

- Identity sonucundan merkezi tenant/firma context'i uretir.
- Henuz veri izolasyonu uygulamaz.

Login Router:

- Sadece IdentityResult ile hedef panel kararini hesaplar.

Security Gateway:

- Login Router hedefini ve identity tutarliligini dogrular.
- Henuz enforcement yapmaz.

Application:

- Mevcut ekran ve internal route davranisini korur.
- Pipeline kararlarini gelecekteki Access Gateway icin bellekte tutar.

## 20.10 Hazirlik Durumu

Mimari su fazlar icin hazirdir:

- 20.10.1 Authentication Foundation
- 20.10.2 JWT & Session Management
- 20.10.3 Tenant Context
- 20.10.4 Role & Permission Engine
- 20.10.5 Login Integration & Refactor

Bilinen sinirlar:

- Imzali JWT henuz yoktur.
- Backend session yoktur.
- Tenant isolation bu pipeline tarafindan uygulanmaz.
- Permission engine henuz yoktur.
- Route guard henuz aktif degildir.
- Security Gateway karar uretir fakat uygulama davranisini bloklamaz.

Sonuc olarak Faz 20.9.5 sonunda authentication mimarisi stabilize edilmis ve Faz 20.10 icin merkezi, genisletilebilir bir temel olusturulmustur.
