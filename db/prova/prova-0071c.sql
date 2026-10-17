\set ON_ERROR_STOP off
begin;
drop function app.isletme_gostergeleri(uuid, date, date);
alter function app.isletme_gostergeleri_ham(uuid, date, date) rename to kayip_ham;
\i /home/claude/is/prova/0071_analiz_yetkisi_sunucuda.sql
rollback;
