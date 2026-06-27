# Faz 20.10.3 - Tenant Context

Bu dokuman MIYOP platformunda merkezi Tenant Context mimarisini aciklar. Faz 20.10.3 kapsaminda veri filtreleme, tenant isolation, route guard veya kullanici deneyimi degistirilmemistir.

## Tenant Context

Tenant Context, authentication sonrasinda aktif tenant ve firma bilgisini standart bir modelde tasir.

Dosyalar:

- `src/tenant/tenant.types.ts`
- `src/tenant/tenant.context.ts`
- `src/tenant/tenant.service.ts`

Standart model:

```ts
{
  tenantId: string | null,
  companyId: string | null,
  companyName: string | null,
  tenantName: string | null,
  initialized: boolean
}
```

Bu model ileride backend tenant modeliyle uyumlu olacak sekilde sade tutulmustur.

## Tenant Service

`tenant.service.ts` tenant context olusturma ve temizleme sorumlulugunu tasir.

Yonetilen bilgiler:

- `tenantId`
- `companyId`
- `companyName`
- `tenantName`

Servis `IdentityResult` uzerinden tenant bilgisini okur. Varsa mevcut tenant helper'larindan tenant/firma adini zenginlestirir. Public veya unauthenticated durumda bos tenant context doner.

Bu servis veri sorgularini filtrelemez ve tenant isolation uygulamaz.

## Tenant Lifecycle

Standart lifecycle:

1. Login
2. Tenant Loaded
3. Application
4. Tenant Changed
5. Logout
6. Tenant Cleared

Bu fazda `Tenant Changed` sadece gelecek fazlar icin lifecycle adimi olarak hazirdir. Tenant degistirme ozelligi eklenmemistir.

## Authentication Integration

Authentication Service, Authentication Pipeline sonucundaki `tenantContext` alanini merkezi `AuthenticationState` icinde tasir.

Authentication State:

- `currentUser`
- `context`
- `session`
- `jwt`
- `tenantContext`
- `pipeline`

Basarili login sonrasinda:

```text
Login
  -> Authentication
  -> Session
  -> JWT
  -> Tenant Context
  -> Identity Resolution
  -> Login Router
  -> Security Gateway
  -> Application
```

Mevcut login davranisi aynen korunur.

## Authentication Pipeline

Pipeline sonucuna `tenantContext` eklenmistir.

Guncel pipeline katmanlari:

1. Authentication
2. Session
3. JWT
4. Tenant Context
5. Identity Resolver
6. Login Router
7. Security Gateway
8. Application

Kod karsiligi:

- `src/auth/authentication-pipeline.ts`
- `src/auth/authentication-pipeline.types.ts`
- `src/tenant/tenant.service.ts`

## Sinirlar

Bu fazda yapilmayanlar:

- Tenant isolation eklenmedi.
- Veritabanı veya localStorage sorgularina yeni tenant filtresi eklenmedi.
- Kullanici arayuzu degismedi.
- Aktif tenant degistirme ozelligi eklenmedi.
- JWT veya session davranisi degistirilmedi.

## 20.10.4 Hazirlik

Role & Permission Engine icin Tenant Context artik merkezi bir kaynak olarak hazirdir.

20.10.4 ve sonrasi fazlarda permission kararlarinda su bilgiler kullanilabilir:

- `tenantContext.tenantId`
- `tenantContext.companyId`
- `identity.userType`
- `identity.role`
- `identity.permissions`

Bu temel, moduller arasi ortak tenant kaynagini hazirlar fakat henuz veri izolasyonu davranisini degistirmez.
