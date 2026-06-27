# Faz 20.10.5 - Full Login Architecture v1.0

Bu dokuman MIYOP Full Login Architecture v1.0 mimarisini temsil eder. Faz 20.10.5 yeni ozellik veya yeni guvenlik mekanizmasi eklemez; Faz 20.10 boyunca hazirlanan Authentication, Session, JWT Foundation, Tenant Context, Role Engine, Permission Engine, Authorization Service, Identity Resolution, Login Router ve Security Gateway katmanlarini tek bir stabil mimaride toplar.

Mevcut kullanici deneyimi, login davranisi, UI, route davranisi, JWT imzalama davranisi ve session enforcement davranisi korunmustur.

## Login Architecture

Nihai mimari:

```text
Login
  -> Authentication Service
  -> Authentication Pipeline
    -> Authentication
    -> Session Foundation
    -> JWT Foundation
    -> Tenant Context
    -> Role Engine
    -> Permission Engine
    -> Identity Resolution
    -> Login Router
    -> Security Gateway
  -> Application
```

Ana giris noktasi:

- `src/auth/authentication.service.ts`

Pipeline giris noktasi:

- `src/auth/authentication-pipeline.ts`

## Authentication Pipeline

Pipeline sonucu:

- `identity`
- `sessionModel`
- `session`
- `jwt`
- `tenantContext`
- `authorization`
- `loginRedirect`
- `securityDecision`

Pipeline responsibility:

- Legacy auth payload'ini standart identity modeline tasir.
- Session/JWT foundation verilerini hazirlar.
- Tenant context'i cozer.
- Role/permission resolution yapar.
- Login target kararini uretir.
- Security Gateway decision uretir.
- Uygulama davranisini bu fazda bloklamaz veya redirect etmez.

## Authentication Service

Dosya:

- `src/auth/authentication.service.ts`

Sorumluluklar:

- `authenticateCredentials`
- `getInitialAuthenticationState`
- `createAuthenticationState`
- `evaluateAuthenticationStateTarget`
- `logoutAuthentication`

Service, App ve Login component'leri icin tek authentication siniridir. App storage auth fonksiyonlarini dogrudan cagirmaz.

## Session Foundation

Dosyalar:

- `src/session/session.types.ts`
- `src/session/session.service.ts`

Session modeli:

```ts
{
  sessionId: string,
  userId: string,
  authenticated: boolean,
  createdAt: Date,
  expiresAt: Date,
  lastActivity: Date,
  userType: UserType
}
```

Bu fazda timeout enforcement aktif degildir.

## JWT Foundation

Dosyalar:

- `src/auth/jwt.types.ts`
- `src/auth/jwt.service.ts`

JWT payload modeli:

```ts
{
  sub: string,
  tenantId: string | null,
  companyId: string | null,
  userType: UserType,
  role: string | null,
  permissions: string[],
  iat: number,
  exp: number
}
```

Bu fazda imzali token uretilmez. Pipeline authenticated kullanicilar icin `signed: false` olan `JwtDescriptor` hazirlar.

## Tenant Context

Dosyalar:

- `src/tenant/tenant.types.ts`
- `src/tenant/tenant.context.ts`
- `src/tenant/tenant.service.ts`

Tenant context modeli:

```ts
{
  tenantId: string | null,
  companyId: string | null,
  companyName: string | null,
  tenantName: string | null,
  initialized: boolean
}
```

Bu katman aktif tenant/firma bilgisini merkezi olarak tasir. Veri filtreleme veya tenant isolation bu fazda eklenmemistir.

## Role Engine

Dosyalar:

- `src/authorization/role.types.ts`
- `src/authorization/role.service.ts`

Varsayilan roller:

- `SUPER_ADMIN`
- `COMPANY_ADMIN`
- `COMPANY_USER`
- `PUBLIC`

Role Engine, `UserType` bilgisinden merkezi role resolution uretir.

## Permission Engine

Dosyalar:

- `src/authorization/permission.types.ts`
- `src/authorization/permission.service.ts`

Permission modeli:

```ts
{
  name: string,
  description: string,
  module: string
}
```

Permission Engine permission katalogunu ve normalize edilmis permission listesini yonetir.

## Authorization Service

Dosyalar:

- `src/authorization/authorization.types.ts`
- `src/authorization/authorization.service.ts`

Saglanan fonksiyonlar:

- `resolveAuthorization`
- `applyAuthorizationToIdentity`
- `getPermissions`
- `hasPermission`
- `hasRole`

Pipeline, Authorization Service sonucunu `authorization` olarak tasir ve `IdentityResult.permissions` alanini merkezi permission sonucu ile zenginlestirir.

## Identity Resolution

Dosyalar:

- `src/identity/identity.types.ts`
- `src/identity/identity-resolver.ts`

Identity Resolver legacy kullaniciyi base identity modeline cevirir. UserType eslemesi:

- company bilgisi olmayan `Admin`: `SUPER_ADMIN`
- company bilgisi olan `Admin`: `COMPANY_ADMIN`
- diger aktif kullanicilar: `COMPANY_USER`
- unauthenticated/public durum: `PUBLIC`

## Login Router

Dosyalar:

- `src/routing/login-router.ts`
- `src/routing/routing.types.ts`

Target kararlari:

- `SUPER_ADMIN` -> `/evren360`
- `COMPANY_ADMIN` -> `restaurantos-admin`
- `COMPANY_USER` -> `restaurantos-user`
- `PUBLIC` -> `/apply`

Bu kararlar browser redirect yapmaz; mevcut internal navigation davranisi korunur.

## Security Gateway

Dosyalar:

- `src/security/security-gateway.ts`
- `src/security/security.types.ts`

Security Gateway authentication, identity, login redirect ve target uyumunu degerlendirir. Bu fazda sadece `SecurityDecision` uretir; route guard veya UI bloklama aktif degildir.

## Login Lifecycle

Standart lifecycle:

```text
Login
  -> Authentication
  -> Session Created
  -> JWT Prepared
  -> Tenant Loaded
  -> Role Resolution
  -> Permission Resolution
  -> Identity Resolution
  -> Login Router
  -> Security Gateway
  -> Application
  -> Logout
  -> Session Cleared
```

## Dogrulama Matrisi

SUPER_ADMIN:

- Authentication: basarili
- Session: olusur
- JWT: unsigned descriptor olusur
- Tenant: uninitialized
- Role: `SUPER_ADMIN`
- Permission: `platform.manage`
- Identity: `SUPER_ADMIN`
- Login Router: `/evren360`
- Security Gateway: allowed

COMPANY_ADMIN:

- Authentication: basarili
- Session: olusur
- JWT: unsigned descriptor olusur
- Tenant: initialized
- Role: `COMPANY_ADMIN`
- Permission: `products.write`, `personnel.manage`
- Identity: `COMPANY_ADMIN`
- Login Router: `restaurantos-admin`
- Security Gateway: allowed

COMPANY_USER:

- Authentication: basarili
- Session: olusur
- JWT: unsigned descriptor olusur
- Tenant: initialized
- Role: `COMPANY_USER`
- Permission: `restaurant.read`
- Identity: `COMPANY_USER`
- Login Router: `restaurantos-user`
- Security Gateway: allowed

PUBLIC:

- Authentication: basarisiz veya yok
- Session: yok
- JWT: yok
- Tenant: uninitialized
- Role: `PUBLIC`
- Permission: bos liste
- Identity: `PUBLIC`
- Login Router: `/apply`
- Security Gateway: `AUTHENTICATION_REQUIRED`

## Production Degerlendirmesi

Full Login Architecture v1.0 frontend mimari temeli production seviyesine hazirdir:

- Katmanlar merkezi ve ayridir.
- Login davranisi geriye donuk uyumludur.
- Session, JWT, Tenant, Role, Permission ve Security sinirlari tanimlidir.
- Uctan uca pipeline test edilebilir durumdadir.

Backend tarafli production icin sonraki adimlar:

- Imzali JWT uretimi ve dogrulamasi
- Server-side session veya refresh token yonetimi
- Backend authorization enforcement
- Route guard entegrasyonu
- Tenant isolation enforcement

Faz 21 icin mimari engel bulunmamaktadir.
