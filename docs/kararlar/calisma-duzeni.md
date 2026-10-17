# Codex ve Claude · çalışma düzeni

**Kural: aynı anda değil, SIRAYLA.**
Emrah (17.10.2026): *"Senin token bitince ona, onun token bitince sana."*

| | Codex | Claude |
|---|---|---|
| Güçlü yanı | Bütün depoyu (883 dosya) bir oturumda okuyabiliyor | Gerçek PostgreSQL 16'da prova koşturuyor, test takımını çalıştırıyor |
| Zayıf yanı | Hiçbir şeyi ÇALIŞTIRMIYOR | Dosya köprüsüyle depoyu toptan okumak pahalı |
| Rolü | **Denetçi** | **Uygulayıcı + doğrulayıcı** |

**Sıra:** Codex denetler → Claude düzeltir ve provayla kanıtlar →
Codex aynı bulguyu yeniden denetler → sonraki tur.

## Neden aynı anda değil

1. **İki yazar aynı dosyada birbirini ezer.**
2. **Codex çalıştırmıyor.** Grant/RLS/tetikleyici düzeltmesi
   çalıştırılmadan doğrulanamaz.
3. **Kaynak çakışması.** 17.10.2026: Codex depoyu tararken `npm test`
   çalıştırıldı; test süresi 34 saniyeden 783 saniyeye çıktı ve 23 dosya
   `vitest-worker timeout` ile düştü. Hiçbir test başarısız olmadı —
   çalışamadılar (tuzak 87).

## Codex yazsın istenirse

Üç şart: (1) önce yedek · (2) ayrı git dalı · (3) tek seferde tek bulgu.

## Brif

`docs/codex-brifi.md` — her denetim turunda güncellenir.
