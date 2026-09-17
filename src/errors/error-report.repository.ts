// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 4 — Hata defterinin Postgres uygulaması (0030)
//
// ⚠️ Bu defter YALNIZCA YAZAR. Okuma metodu yok — çünkü tabloya okuma
// yetkisi de yok (0030). Yığın izini müşteri oturumu hiçbir yoldan
// göremesin diye. Biz SQL Editor'den okuyoruz.
//
// ⚠️ KİRACI VE KULLANICI GÖNDERİLMEZ. `tenant_id` ve `reported_by`
// kolonlarını veritabanı kendi varsayılanından dolduruyor
// (`app.current_tenant_id()`, `app.hata_aktoru()`), üstelik bu iki kolon
// insert yetkisinin dışında. Yani gönderemeyiz bile. Sebep: bir kiracının
// hatayı başka bir kiracının üstüne yazması mümkün olmasın.
// ═══════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'
import type { HataDefteri, HataKaydi } from './error-report'

export class PostgresHataDefteri implements HataDefteri {
  constructor(private readonly client: SupabaseClient) {}

  async yaz(kayit: HataKaydi): Promise<void> {
    const { error } = await this.client.from('client_error').insert({
      fingerprint: kayit.parmakIzi,
      kind: kayit.tur,
      message: kayit.mesaj,
      stack: kayit.yigin ?? null,
      route: kayit.yol ?? null,
      user_agent: kayit.tarayici ?? null,
      extra: kayit.ek ?? null,
    })
    // Fırlatıyoruz: HataBildirici bunu yakalayıp sessizce yutuyor (Kural 1).
    // Burada yutmak yanlış olurdu — defterin işi yazmak, karar vermek değil;
    // ayrıca testler "yazamama" durumunu hiç göremezdi.
    if(error) throw new Error(`Hata kaydı yazılamadı: ${error.message}`)
  }
}
