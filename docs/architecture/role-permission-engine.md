# Faz 20.10.4 - Role & Permission Engine

Bu dokuman MIYOP platformu icin merkezi Role & Permission Engine mimarisini aciklar. Faz 20.10.4 kapsaminda login davranisi, UI, route, JWT, session, tenant context ve Security Gateway davranisi degistirilmemistir.

## Role Engine

Dosyalar:

- `src/authorization/role.types.ts`
- `src/authorization/role.service.ts`

Standart role modeli:

```ts
{
  roleName: string,
  permissions: string[]
}
```

Varsayilan roller:

- `SUPER_ADMIN`
- `COMPANY_ADMIN`
- `COMPANY_USER`
- `PUBLIC`

Role Engine, `UserType` bilgisinden merkezi role resolution uretir. Bu katman Authentication Service icinden degil, Authorization katmani altindan yonetilir.

## Permission Engine

Dosyalar:

- `src/authorization/permission.types.ts`
- `src/authorization/permission.service.ts`

Standart permission modeli:

```ts
{
  name: string,
  description: string,
  module: string
}
```

Baslangic permission katalogu:

- `dashboard.read`
- `products.read`
- `products.write`
- `stock.read`
- `stock.write`
- `finance.read`
- `finance.write`
- `personnel.read`
- `personnel.manage`
- `restaurant.read`
- `restaurant.write`
- `company.read`
- `company.manage`
- `platform.read`
- `platform.manage`

Permission Engine izinleri normalize eder, tekrar eden izinleri temizler ve katalog disi degerleri filtreler.

## Authorization Service

Dosyalar:

- `src/authorization/authorization.types.ts`
- `src/authorization/authorization.service.ts`

Saglanan fonksiyonlar:

- `resolveAuthorization(identity, tenantContext)`
- `applyAuthorizationToIdentity(identity, authorization)`
- `getPermissions(authorization)`
- `hasPermission(authorization, permission)`
- `hasRole(authorization, roleName)`

`AuthorizationContext` merkezi yetkilendirme sonucudur:

```ts
{
  userId,
  userType,
  role,
  tenantId,
  companyId,
  permissions,
  roleResolution,
  permissionResolution
}
```

## Permission Resolution

Authentication sonrasinda permission resolution merkezi Authorization Service tarafindan yapilir.

Akis:

```text
Authentication
  -> Session
  -> JWT
  -> Tenant Context
  -> Role Engine
  -> Permission Engine
  -> Identity Resolution
  -> Login Router
  -> Security Gateway
  -> Application
```

Teknik not: mevcut frontend foundation icinde `IdentityResolver` once kullanici tipini belirleyen base identity'yi uretir. Sonrasinda Role/Permission Engine bu base identity ve tenant context uzerinden izinleri cozer ve pipeline'in disari verdigi `IdentityResult.permissions` alanini merkezi authorization sonucu ile zenginlestirir.

## Authentication Pipeline

`AuthenticationPipelineResult` artik `authorization` alanini tasir.

Pipeline ciktisi:

- `identity`
- `session`
- `tenantContext`
- `authorization`
- `loginRedirect`
- `securityDecision`

Bu fazda authorization bilgisi decision olarak uretilir fakat UI, route guard veya backend enforcement icin kullanilmaz.

## Geriye Donuk Uyumluluk

Korunan davranislar:

- Login formu ve hata mesaji degismedi.
- RestaurantOS/EVREN360 ekrana giris davranisi degismedi.
- JWT imzalama veya session enforcement eklenmedi.
- Tenant isolation eklenmedi.
- Security Gateway bloklama davranisi degismedi.

## 20.10.5 Hazirlik

Faz 20.10.5 Login Integration & Refactor icin hazirlik:

- Role ve permission modelleri merkezi hale geldi.
- Authorization Service tek giris noktasi olarak hazirlandi.
- Pipeline permission resolution sonucunu tasiyor.
- Gelecekte App, route guard, module access ve backend authorization ayni modeli kullanabilecek.
