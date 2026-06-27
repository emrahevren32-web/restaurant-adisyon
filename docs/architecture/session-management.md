# Faz 20.10.2 - JWT & Session Management

Bu dokuman MIYOP Authentication altyapisinda JWT Foundation ve Session Foundation mimarisini aciklar. Faz 20.10.2 kapsaminda mevcut login davranisi, UI, route yapisi, Security Gateway ve Authentication Pipeline davranisi degistirilmemistir.

## JWT Foundation

JWT foundation dosyalari:

- `src/auth/jwt.types.ts`
- `src/auth/jwt.service.ts`

Hazirlanan temel model:

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

`jwt.service.ts` su sinirlari hazirlar:

- `createJwtPayload`
- `createUnsignedJwtDescriptor`
- `validateJwtPayloadShape`

Bu fazda imzali token uretilmez. `JwtDescriptor.signed` alani bu nedenle `false` olarak hazirlanir. Gercek backend imzalama ve dogrulama 20.10 sonrasi session/JWT entegrasyon fazlarina birakilmistir.

## Session Foundation

Session foundation dosyalari:

- `src/session/session.types.ts`
- `src/session/session.service.ts`

Standart session modeli:

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

Session service su operasyonlari hazirlar:

- `createSessionModel`
- `createSessionSnapshot`
- `createSessionFoundation`
- `touchSession`
- `isSessionExpired`
- `expireSession`

Bu fazda timeout enforcement aktif degildir. `expiresAt` alani gelecekteki session yonetimi icin uretilir fakat kullanici deneyimini veya route davranisini etkilemez.

## Session Lifecycle

Standart session lifecycle:

1. Login
2. Session Created
3. Authentication
4. Identity
5. Login Router
6. Security Gateway
7. Application
8. Session Expired
9. Logout

Kod karsiligi:

- Login: `Login.tsx`
- Session Created: `session.service.ts`
- Authentication: `authentication.service.ts`
- Identity: `identity-resolver.ts`
- Login Router: `login-router.ts`
- Security Gateway: `security-gateway.ts`
- Application: `App.tsx`
- Logout: `authentication.service.ts`

## Authentication Integration

`authentication.service.ts` artik Session Foundation ile entegredir.

Authentication state su parcayi tasir:

- `currentUser`
- `context`
- `session`
- `jwt`
- `pipeline`

`session` alani authenticated kullanici icin `SessionModel`, public veya basarisiz login icin `null` olur.

`jwt` alani authenticated kullanici icin imzasiz `JwtDescriptor`, public veya basarisiz login icin `null` olur. Bu descriptor token yerine gecmez; sadece payload ve token tipi standardini hazirlar.

## Geriye Donuk Uyumluluk

Korunan davranislar:

- Login formu ve hata mesaji degismedi.
- Legacy `ra_auth` davranisi korunur.
- JWT browser storage'a yazilmaz.
- Session timeout uygulanmaz.
- Route guard eklenmez.
- Security Gateway karar uretmeye devam eder, davranisi bloklamaz.

## 20.10.3 Hazirlik

Faz 20.10.3 Tenant Context icin hazirlik:

- JWT payload icinde `tenantId` ve `companyId` alanlari standartlasti.
- Session modeli `userType` ve `userId` tasiyor.
- Authentication State merkezi hale geldi.
- Identity, Session, JWT ve Security Gateway sinirlari ayrildi.

Bu zemin uzerinde tenant context, role/permission engine ve sonraki login entegrasyon refactor'lari mevcut kullanici deneyimi bozulmadan ilerletilebilir.
