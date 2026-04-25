# Migracje DB — Prowatech Inspekcje

Pliki SQL do wykonania w Supabase SQL Editor (https://supabase.com/dashboard/project/lhxhsprqoecepojrxepf/sql).

## Konwencja nazewnictwa

`YYYY-MM-DD_short_slug.sql` — np. `2026-04-25_piib_protocol.sql`. Pliki uruchamiamy w kolejności daty + slugu.

## Przed wykonaniem migracji

Zawsze wykonaj manual backup bazy: Supabase Dashboard → Database → Backups → "Create manual backup". To jedyna pewna metoda rollbacku zmian na enumach Postgresa.

## Migracje 2026-04-25 — PIIB

Wdrożenie wzorów protokołów PIIB (Załącznik do uchwały nr PIIB/KR/0051/2024 KR PIIB z 04.12.2024). Pełen plan: [`../MIGRATION_PLAN_PIIB.md`](../MIGRATION_PLAN_PIIB.md).

Kolejność wykonania:

1. **Backup**: Supabase Dashboard → Database → Backups → "Create manual backup". Tag: `pre-piib-migration`.

2. **Schema + dane**: skopiuj treść `2026-04-25_piib_protocol.sql` do SQL Editora, uruchom (Run / Ctrl+Enter). Czas wykonania: kilka sekund. Sprawdź sekcję WERYFIKACJA na końcu pliku.

3. **Element definitions**: skopiuj treść `2026-04-25_piib_element_definitions.sql`, uruchom. Po wykonaniu sprawdź zapytania z sekcji WERYFIKACJA — oczekiwane: 15 elementów rocznych + 16 5-letnich (1 dodatkowy: estetyka).

4. **Regeneracja typów TypeScript**: lokalnie w terminalu Git Bash:
   ```bash
   cd C:/prowatech-inspekcje
   npx supabase gen types typescript --project-id lhxhsprqoecepojrxepf > src/lib/database.types.ts
   ```
   (Wymaga zalogowania `npx supabase login` — jednorazowo). Alternatywa: Supabase Dashboard → Settings → API → Generate types.

5. **Smoke test aplikacji** (lokalnie):
   ```bash
   npm run dev
   ```
   Otwórz dowolną zakończoną inspekcję — powinna się załadować bez błędów. Spróbuj wybrać "dostateczny" jako oceną elementu — zapis do DB powinien działać.

6. **Commit + push** (z Windows-side Git Bash, nie z Cowork — phantom `.git/index.lock`):
   ```bash
   git add migrations/ MIGRATION_PLAN_PIIB.md src/lib/database.types.ts
   git commit -m "feat(db): migracja PIIB - schema + seed elementow"
   git push
   ```

## Rollback

Jeśli coś poszło źle po kroku 2 lub 3 — Supabase Dashboard → Database → Backups → wybierz `pre-piib-migration` → Restore. Zmiany na enumach `condition_rating` nie są odwracalne czystym SQL-em (Postgres nie pozwala na DROP wartości enuma z dependencies).

Jeśli problem jest tylko po stronie kodu (krok 4-5) — `git revert HEAD && git push`. Migracja DB zostaje (nullable defaults), aplikacja wraca do stanu sprzed Fazy 8.

## Pliki w tym katalogu

| Plik | Zakres |
|---|---|
| `2026-04-25_piib_protocol.sql` | Mapowanie ocen 5→4, nowe kolumny w `inspections` i `inspection_elements`, 6 nowych tabel PIIB (previous_recommendations, emergency_state_items, repair_scope_items, basic_requirements_art5, inspection_attachments, electrical_measurement_protocols) z RLS policies. |
| `2026-04-25_piib_element_definitions.sql` | Re-seed `inspection_element_definitions` — 15 elementów rocznych + 1 dodatkowy 5-letni (estetyka). Każdy z polami `scope_annual`, `scope_five_year_additional`, `applicable_standards` zgodnymi z PIIB. |
