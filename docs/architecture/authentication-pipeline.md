# Faz 20.9.5 - Authentication Pipeline

Bu dokuman Faz 20.9.1-20.9.5 arasinda hazirlanan Authentication, Identity, Login Router, Session Foundation ve Security Gateway katmanlarinin guncel mimarisini aciklar.

Bu fazda yeni kullanici deneyimi, JWT, permission engine veya route guard eklenmemistir. Mevcut RestaurantOS login davranisi korunmustur.

## Pipeline Sirasi

Guncel Authentication Pipeline su sirayla calisir:

1. Authentication
2. Identity Resolver
3. Login Router
4. Security Gateway
5. Application

Merkezi giris noktasi:

- `src/auth/authentication-pipeline.ts`

Tip modeli:

- `src/auth/authentication-pipeline.types.ts`

## Authentication

Mevcut authentication davranisi degismemistir.

Canli login formu hala `src/pages/Login.tsx` icinden `storage.authenticateUser(username, password)` fonksiyonunu cagirir. Basarili kullanici `ra_auth` localStorage anahtarinda saklanir. Pipeline bu legacy kullanici nesnesini input olarak alir.

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

Dosya:

- `src/session/session.types.ts`

Pipeline, `IdentityResult` sonucundan in-memory `SessionSnapshot` uretir.

Mevcut durumda session source `local-storage` olarak kalir. JWT, refresh token, session expiry veya server session henuz aktif degildir.

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

- Legacy login sonucunu uretir.
- `ra_auth` davranisini korur.

Identity:

- Kullanici kimligini standart modele cevirir.
- UserType, companyId, tenantId, role ve permissions alanlarini uretir.

Session:

- Identity sonucundan session snapshot uretir.
- Henuz token veya expiry yonetmez.

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

- JWT henuz yoktur.
- Backend session yoktur.
- Permission engine henuz yoktur.
- Route guard henuz aktif degildir.
- Security Gateway karar uretir fakat uygulama davranisini bloklamaz.

Sonuc olarak Faz 20.9.5 sonunda authentication mimarisi stabilize edilmis ve Faz 20.10 icin merkezi, genisletilebilir bir temel olusturulmustur.
