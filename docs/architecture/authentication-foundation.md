# Faz 20.10.1 - Authentication Foundation

Bu dokuman MIYOP Authentication Foundation mimarisinin guncel durumunu aciklar. Faz 20.10.1 kapsaminda JWT, session davranisi, route guard, UI veya login deneyimi degistirilmemistir.

## Authentication Foundation

Authentication katmani artik merkezi servis uzerinden yonetilir.

Ana dosyalar:

- `src/auth/authentication.service.ts`
- `src/auth/authentication.context.ts`
- `src/auth/authentication.events.ts`
- `src/auth/authentication-pipeline.ts`
- `src/auth/authentication-pipeline.types.ts`

Mevcut legacy login davranisi korunur:

- Kullanici adi/sifre dogrulama hala legacy storage fonksiyonunun davranisini kullanir.
- Aktif kullanici payload'i `ra_auth` uzerinden korunur.
- JWT eklenmemistir.
- Session expiry veya refresh davranisi eklenmemistir.

## Authentication Service

`authentication.service.ts` authentication sorumluluklarini merkezi hale getirir.

Temel sorumluluklar:

- Mevcut aktif kullanicidan initial authentication state olusturmak.
- Credential dogrulamasini merkezi servis uzerinden calistirmak.
- Basarili login sonucunu Authentication Pipeline ile birlestirmek.
- Logout isleminde legacy auth payload'ini temizlemek.
- Security target degistiginde Authentication State'i guncellemek.

App artik storage auth fonksiyonlarini dogrudan cagirmaz. Login component'i de credential dogrulamasini authentication service uzerinden yapar.

## Authentication Context

`authentication.context.ts` merkezi Authentication Context modelini tanimlar.

Model:

```ts
{
  authenticated: boolean,
  userId: string | null,
  sessionId: string | null,
  loginTime: Date | null
}
```

Bu context in-memory olarak uretilir. `sessionId` kalici session veya JWT degildir; ilerideki session yonetimi icin standart alan hazirligidir.

## Authentication Lifecycle

Standart lifecycle:

1. Login
2. Authenticated
3. Identity Resolution
4. Login Router
5. Security Gateway
6. Application
7. Logout

Kod karsiligi:

- Login: `Login.tsx`
- Authenticated: `authentication.service.ts`
- Identity Resolution: `identity-resolver.ts`
- Login Router: `login-router.ts`
- Security Gateway: `security-gateway.ts`
- Application: `App.tsx`
- Logout: `authentication.service.ts`

## Authentication Events

`authentication.events.ts` ileride kullanilacak event modelini hazirlar.

Hazir event tipleri:

- `LOGIN_SUCCESS`
- `LOGIN_FAILED`
- `LOGOUT`
- `SESSION_EXPIRED`

Bu fazda event bus, audit dispatch veya side effect aktif degildir. Sadece standart event isimleri ve payload modeli hazirlanmistir.

## Pipeline Iliskisi

Authentication Service, Authentication Pipeline'in ust seviyesi olarak calisir.

Akis:

```text
authentication.service
  -> authentication-pipeline
    -> identity-resolver
    -> login-router
    -> security-gateway
  -> authentication.context
  -> application
```

Bu sayede App authentication ayrintilarini bilmeden sadece `AuthenticationState` ile calisir.

## Geriye Donuk Uyumluluk

Korunan davranislar:

- Login formu ayni kalir.
- Hata mesaji ayni kalir.
- RestaurantOS varsayilan ekranlari ayni kalir.
- EVREN360/Super Admin davranisi ayni kalir.
- QR menu ve public basvuru route'lari ayni kalir.
- JWT ve session davranisi degismez.

## 20.10.2 Hazirlik

Faz 20.10.2 JWT & Session Management icin hazirlik:

- Authentication Service merkezi giris noktasi oldu.
- Authentication Context standartlasti.
- Session alanlari hazir fakat aktif session davranisi degismedi.
- Authentication Events model olarak hazir.
- Pipeline Identity, Router ve Security Gateway ile uyumlu.

Bir sonraki fazda JWT ve kalici session davranisi bu service/context sinirindan eklenebilir.
