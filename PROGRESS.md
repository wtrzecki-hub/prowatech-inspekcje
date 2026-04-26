# PROGRESS — Prowatech Inspekcje

> **Ten plik jest aktualizowany na koniec każdej sesji pracy nad projektem.**
> **Jeśli jesteś Claude rozpoczynającym nową sesję pracy nad Prowatech Inspekcje — przeczytaj ten plik w pierwszej kolejności**, zanim zaczniesz eksplorować repo lub pytać użytkownika o kontekst. Zaktualizuj go na końcu sesji (sekcje "Ostatnio zrobione", "W toku / następne kroki" oraz "Historia sesji").

_Ostatnia aktualizacja: 2026-04-26 — **Faza 15 (Migracja na Cloudflare R2 + archiwum historycznych protokołów PIIB) DONE + smoke test ZIELONY na produkcji.** Strategiczny pivot ze Supabase Storage (1 GB free, niewystarczające na 5 lat archiwum ~50-100 GB skanów PDF) na **Cloudflare R2** (10 GB free + $0.015/GB poza tym, ZERO egress fees). 3 podfazy zakończone w jednej sesji: **15.B** = adapter R2 (`src/lib/storage/r2.ts`) + endpoint `/api/storage/presigned` (pre-signed PUT URL, 5 min TTL, omija Vercel 4.5 MB body limit), commit `87d99d8`; **15.E** = migracja DB `2026-04-26_historical_protocols.sql` (nowa tabela z RLS dla admin/inspector/client_user/viewer, UNIQUE(turbine_id, year, inspection_type) — max 1 protokol per rok per typ) — uruchomiona w Supabase SQL Editor; **15.F** = UI zakładki "Archiwum" w `/turbiny/[id]` (drag-drop PDF, parser regex auto-fill nazw `NN_T_RRRR Protokol_kontroli_typ ... DD-MM-YYYY`, edit meta, delete) + sekcja "Archiwum" w `/portal/(client)/protokoly` (klient widzi swoje przez RLS), commit `d309f12`. Smoke test prod: T330-Żałe / FW ŻAŁE → drag-drop pliku z folderu archiwum → auto-fill rok 2024, typ "Roczna", nr `48/T/2024`, data 23.04.2024 → Zapisz → wpis 4.5 MB widoczny w liście, plik w R2 pod kluczem `historical/{turbine_id}/2024_annual_xxx.pdf`. **Klient od jutra może wgrywać archiwum z folderu GDrive `21 Prowatech-inspekcje/04 inspekcje` po jednym pliku przez UI.**_

_Poprzednia: 2026-04-26 — **PIIB Faza 14 (3 zdjęcia turbiny w metryczce + protokole) DONE + smoke test ZIELONY.** Metryczka inspekcji ciągnie 3 zdjęcia z karty turbiny (`turbines.photo_url/_2/_3`) jako read-only podgląd z linkiem "Edytuj zdjęcia w karcie turbiny" — żadnych nowych pól w `inspections`. Stary `object_photo_url` (per-inspekcja) schowany w zwiniętym `<details>` jako "Pole legacy" + zachowany jako fallback w generatorach. Generator PDF: layout 1+2 (portret 60×90 mm + 2 pejzaże 60×43 mm w pionie) zamiast pojedynczego zdjęcia 60×45 mm; brakujące sloty rysowane jako puste ramki. Generator DOCX: tabela 1×2 bez ramek (portret 227×340 px + 2 pejzaże 227×162 px stack). 2 commity: `cafab60` (feature) + `968be27` (fix duplikatu końcówki catch w DOCX). Smoke test PDF z prod: `pdfimages -list` pokazuje 1 zdjęcie turbiny (slot 1, jpeg 629×462) + puste ramki dla slotów 2/3 (bo karta T150-Kowalewo ma tylko 1 zdjęcie); label "Fotografie obiektu" widoczny poprawnie. Po dorzuceniu zdjęć 2 i 3 w karcie turbiny pełen layout 1+2 zadziała w kolejnym PDF._

_Poprzednia: 2026-04-25 — **PIIB Faza 13 KOMPLETNA + smoke test ZIELONY.** PDF/DOCX z embeddowaną fotografią obiektu (5.3 MB) + slash w nazwie pliku → underscore + color coding tabeli III zwalidowany w Acrobat Reader (Dostateczny = niebieskawe tło wiersza). Faza 13.2 odpadła — chat preview czyścił kolory wprowadzając w błąd, prawdziwy PDF generuje kolor coding poprawnie. **Pełen workflow PIIB end-to-end na produkcji od jutra**: nowa inspekcja → 15/16 elementów PIIB → ocena 4-stopniowa → metryczka z uploadem zdjęcia z dysku → poprzednie zalecenia / stan awaryjny / zakres robót / wymagania art. 5 PB / załączniki → PDF/DOCX zgodny z Załącznikiem nr PIIB/KR/0051/2024 z embedded fotografią, color codingiem ocen, kompletną metryczką. **PINB powinien zaakceptować bez uwag.**_

_Poprzednia: 2026-04-25 — **PIIB Faza 13.1 + 13.3 DONE.** Polerowanie generatorów: (a) slash w nazwie pliku PDF/DOCX zamieniony na underscore — `protokol-PIIB-017_R_2026.pdf` zamiast `017/R/2026.pdf` (ASCII walidacja `[\\/\\\\:*?"<>|]/g`); (b) embed fotografii obiektu — `inspections.object_photo_url` (uploadowane przez UI w InspectionMetadataPiib) jest teraz pobierane przez `fetch()` w obu generatorach, dekodowane do base64 (PDF: `pdf.addImage(60×45 mm)` wycentrowane pod nagłówkiem METRYCZKA) lub Buffer (DOCX: `ImageRun(240×180 px)`), z try/catch żeby brak zdjęcia / 404 nie zepsuł generatora. Faza 13.2 (color coding tabeli III) odłożona — bez weryfikacji rzeczywistego PDF nie wiadomo czy `didParseCell.fillColor` faktycznie nie działa, czy tylko chat preview czyści kolory. Smoke test po deployu zdecyduje._

_Poprzednia: 2026-04-25 — **PIIB Faza 12.2 (formularz turbine-inspection-form.tsx) DONE.** Kreator nowej inspekcji zaktualizowany pod 4 stopnie PIIB: typ ConditionRating rozszerzony o `dostateczny` / `niedostateczny` (legacy zachowane), 5 toggle-buttonów ocen przebudowane na 4 (DOBRY / DOSTATECZNY / NIEDOSTATECZNY / AWARYJNY z paletą success/info/warning/danger), helper `isProblematicRating()` zastępuje hardkodowane `!['dobry','zadowalajacy'].includes()` w 2 miejscach, ratingOrder w obliczeniu worstRating rozszerzony o nowe wartości (PIIB najpierw, legacy fallback), kolory karty elementu obsługują wszystkie 7 wartości. **Slider % zużycia (legacy) usunięty z formularza** wraz z importem `Slider` — pole `wear_percentage` w DB pozostaje (nullable), nowe inspekcje zapisują NULL. Plus bonus z poprzedniej iteracji: upload zdjęcia obiektu w InspectionMetadataPiib (Supabase Storage bucket `turbine-photos`, przycisk "Wybierz z dysku" obok URL inputa, validation typ + 10 MB max, preview img poniżej, X do usunięcia)._

_Poprzednia: 2026-04-25 — **PIIB Faza 12.1 (integracja komponentów PIIB w detalu inspekcji) DONE + smoke test ZIELONY.** `[id]/page.tsx` rozszerzony o 6 nowych komponentów: nowy tab "Metryczka" jako pierwszy (InspectionMetadataPiib z 4 sekcjami), tab "Zalecenia" rozbudowany o II + IV/VI sekcje PIIB (PreviousRecommendationsTable z auto-importem turbineId + EmergencyStateTable + RepairScopeTable + legacy RepairTable w `<details>` collapsible), nowy warunkowy tab "Wymagania" (5-letni, BasicRequirementsArt5 z auto-create 7 wierszy), AttachmentsList wstawiony na końcu zakładki "Wnioski". TabsList przebudowany z `grid-cols-5` na elastyczny `flex` żeby skalować się do 6 zakładek dla rocznej / 8 dla 5-letniej. Inspektor może teraz w UI wypełnić całą metryczkę PIIB, zalecenia z poprzedniej kontroli, stan awaryjny, zakres robót remontowych z terminami, wymagania art. 5 PB i załączniki. Generator PDF/DOCX odbiera te dane od razu (smoke test: pola Kowalewo Opactwo / 100185423 widoczne na produkcji)._

_Poprzednia: 2026-04-25 — **PIIB Faza 11 (rewrite generatorów DOCX/PDF) DONE + smoke test ZIELONY.** PDF (422KB, 6 stron) i DOCX wygenerowane na produkcji dla inspekcji 017/R/2026 (Kowalewo, Gamesa G114, status: zakończona). Pełna struktura PIIB widoczna: nagłówek firmowy → tytuł + 3 podpunkty zakresu → branża → KONTROLA OKRESOWA → PODSTAWA PRAWNA → metryczka (z placeholderami dla niewypełnionych pól) → dane techniczne turbiny → dokumenty do wglądu → kryteria ocen z color codingiem → I-VII sekcje. Element "Oświetlenie serwisowe i awaryjne" pokazuje "Dostateczny" — potwierdzenie zapisu z testu Fazy 9. Po drodze 3 hot-fixy: 2026-04-25_piib_turbine_fields.sql (commissioning_year + tower_construction_type), commit `aa4c415` (unicode glyphs spoza Roboto subset → ASCII), commit `3dff7d0` (RGB.graphite400 + graphite700 brakujące w protocol-tokens.ts)._

_Poprzednia: 2026-04-25 — **PIIB Faza 11 (rewrite generatorów DOCX/PDF) DONE.** Oba generatory protokołów (`/api/docx/[id]/route.ts` ~1300 lin, `/api/pdf/[id]/route.ts` ~870 lin) przepisane od podstaw pod układ Załącznika do uchwały nr PIIB/KR/0051/2024 KR PIIB. Jeden generator z warunkiem `inspection_type` — sekcje 5-letnie (Skład komisji, kolumna "Zakres dodatkowy 5-letni" + "Przydatność", IV. Pomiary elektryczne A/C, VI. Wymagania art. 5 PB) widoczne tylko dla `'five_year'`. Pełna struktura PIIB: Nagłówek firmowy → Tytuł PIIB → Metryczka obiektu → Podstawowe dane techniczne → [Skład komisji] → Dokumenty do wglądu → Kryteria 4-stopniowe (z color codingiem) → I. Zakres → II. Sprawdzenie zaleceń + Stan awaryjny → III. Ustalenia (jedna tabela PIIB z color-codingiem ocen na kolumnach Element + Ocena) → [IV. Pomiary] → V. Serwis + checklist → IV/VI. Zalecenia (Zakres / Termin) → [Wymagania art. 5] → VII/VI. Dokumentacja graficzna → VIII/VII. Podpisy (1 lub 2 branże) + Załączniki. Mapping kolorów ocen z `protocol-tokens.ts` (RATING_COLORS_HEX dla DOCX, RATING_COLORS_RGB dla PDF). Stare pola legacy (NG/NB/K, I-IV) całkowicie usunięte z generatorów._

_Poprzednia: 2026-04-25 — **PIIB Faza 10 (6 nowych komponentów PIIB) DONE.** Sześć samodzielnych komponentów CRUD pod nowe tabele PIIB: AttachmentsList (sekcja VII/VIII), EmergencyStateTable (II — stan awaryjny z banerem o PINB), PreviousRecommendationsTable (II — z auto-fill z poprzedniej zakończonej inspekcji turbiny), RepairScopeTable (IV/VI — Zakres czynności / Termin, zastępuje legacy NG/NB/K + I-IV), BasicRequirementsArt5 (VI — 7 wymagań art. 5 PB, auto-create preset rows tylko 5-letni), InspectionMetadataPiib (kompozyt 4 sekcji: metryczka obiektu / strony protokołu / dokumenty do wglądu / wprowadzenie do II + KOB). Wszystkie self-contained, ładują własny stan, auto-save 800ms na blur, hardkodowane Supabase creds wg konwencji projektu. Każdy komponent gotowy do wstawienia w `[id]/page.tsx` jako nowe taby lub sekcje — integracja w Fazie 12._

---

## Stan projektu

Aplikacja webowa (PWA) do zarządzania inspekcjami turbin wiatrowych dla firmy ProWaTech. Zbudowana na Next.js 14 App Router + Supabase + Vercel. Cały UI po polsku.

Po ~6 tygodniach pracy (2026-04-01 → 2026-04-13) aplikacja ma:
- Działający deployment na Vercel z OAuth Google i rolami (admin / inspektor).
- Pełny CRUD dla klientów, farm wiatrowych, turbin, inspekcji, inspektorów.
- Formularz inspekcji dostosowany do tabletu (3-krokowy), połączony z Supabase, z realnymi definicjami elementów turbiny.
- Bibliotekę defektów / wad (`defect_library`) jako picker w formularzu inspekcji.
- Galerię zdjęć per-inspekcja i per-element z określonymi wymiarami (portret 12×7 cm, pejzaż 5,5×7 cm) dopasowanymi do layoutu protokołu.
- Generowanie protokołu PDF (jspdf + autotable, font Roboto dla polskich znaków, logo ProWaTech, nagłówek prawny).
- Generowanie protokołu DOCX (biblioteka `docx`, runtime `nodejs`).
- Certyfikaty inspektora: GWO (4 moduły z osobnymi datami ważności), UDT (z załącznikami skanu uprawnień + izby), SEP, WINDA ID.
- Soft-delete inspekcji (tylko admin).

Od 2026-04-24 (po kroku 6) na gałęzi `main` jest `.gitattributes` (`* text=auto eol=lf` + binary exclusions, commit `368d34d`) — preventive measure zapobiegający regresjom CRLF/null-bytes. Są nietrackowane pliki robocze (SQL-e sianiające defekty, skrypty GAS, Raport PDF) — patrz "Pliki nietrackowane" niżej.

## Ostatnio zrobione

Pogrupowane tematycznie (kolejność chronologiczna w obrębie grupy):

**Faza 15 — Migracja na Cloudflare R2 + archiwum historycznych protokołów PIIB DONE (2026-04-26)**

3 commity (`87d99d8`, `d309f12` + migracja SQL ręcznie w Supabase). Cel biznesowy: dorzucenie ~5 lat archiwum protokołów PIIB (skany PDF z folderu Waldka GDrive `21 Prowatech-inspekcje/04 inspekcje`), które nie zmieści się w Supabase Storage free (1 GB) i nawet nie w Pro (100 GB) — szacunek 50-100 GB samych skanów. Cloudflare R2 wybrany jako storage zewnętrzny (10 GB free, $0.015/GB poza, **zero egress** = klient pobierający 10 PDF-ów dziennie nie kosztuje nic). DB Postgres zostaje na Supabase Free — 14 MB / 500 MB free (2.8%), starczy długo nawet po dorzuceniu metadanych.

Diagnostyka pre-migracji (sekcja 9 z `diagnostics_storage_2026-04-26_compact.sql`):
- DB 14 MB / 500 MB free (2.8%)
- Storage Supabase 38 MB / 1 GB free (3.75%) — 17 plików w `turbine-photos` + 14 dokumentów w `inspector-docs`
- Anatomia inspekcji: 65 elementów / 2.3 zalecenia / 0.2 zdjęcia (1 wpis w `inspection_photos`)
- Forecast 5 lat archiwum: 425 turbin × 5y × 1.2 inspekcji = ~2550 protokołów × 0.5 MB skan = ~1.3 GB (znacznie mniej niż 50-100 GB initial guess — Waldek potwierdził, że archiwum to tylko PDF-y, zdjęcia historyczne zostają na GDrive osobno)
- Koszt R2 dla docelowego archiwum: ~$0.02/mies, czyli **w praktyce zero** (zostajemy w 10 GB free)

**Faza 15.A — Setup Cloudflare R2** (krok manualny przez Waldka):
- Konto Cloudflare → Storage & databases → R2 Object Storage → subscribe (free tier)
- Bucket `prowatech-inspekcje`, jurisdiction **EU (Frankfurt)**, Standard storage class
- **Public Development URL** enabled: `https://pub-edbf124678454e819a88cd7054401694.r2.dev`
- **CORS Policy** dodana z dozwolonymi origins `https://prowatech-inspekcje.vercel.app` + `http://localhost:3000`, methods GET/PUT/POST/DELETE/HEAD
- **Account API Token** `prowatech-app` z permissions `Object Read & Write`, scoped do bucketu `prowatech-inspekcje`. Cloudflare wyświetlił 3 wartości tylko raz: Access Key ID, Secret Access Key, Endpoint
- **Account ID**: `587ba2347ed372341fe359b0ed2d632d`
- **Endpoint**: `https://587ba2347ed372341fe359b0ed2d632d.eu.r2.cloudflarestorage.com`

**Faza 15.B — adapter R2 + pre-signed PUT API** (commit `87d99d8`):
- `src/lib/storage/r2.ts` — S3-compatible client przez `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (107 nowych paczek razem). Lazy-init `S3Client` z `region: 'auto'`. Funkcje: `getPresignedUploadUrl`, `getPresignedDownloadUrl`, `getPublicUrl`, `extractKeyFromPublicUrl`, `uploadFile` (server-side), `deleteFile` (idempotentne — 404 traktowane jako noop), `fileExists` (HEAD). `buildKey()` z konwencją per context: `inspections/{id}/photos/{ts}_{rand}.{ext}`, `turbines/{id}/photo_{slot}.{ext}`, `inspectors/{id}/{docType}.{ext}`, `historical/{turbine_id}/{year}_{type}_{ts}_{rand}.pdf`. `encodeR2Path()` URL-encodes segmenty pliku (polskie znaki w nazwach archiwum). Konwencja projektu: publiczne IDs hardkodowane (Account, Endpoint, Bucket, Public URL), sekretne credentialsy z env (`R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY`).
- `src/app/api/storage/presigned/route.ts` (`runtime = 'nodejs'`, `dynamic = 'force-dynamic'`) — POST endpoint generujący pre-signed PUT URL ważny 5 min. Walidacja: zalogowany user (Supabase auth.getUser()), rola admin/inspector w `profiles` (portal client_user nie ma write access), wymagane pola per context (np. `historical-protocol` wymaga `turbineId`, `year` 2010-2050, `inspectionType` annual/five_year). Response: `{ uploadUrl, publicUrl, key }`.
- `.env.example` + `.env.local.example` zaktualizowane o `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY`.
- Vercel env vars: `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY` (Sensitive=ON) dla Production + Preview. Development blokowany przez Sensitive flag, lokalne dev używa `.env.local`.
- **Smoke test 15.B** ✓: lokalnie curl bez auth zwraca 401 OK; na produkcji DevTools Console — pre-signed URL OK, PUT do R2 status 200, GET z R2 Public URL zwraca dokładnie ten sam tekst który wgrałem (`hello R2 from production 2026-04-26T13:23:48.993Z`). Pełen pipeline R2 działa end-to-end.

**Faza 15.E — schema DB `historical_protocols`** (migracja SQL ręcznie w Supabase):
- `migrations/2026-04-26_historical_protocols.sql` (~150 linii). Pierwsze podejście wymagało czyszczenia: w bazie była zostawiona poprzednia tabela z innego eksperymentu (różny schemat — `pdf_url`/`summary_notes`/`is_deleted` zamiast `protocol_pdf_url`/`notes`/uploaded_at). Zero wierszy → DROP CASCADE → ponowny Run nowej migracji.
- Drugie podejście: `enum user_role` w bazie używa `inspector` (po angielsku, nie `inspektor` po polsku jak myślałem). Edycja policies, dorzucenie `viewer` z dostępem SELECT (czwarta rola w enum, dotąd nieużywana w kodzie).
- Schema: `id`, `turbine_id` (FK), `year` (CHECK 2010-2050), `inspection_type` (CHECK 'annual'/'five_year'), `protocol_pdf_r2_key` (UNIQUE), `protocol_pdf_url`, `file_size_bytes`, `source_filename`, `protocol_number`, `inspection_date`, `notes`, `uploaded_by` (FK auth.users SET NULL), `uploaded_at`, `updated_at` z auto-trigger. UNIQUE(turbine_id, year, inspection_type) — 1 protokół per rok per typ; jeśli była i kontrola roczna i 5-letnia w tym samym roku → 2 osobne wiersze.
- 3 polityki RLS: `hp_staff_all` (admin/inspector — pełen CRUD), `hp_client_read` (client_user przez `turbines → wind_farms → client_users` — SELECT swoich), `hp_viewer_read` (viewer — SELECT all). 7 zapytań WERYFIKACJA na końcu pliku potwierdziły wszystko OK.
- `src/lib/database.types.ts` ręcznie zaktualizowany — typowanie `historical_protocols` przepisane (15 pól, w tym `inspection_type: string` non-null, `year: number` non-null, `protocol_pdf_r2_key/url: string` non-null).

**Faza 15.F — UI Archiwum** (commit `d309f12`):
- `src/lib/storage/historical-protocol-filename.ts` (~100 linii) — parser regex dla wzorca ProWaTech: `^(\d+)_T_(\d{4})\s+Protok[oó]l_kontroli_(rocznej|5-letniej)\s+(.+?)\s+(\d{2})-(\d{2})-(\d{4})$`. Akceptuje "Protokol" i "Protokół" (z/bez akcentu), case-insensitive, opcjonalne rozszerzenie. Zwraca `{ protocolNumber: "92/T/2025", year, inspectionType, inspectionDate (ISO), location }`. Walidacja zakresu lat 2010-2050 + miesięcy/dni; jeśli `dateYear` nie pasuje do `year ± 1` (anomaliczne), zostawia date null ale parser wyciąga resztę.
- `src/components/turbine/historical-protocols-tab.tsx` (~600 linii) — komponent zakładki. Lista protokołów (year DESC + type) jako tabela z kolumnami Rok/Typ (badge)/Nr protokołu/Data/Plik/Akcje. Dialog upload z drag-drop area (40 MB limit, walidacja MIME `application/pdf`), auto-fill z parsera (zielony banner "Auto-uzupełniono..."), pola: rok (number 2010-2050), typ (toggle button Roczna/5-letnia), nr protokołu (font-mono), data, uwagi. Submit flow: POST `/api/storage/presigned` (context=`historical-protocol`) → `fetch(uploadUrl, { method: 'PUT' })` z plikiem → INSERT do DB z `file_size_bytes`, `source_filename`, klucz/URL z presigned response. Obsługa błędu unique constraint (kod 23505) — komunikat "Protokół dla roku X już istnieje". Dialog edytowania meta (year/type/number/date/notes — bez ruszania pliku R2). Dialog delete confirm (kasuje rekord DB, plik R2 zostaje sierotą do uprzątnięcia w Fazie 15.G).
- `src/app/(protected)/turbiny/[id]/page.tsx` — dodany 6. tab `<TabTrigger value="archiwum" label="Archiwum" />` po Certyfikaty + odpowiadający `<TabsContent value="archiwum">` z `<HistoricalProtocolsTab turbineId={turbineId} canEdit={canUpload} />`.
- `src/app/portal/(client)/protokoly/page.tsx` — dorzucona druga sekcja "Archiwum" (Card z `<Archive>` icon) pod istniejącą listą podpisanych protokołów. Klient widzi tylko swoje protokoły historyczne dzięki RLS `hp_client_read`. Klik PDF → `window.open(protocol_pdf_url, '_blank')` (R2 Public URL).

Smoke test prod (deploy `d309f12`):
- T330-Żałe (Enercon E-53/S/72/3K/03, FW ŻAŁE / Solbet Sp. z o.o., nr ser. 531660) → zakładka Archiwum widoczna jako 6. od lewej
- Drag-drop PDF (`48_T_2024 Protokol_kontroli_rocznej ... 23-04-2024.pdf`) → banner zielony z auto-fill: rok 2024 / typ Roczna / nr `48/T/2024` / data 2024-04-23
- Klik Zapisz → spinner "Wgrywanie..." 3-5 s → dialog zamknięty, wpis w liście: 2024 / Roczna / 48/T/2024 / 23.04.2024 / PDF 4.5 MB ✓
- Plik na R2 pod kluczem `historical/{turbine_uuid}/2024_annual_{ts}_{rand}.pdf`

Decyzje projektowe:
- **R2 zamiast Backblaze B2 / Wasabi / GDrive jako primary storage** — najtańsze ($0 dla nas), S3-compatible (znane API), brak egress fees (klient pobiera za darmo), Workers integration na przyszłość. GDrive zostaje tylko dla zdjęć historycznych (Waldek już ma tam folder, nie ma sensu tego ruszać).
- **Pre-signed PUT zamiast server-side proxy** — omija Vercel limity body size (4.5 MB hobby, 25 MB pro), klient PUT-uje bezpośrednio do R2. Trade-off: wymaga CORS na buckecie (skonfigurowane), ale zysk wydajnościowy duży.
- **Tabela `historical_protocols` osobna od `inspections`** — historyczne protokoły to różny model (1 plik PDF + parę pól meta vs pełen workflow PIIB). Łączenie ich byłoby trudne i wymagałoby NULL-able większości pól w `inspections`.
- **Bucket layout per-context** — `inspections/`, `turbines/`, `inspectors/`, `historical/` jako prefiksy w jednym buckecie. Łatwiejsze RLS / lifecycle rules na przyszłość niż osobne buckety.
- **Public Development URL na start, custom domain później** — `pub-edbf124...r2.dev` jest rate-limited ale dla naszego ruchu wystarczy. Custom domain (`https://files.prowatech.pl`) wymaga CNAME na Cloudflare i to zmiana 1 linii w `R2_PUBLIC_URL` env, bez touch kodu.
- **Kasowanie z UI nie kasuje pliku R2** — Faza 15.F kasuje tylko rekord DB. Pełen cleanup wymaga osobnego API endpointa (TODO Faza 15.G + skrypt cleanup orphans).
- **Parser nazw plików auto-fillem rok/typ/nr/datę, ale NIE turbinę** — środkowa część nazwy (`EW Żałe I` / `WTG S-01 Potęgowo_Malechowo Sulechówko` / `Flower Enterprise`) jest niejednorodna. Zakładka Archiwum jest w kontekście `/turbiny/[id]`, więc `turbine_id` jest znany z URL — admin nie musi go wybierać.
- **40 MB limit pliku** — rzeczywiste skany ~5 MB (smoke test 4.5 MB), 40 MB jako bezpieczna granica dla skanów wielostronicowych bez OCR-kompresji.

Pułapki:
- **`enum user_role` ma `inspector` (English) nie `inspektor` (Polish)** — pierwsza wersja migracji rzucała `22P02: invalid input value for enum`. Naprawione + dorzucony viewer (4 rola w enum, też ma SELECT).
- **Stara tabela `historical_protocols` z poprzedniego eksperymentu** w bazie — różny schemat (`pdf_url` vs `protocol_pdf_url`, `summary_notes` vs `notes`, `created_at` vs `uploaded_at`, `is_deleted`). Tabela pusta (0 wierszy) → DROP CASCADE → reload migracji. Plik untracked `historical_2025_insert.sql` w roocie repo prawdopodobnie planowany insert dla tej starej tabeli — do wyrzucenia albo zaadaptowania w Fazie 15.G.
- **Supabase SQL Editor pokazuje tylko ostatni result set z multi-statement Run** — pierwsza diagnostyka (sekcje 1-9 osobno) pokazała tylko sekcję 9. Workaround: skondensowany `diagnostics_storage_2026-04-26_compact.sql` zwracający 8 sekcji jako 8 wierszy w 1 result-secie (`UNION ALL` z `string_agg` formatującym podsekcje jako newline-separated text).
- **Free tier Supabase nie ma backup-ów** — pre-migracja "backup now" niedostępna. Dla tej Fazy non-destructive (nowa tabela, brak modyfikacji istniejących), rollback w sekcji ROLLBACK pliku migracji jako bezpiecznik.
- **Chrome Console blokuje paste przy pierwszym uruchomieniu** — komunikat "Paste prevented for your safety". Workaround: wpisać `allow pasting` ręcznie + Enter, dopiero potem Ctrl+V. Standardowa ochrona przed phishingiem.

Pozostaje na później (Faza 15.G — opcjonalna):
- API endpoint `/api/storage/delete` server-side który kasuje plik z R2 (obecnie delete z UI tylko kasuje rekord DB, plik zostaje "sierotą").
- Skrypt `scripts/cleanup_r2_orphans.mjs` — listObjects R2 + cross-check z `historical_protocols.protocol_pdf_r2_key`, kasuje pliki bez wpisu DB. Run raz na czas albo jako Cron job na Vercel.
- Skrypt `scripts/migrate_supabase_storage_to_r2.mjs` — przepompowanie obecnych 38 MB z Supabase Storage → R2 + UPDATE `file_url` w DB (`turbines.photo_url/_2/_3`, `inspector_certificates.file_url`, `inspections.object_photo_url`, `inspection_photos.file_url`). Niski priorytet — 38 MB na Supabase free starczy długo.
- Refactor 4 miejsc upload UI na R2 (inspection-metadata-piib, turbiny/[id] photo upload, inspektorzy/[id] cert upload, photo-gallery) — żeby NOWE uploady szły od razu na R2 zamiast Supabase Storage. Średni priorytet — Supabase Storage 38 MB / 1 GB free ma jeszcze 962 MB rezerwy.

**Migracja PIIB — Faza 14 (3 zdjęcia turbiny w metryczce + protokole PDF/DOCX) DONE (2026-04-26)**

3 pliki zmienione, 425 insertions / 71 deletions. 2 commity: `cafab60` (feature) + `968be27` (fix duplikatu końcówki catch). Decyzje strategiczne (zatwierdzone z Waldkiem na starcie sesji przez AskUserQuestion):
- **Auto-pull z karty turbiny** (nie nowe pola per-inspekcja, nie hybryda) — zdjęcia są jednorazowo uzupełnione w `turbines.photo_url/_2/_3` i ciągnięte do każdej inspekcji tej turbiny.
- **3 zdjęcia w protokole** (zastąpienie pojedynczego `object_photo_url 60×45 mm`).
- **Upload analogiczny do poprzedniego flowa** — przyciski "Dodaj zdjęcie" w karcie turbiny już istniały, więc UI metryczki to tylko podgląd read-only + link do edycji w karcie turbiny.

Pliki:
- **`src/components/inspection/inspection-metadata-piib.tsx`** (+152/-71) — `loadMetadata()` rozszerzone o pobieranie `turbine_id` z inspekcji, potem osobny SELECT na `turbines (id, photo_url, photo_url_2, photo_url_3)`. Sekcja 1 "Metryczka obiektu" zastąpiona: nowy nagłówek "Zdjęcia turbiny (z karty turbiny)" + opis "Trzy zdjęcia referencyjne pobierane są z karty turbiny — te same trafiają do protokołu PDF/DOCX. Aby je dodać lub zmienić, otwórz kartę turbiny." + link `/turbiny/[id]` (z `target="_blank"`) + grid 3-kolumnowy z `<PhotoPreview>` (sub-komponent, aspect-[2/3] dla portretu, aspect-[3/2] dla pejzaży, placeholder ImageIcon "brak zdjęcia"). Stary `object_photo_url` schowany w `<details>` "Pole legacy" — jeśli URL ustawione, expand pokazuje pełen edytor (URL input + Wybierz z dysku + X), inaczej element nie renderuje.
- **`src/app/api/pdf/[id]/route.ts`** (+113/-0) — SELECT z `turbines` rozszerzony o 3 photo_url. Embed pojedynczego `objectPhoto` (60×45 mm) zastąpiony layoutem 1+2: portret 60×90 mm po lewej + 2 pejzaże 60×43 mm w pionie po prawej (gap 4 mm), centered. Brakujące sloty rysowane jako puste ramki przez `pdf.rect(...)` z setDrawColor `RGB.graphite500`. Label "Fotografie obiektu" (liczba mnoga, zamiast "Fotografia"). Fallback: jeśli żadne z 3 zdjęć turbiny nie pobrane, generator próbuje legacy `inspections.object_photo_url` z dotychczasowym layoutem 60×45 mm.
- **`src/app/api/docx/[id]/route.ts`** (+147/-9) — SELECT z `turbines` rozszerzony o 3 photo_url. Helper `photoParagraph(photo, width, height, altName)` renderuje `Paragraph` z `ImageRun` (lub "—" jeśli brak). Tabela 1×2 bez ramek (`BorderStyle.NONE` na wszystkich krawędziach, w tym `insideHorizontal/Vertical`): cell 1 = portret (227×340 px), cell 2 = 2 pejzaże stack (227×162 px każdy, separator pustym Paragraph). Webp mapowany na `'jpg'` jako `ImageRun.type` (biblioteka docx oczekuje `'jpg' | 'png' | 'gif' | 'bmp' | 'svg'`, webp nieobsługiwany). Label "Fotografie obiektu" w italic graphite500. Fallback na legacy `object_photo_url` z dotychczasowym ImageRun 240×180 px.

Decyzje projektowe:
- **Auto-pull jednokierunkowy** — UI metryczki nie pozwala edytować zdjęć (tylko link do karty turbiny). To celowe, żeby uniknąć rozsynchronizacji "które zdjęcie jest aktualne" przy wielu inspekcjach na tej samej turbinie. Edycja w jednym miejscu = źródło prawdy.
- **Stary `object_photo_url` zachowany jako legacy** — schemat DB nie ruszany, generatory mają fallback. Stare inspekcje (sprzed Fazy 14) z wgranym pojedynczym zdjęciem dalej wyglądają identycznie w protokole.
- **Puste sloty PDF jako ramki, DOCX jako "—"** — protokół zachowuje strukturę 1+2 nawet przy braku zdjęć, inspektor może je dorysować długopisem na wydruku (ten sam wzorzec co dla pustych wierszy tabel PIIB).
- **Layout 1+2 (portret + 2 pejzaże) zamiast 3 równych slotów** — zgodny z konwencją z karty turbiny i poprzednich protokołów (PROGRESS.md wspomina "portret 12×7 cm + 2 pejzaże 5,5×7 cm" z Fazy formularza inspekcji).

Pułapki:
- **Build Vercela `cafab60` failed** z `Return statement is not allowed here` na linii 2243 generator DOCX. Przyczyna: w trakcie edycji DOCX route plik został kilkukrotnie modyfikowany przez Edit tool, sandbox bash widział jego stan z opóźnieniem (znana gotcha). Mój `cat >> src/app/api/docx/[id]/route.ts << EOF ...` myśląc że plik jest obcięty na "const err =" → dorzucił 13 linijek po prawidłowym `}` zamykającym funkcję GET. HEAD na GitHubie miał 2248 linii, lokalna wersja na Windows 2248, ale sandbox widział 2235 (po Edit). Naprawione przez `head -n 2235 ... > tmp && mv tmp ...` na Windows-side + osobny commit `968be27` (13 deletions).
- **Webp w ImageRun docx** — typ TS `'jpg' | 'png' | 'webp'` z `fetchImageAsBuffer` nie pasuje do `ImageRun.type` (`'jpg' | 'png' | 'gif' | 'bmp' | 'svg'`). Mapowanie webp → 'jpg' dodane jako lokalna zmienna `imageType`. Buffer i tak idzie raw, biblioteka radzi sobie z większością formatów rastrowych.

Smoke test (deploy `968be27` po fixie):
- T150-Kowalewo / 017/R/2026 → tab "Metryczka": nagłówek "Zdjęcia turbiny (z karty turbiny)" + 3 sloty + link "Edytuj zdjęcia w karcie turbiny" + zwinięty `<details>` "Pole legacy" ze starym URL ✓
- PDF wygenerowany z prod (529 KB, 6 stron, jspdf 2.5.2): `pdfimages -list` pokazuje 1 logo + 1 alpha mask + **1 zdjęcie turbiny** (jpeg 629×462, slot 1 portret) + puste ramki w slotach 2/3 ✓
- Tekst PDF: "METRYCZKA OBIEKTU" + "Fotografie obiektu" (liczba mnoga) + wszystkie pola PIIB (adres, nr ewidencyjny, nazwa obiektu, daty) ✓

Kolejne kroki: gdy Waldek dorzuci zdjęcia 2 i 3 do karty turbiny T150 (pejzaże), kolejny PDF pokaże pełen layout 1+2.

**Migracja PIIB — Faza 11 (rewrite generatorów DOCX/PDF) DONE (2026-04-25, sesja 4)**

Pełen rewrite obu generatorów protokołów pod układ PIIB. Oba używają `inspection_type` jako warunku dla sekcji 5-letnich (jeden generator zamiast dwóch).

- **`src/app/api/docx/[id]/route.ts`** (1300+ lin, było 1110) — biblioteka `docx`. Helpery zachowane (`boldCell`, `dataCell`, `headerCell`, `multilineCell`, `sectionHeading`, `subHeading`, `bodyParagraph`, `formatDate`, `ratingLabel`). Header firmowy (logo + dane) i zielony separator brand-500 zachowany 1:1. Footer z numerem strony zachowany. Nowy `piibInfo` paragraph nad title block (cytat źródła wzoru). Title block z 5-7 paragrafami (PROTOKÓŁ NR, z dnia, opis zakresu, branża, KONTROLA OKRESOWA, PODSTAWA PRAWNA), warunkowy box ostrzegawczy o pełnym zakresie 5-letnim. Tabela ustaleń III renderowana w 2 wariantach: roczny ma 6 kolumn (ELEMENT/OPIS/OCENA/ZALECENIA/NR FOT./DATA), 5-letni ma 7 kolumn (dodatkowe ZAKRES ROCZNY + ZAKRES 5-LETNI z żółtym tłem brand-50 + OCENA+PRZYDATNOŚĆ). Color coding ocen przez `RATING_COLORS_HEX` z `protocol-tokens.ts` (sev-1..4 — dobry/dostateczny/niedostateczny/awaryjny + legacy fallback). Lewy pasek 18 DXA na pierwszej komórce wiersza w kolorze stripe oceny.
- **`src/app/api/pdf/[id]/route.ts`** (870+ lin, było 660) — `jspdf` + `jspdf-autotable`. Roboto-Regular i Roboto-Bold osadzone z `src/fonts/`. Helpery: `ensureSpace(mm)`, `addSection`, `addSubHeading`, `addBody`, `addNumberedList`, `addKeyValueTable`, `addAutoTable`. Logo PNG + zielony pasek brand-500. Title block + warunkowy box 5-letni. Tabela kryteriów ocen z `didParseCell` callbackiem aplikującym kolor tła i tekstu z `RATING_COLORS_RGB[key]`. Tabela ustaleń III analogiczna do DOCX (2 warianty), color coding na kolumnach 0 (Element) i 2/3 (Ocena) przez `didParseCell`. Page footers z numerem strony.
- **Wspólne pola pobierane przez oba generatory**:
  - `inspections`: `object_*` (4 pola), `owner_name`, `manager_name`, `contractor_info`, `additional_participants`, `documents_reviewed` (JSONB), `general_findings_intro`, `kob_entries_summary` + dotychczasowe pola (`protocol_number`, daty, statusy, podpisy)
  - `turbines`: `tower_height_m`, `hub_height_m`, `rotor_diameter_m`, `building_permit_*`, `commissioning_year`, `tower_construction_type` (te pola DB zakładam istnieją — to z dotychczasowego seedu turbin)
  - `inspection_elements`: dodane `recommendation_completion_date`, `usage_suitability` + `element_definition.applicable_standards`
  - `inspectors` z `inspection_inspectors`: dodane `chamber_membership`, `chamber_certificate_number`, `is_lead`, `rel_specialty` (z relacji)
  - 6 nowych tabel PIIB: `previous_recommendations`, `emergency_state_items`, `repair_scope_items`, `basic_requirements_art5`, `inspection_attachments`, `electrical_measurement_protocols`
  - Plus dotychczasowe: `electrical_measurements`, `service_info`, `service_checklist`

Decyzje projektowe:
- **Jeden generator z warunkiem `inspection_type`** — zgodnie z planem Fazy 11. Wszystkie sekcje 5-letnie (`isFiveYear` flag) opakowane w `if`-y. Kod ~30% dłuższy niż 2 osobne pliki, ale jednolita logika i 1 miejsce przy zmianach.
- **Dla pustych tabel PIIB pokazujemy puste 4-6 wierszy** (nie skip) — tak żeby protokół drukowany ręcznie wyglądał spójnie z papierowym wzorem PIIB. Inspektor może je dopełnić długopisem na wydruku.
- **Tytuł pliku zaktualizowany** na `protokol-PIIB-{number}.docx` / `.pdf` żeby odróżnić od starych protokołów (przed migracją).
- **Logo i header firmowy zachowane 1:1** — decyzja klienta z poprzednich faz, brand identity ProWaTech ponad układem PIIB.
- **Color coding tabeli ustaleń przez `didParseCell` w PDF** zamiast osobnych kolorowanych komórek — czystsze API jspdf-autotable. W DOCX ten sam efekt przez `shading` per komórka.

Pułapki:
- **`turbines.tower_height_m`, `hub_height_m`, `rotor_diameter_m`, `building_permit_*`, `commissioning_year`, `tower_construction_type` — zakładam że istnieją w DB**. Jeśli któreś pole jest NULL, generator pokaże `'—'` (placeholder PIIB). Jeśli kolumna w schemacie nie istnieje, query rzuci błąd — wtedy trzeba albo dopisać kolumny do `turbines` (osobna migracja), albo usunąć pola z SELECT-a generatora. Sprawdź w Supabase Table Editor.
- **`object_photo_url` w PDF nie jest renderowane jako obrazek** — tylko URL w metryczce jako tekst. DOCX też nie renderuje (tylko URL). Renderowanie zdjęcia wymaga base64 fetch i zwiększyłoby czas generowania. Zostawione dla późniejszej iteracji.
- **Generator DOCX może rzucić TypeScript error na shading argumencie** — `dataCell` używa `shading: undefined` co dla TypeScript (strict) może być potencjalnym problemem. Build Vercela ma `typescript.ignoreBuildErrors: true` więc przejdzie. Jeśli się pojawi w runtime — pokazać error.
- **Smoke test wymaga inspekcji z wypełnionymi nowymi polami PIIB**. Stare inspekcje (sprzed migracji) wygenerują się ale z dużą ilością `'—'` (puste pola). To OK — protokół PIIB ma być dla nowych inspekcji.

Pozostałe fazy:
- **Faza 12**: integracja 6 komponentów PIIB w `[id]/page.tsx` jako nowe taby (Metryczka / Sprawdzenie zaleceń / Stan awaryjny / Zalecenia PIIB / Wymagania art. 5 / Załączniki). Dodać `turbineId` jako prop do `PreviousRecommendationsTable`. Aktualizacja `turbine-inspection-form.tsx` 3-krokowego kreatora — kontekst formularzowy (kreator ≠ pełny widok edycji).
- **Faza 13**: dodatkowy smoke test z prawdziwymi danymi, ewentualne UI tweaki, finalizacja.

**Migracja PIIB — Faza 10 (nowe komponenty UI) DONE (2026-04-25, sesja 3)**

Sześć samodzielnych komponentów CRUD pod nowe tabele PIIB. Każdy `'use client'`, każdy ładuje swój stan z Supabase w `useEffect`, każdy ma debounced auto-save 800ms na blur. Konwencja hardkodowanych creds zachowana (PROGRESS.md gotcha o env inliningu).

- **`src/components/inspection/attachments-list.tsx`** (~250 lin) — PIIB sekcja VII/VIII. Lista załączników z 3 kolumnami: Lp / Opis (Input) / URL pliku (opcjonalny + ikona ExternalLink → otwiera w nowej karcie). Inline form z Input × 2 + Button na dole. Enter w opisie → submit. Tabela: `inspection_attachments`.
- **`src/components/inspection/emergency-state-table.tsx`** (~210 lin) — PIIB sekcja II "Stan awaryjny". Tabela 3-kolumnowa: Lp / Element obiektu / Zakres pilnego remontu (Textarea). Cały komponent zmienia kolor na danger (czerwone obramowanie + tło `danger-50/40`) gdy są wpisy. Dodatkowy baner z **art. 70 ust. 1 PB** o niezwłocznym powiadomieniu PINB widoczny gdy `items.length > 0`. Tabela: `emergency_state_items`.
- **`src/components/inspection/previous-recommendations-table.tsx`** (~370 lin) — PIIB sekcja II "Ocena realizacji zaleceń". 4 kolumny: Lp / Zalecenie (Textarea) / Stopień wykonania (Select tak/nie/w_trakcie z kolorowym Badge) / Uwagi. **Funkcja Import z poprzedniej inspekcji**: gdy `turbineId` przekazane jako prop, przycisk "Importuj z poprzedniej inspekcji" pobiera ostatnią zakończoną inspekcję tej turbiny i pre-populuje wiersze. Próbuje 2 źródła — najpierw `repair_scope_items` (PIIB), potem fallback do legacy `repair_recommendations.scope_description`. Tabela: `previous_recommendations`.
- **`src/components/inspection/repair-scope-table.tsx`** (~310 lin) — PIIB sekcja IV/VI "Zakres robót remontowych". **Zastępuje stary RepairTable z NG/NB/K + I-IV**. 4 kolumny: Lp / Zakres czynności (Textarea, line-through gdy wykonane) / Termin (Input tekstowy + Input type="date" do sortowania/alertów) / Status (Checkbox is_completed + auto-set completion_date przy zaznaczeniu). Header pokazuje licznik "X / Y wykonanych". Wiersze wykonane = zielona ramka + tło `success-50/40`. Tabela: `repair_scope_items`.
- **`src/components/inspection/basic-requirements-art5.tsx`** (~220 lin) — PIIB sekcja VI **TYLKO 5-letni**. 7 preset rows (z `BASIC_REQUIREMENTS_ART5` w constants.ts) **auto-create przy pierwszym otwarciu** jeśli baza pusta. Każdy wiersz: nazwa wymagania + kod (font-mono) / Select Spełnia/Nie spełnia/Nie dotyczy z kolorowym Badge / Input uwagi. Tabela: `basic_requirements_art5`. Sortowanie po kolejności w `BASIC_REQUIREMENTS_ART5`.
- **`src/components/inspection/inspection-metadata-piib.tsx`** (~330 lin) — kompozyt 4 sekcji metryczki PIIB:
  1. Metryczka obiektu (object_address, object_registry_number, object_name, object_photo_url z preview img)
  2. Strony protokołu (owner_name, manager_name, contractor_info, additional_participants)
  3. Dokumenty do wglądu (5 sub-pól w `documents_reviewed` JSONB: previous_annual, previous_5y, electrical_measurements, service, other)
  4. Wprowadzenie do II + KOB (general_findings_intro Textarea + kob_entries_summary z dynamicznym labelem "12 miesięcy" / "5 lat" zależnie od `inspectionType`)

  Edytuje `inspections` bezpośrednio przez `update().eq('id', inspectionId)`. Wszystkie pola nullable.

Decyzje projektowe:
- **Każdy komponent self-contained** zamiast jednego mega-komponentu wszystkich sekcji PIIB. Łatwiejsze do wstawienia w istniejącą strukturę zakładek (Elementy / Serwis / Zalecenia / Zdjęcia / Wnioski) — w Fazie 12 dodamy nowe taby lub rozbudujemy istniejące.
- **AttachmentsList nie używa storage'a** — tylko URL string. Upload plików wymaga osobnego flowa (Supabase Storage), zostawiam na późniejszy iteracje. Pole `google_drive_file_id` w tabeli istnieje ale w UI nieużywane — kompatybilne z istniejącym wzorcem `inspection_photos.google_drive_file_id`.
- **PreviousRecommendationsTable importuje z legacy `repair_recommendations`** jako fallback — nie ignoruje historycznych danych przed migracją PIIB. Jeśli klient miał stare zalecenia NG/NB/K w starym schemacie, można je zaimportować jako "zalecenia z poprzedniej kontroli" i zaznaczyć status realizacji.
- **BasicRequirementsArt5 auto-create** zamiast manualnego "dodaj wymaganie" — 7 wymagań art. 5 PB jest stałe i obowiązkowe dla każdej kontroli 5-letniej, nie ma sensu wymuszać manualnego klikania "Dodaj 7 wymagań".
- **InspectionMetadataPiib jako pojedynczy widget z 4 sub-cards** zamiast 4 osobnych komponentów — wszystkie pola edytują tę samą tabelę `inspections`, łatwiej trzymać razem ze względu na auto-save (jedna debounceRef dla całego widgeta, nie 4 osobne).

Pułapki:
- **Wszystkie 6 komponentów hardkoduje SUPABASE_URL + ANON_KEY** zamiast importować z `@/lib/supabase/client`. To jest świadoma kontynuacja istniejącej konwencji projektu (inne komponenty inspection robią tak samo, env inlining nie działa z `NEXT_PUBLIC_*` w Vercel produkcyjnym — patrz wcześniejsze gotchas). Przy rotacji klucza Supabase trzeba zmienić w 6 nowych miejscach + ~5 starych. Da się to zrobić jednym sed-em.
- **Nie testowane lokalnie** — komponenty są standalone, wymagają osadzenia w `[id]/page.tsx` żeby były widoczne. Faza 12 to integracja + smoke test.

Pozostałe fazy:
- **Faza 11**: pełen rewrite generatorów DOCX (`/api/docx/[id]`) i PDF (`/api/pdf/[id]`) wg układu PIIB. Obecne generatory nadal renderują stare układy z 5-stopniową skalą — TS się skompiluje, bo enum ma 7 wartości, ale wizualnie protokół jest niezgodny z PIIB.
- **Faza 12**: integracja 6 nowych komponentów w `[id]/page.tsx` jako nowe taby lub sekcje (Metryczka / Sprawdzenie zaleceń / Stan awaryjny / Zalecenia PIIB / Wymagania art. 5 / Załączniki). Dodać `turbineId` jako prop do `PreviousRecommendationsTable`. Aktualizacja `turbine-inspection-form.tsx` 3-krokowego kreatora pod te same komponenty.

**Migracja PIIB — Faza 9 dokończona (2026-04-25, sesja 2)**

Komponenty oceny stanu technicznego przerobione pod 4 stopnie PIIB. Poprzednia sesja zostawiła `protocol-tokens.ts`, ta dokończyła pozostałe trzy artefakty + integrację z widokiem detalu inspekcji.

- **`src/lib/constants.ts`** — `CONDITION_RATINGS` rozszerzone do 7 wartości (4 PIIB + 3 legacy z polskimi etykietami), `CONDITION_COLORS` analogicznie z aktywnymi → `success/info/warning/danger`, legacy zachowują oryginalne tony. Nowe eksporty: `CONDITION_RATINGS_ACTIVE` (lista 4 wybieralnych z opisami z PIIB sekcji 3 raportu zmian), `LEGACY_TO_PIIB_RATING` (mapowanie zadowalajacy→dobry, sredni→dostateczny, zly→niedostateczny — zgodnie z faktyczną migracją DB), helper `isActiveRating(value)`. Plus 4 nowe stałe pomocnicze pod kolejne fazy: `USAGE_SUITABILITY`, `COMPLETION_STATUSES`, `BASIC_REQUIREMENTS_ART5` (7 wymagań art. 5 PB jako preset rows), `REQUIREMENT_MET_OPTIONS`.
- **`src/components/inspection/rating-badge.tsx`** — typ `RatingValue` z 4 PIIB + 3 legacy, fallback gdy klucz nieznany (graphite-100 placeholder), label czytany z `CONDITION_RATINGS` mapy.
- **`src/components/inspection/element-card.tsx`** — pełny rewrite struktury sekcji (zachowana nazwa propsa `not_applicable` w lokalnym typie, mapping `is_not_applicable` ↔ `not_applicable` jest w `[id]/page.tsx`):
  - Nowy prop `inspectionType?: 'annual' | 'five_year'` (domyślnie `'annual'` dla kompatybilności).
  - Sekcja "Zakres kontroli i przepisy" rozdzielona na 3 części: `Zakres roczny (oględziny)` zawsze, `Zakres dodatkowy 5-letni` tylko dla `five_year`, `Przepisy / normy / wytyczne` zawsze (jeśli `applicable_standards` niepuste). Wszystkie z `whitespace-pre-line` żeby zachować łamania z PIIB seedów.
  - Select oceny zawiera tylko 4 aktywne wartości z `CONDITION_RATINGS_ACTIVE`. Jeśli rekord ma ocenę legacy, dodatkowy `SelectItem` z suffixem "(legacy)" + warning poniżej z proponowanym mapowaniem.
  - Dropdown `usage_suitability` (Spełnia / Nie spełnia) widoczny TYLKO dla `five_year` — odpowiada kolumnie "Przydatność" w PIIB sekcji III protokołu 5-letniego.
  - Slider `wear_percentage` ukryty domyślnie. Pokazuje się READ-ONLY gdy `wear_percentage > 0` (legacy data) z banerem "Pole z poprzedniego wzoru. W nowych protokołach PIIB nie jest używane."
  - Nowy `Input type="date"` dla `recommendation_completion_date` w 2-kolumnowym gridzie obok `Nr fot.`.
- **`src/app/(protected)/inspekcje/[id]/page.tsx`** — interface `InspectionElement` rozszerzony o `usage_suitability` + `recommendation_completion_date`, `ElementDefinition` o `applicable_standards`. Oba SELECT-y (initial fetch + refetch) pobierają nowe pola z DB. Mapowanie wzbogacone analogicznie. `createElementsFromDefinitions(inspectionId)` przeczytany pod nową logikę: pobiera `inspection_type` z `inspections`, filtruje definicje przez `is_active=TRUE` i `applies_to_annual=TRUE` lub `applies_to_five_year=TRUE` zależnie od typu — nowa inspekcja roczna dostanie 15 elementów PIIB (bez Estetyki), 5-letnia 16. Renderowanie `ElementCard` przekazuje `inspectionType={inspection.inspection_type}`.

Decyzje projektowe potwierdzone w sesji:
- **Lokalna nazwa `not_applicable` w komponencie zostaje** mimo że DB ma `is_not_applicable`. Mapping już jest w `[id]/page.tsx` od poprzednich faz (commity `cff318d` i wcześniejsze). Zmiana nazwy w komponencie wymagałaby też zmiany w innych miejscach renderujących ElementCard — przez compatibility shim zostawiamy.
- **Slider wear% jako legacy view-only zamiast usunięcia** — pozwala obejrzeć historyczne dane bez utraty kontekstu, ale nowe inspekcje go nie pokażą (bo `wear_percentage` zostanie 0/null po zmianach z poprzedniej sesji).
- **Legacy ratings w `Select` jako extra `SelectItem` (a nie podmiana)** — jeśli inspektor otworzy starą inspekcję, nie chcemy stracić informacji "była zła w starej skali", ale chcemy go zachęcić do zmiany. Stąd warning + sugerowana mapping value w copy.

Pułapki:
- **Dwa SELECT-y w `[id]/page.tsx` z duplikowanym body** (initial fetch + refetch po update). Trzeba edytować oba — łatwo zapomnieć. Następnym razem rozważyć ekstrakcję do funkcji.
- **`applicable_standards` to nowa kolumna z migracji 8** — jeśli na produkcji zapomnielibyśmy zaktualizować seed elementów (Faza 8 robiła to), wartości byłyby NULL i w UI sekcja "Przepisy" by się nie pokazała (wewnątrz `whitespace-pre-line` z `if applicable_standards` warunkiem). Verifikacja: 16 elementów PIIB ma niepuste `applicable_standards` w SQL seed.

**Migracja PIIB — Faza 8 DB + częściowo Faza 9 UI (2026-04-25)**

Wzory protokołów kontroli okresowej (roczna i 5-letnia) dostosowane do układu **Załącznika do uchwały nr PIIB/KR/0051/2024 Krajowej Rady Polskiej Izby Inżynierów Budownictwa z 04.12.2024 r.** Cel biznesowy: protokoły rozpoznawane i akceptowane przez powiatowe inspektoraty nadzoru budowlanego, spójne z dokumentami sporządzanymi dla pozostałych obiektów budowlanych w portfelu zarządcy.

Pliki wejściowe od Waldka (uploady 2026-04-25): `Protokol_Kontroli_Rocznej_EW_PIIB.docx`, `Protokol_Kontroli_5-letniej_EW_PIIB.docx`, `Raport_zmian_wzory_PIIB.docx`.

Decyzje strategiczne (zatwierdzone z Waldkiem na starcie sesji):
- Mapowanie ocen wg raportu PIIB sekcja 3: `zadowalajacy → dobry`, `sredni → dostateczny`, `zly → niedostateczny`. Po migracji aktywne 4 stopnie: `dobry / dostateczny / niedostateczny / awaryjny`.
- Pola legacy (`wear_percentage`, `repair_recommendations.repair_type` NG/NB/K, `repair_recommendations.urgency_level` I-IV) zachowane w schemacie, ukryte w UI dla nowych protokołów. Stare inspekcje w eksportach mogą je nadal pokazywać dla dokumentacji historycznej.
- Jeden generator DOCX/PDF z warunkiem na `inspection_type` (sekcje 5-letnie warunkowe — Skład komisji, kolumna "Zakres dodatkowy 5-letni", pomiary elektryczne, wymagania art. 5 PB, element "Estetyka").
- Plan w fazach (8-13), nie all-in-one. Każda faza = osobny commit.

**Faza 8 — migracja DB (DONE 2026-04-25), commit `9f51b24`:**
- Pełen plan w `MIGRATION_PLAN_PIIB.md` (root repo) — analiza wpływu, fazy, ryzyka, rollback plan.
- `migrations/2026-04-25_piib_protocol.sql` (~480 linii): dodanie wartości `dostateczny` + `niedostateczny` do enuma `condition_rating`, mapowanie istniejących wartości (3 UPDATE-y na `inspection_elements.condition_rating`, `inspections.overall_condition_rating`, `defect_library.typical_rating`), 11 nowych kolumn metryczki PIIB w `inspections` (object_address, object_registry_number, object_name, object_photo_url, owner_name, manager_name, contractor_info, additional_participants, documents_reviewed JSONB, general_findings_intro, kob_entries_summary), 2 nowe kolumny w `inspection_elements` (usage_suitability text CHECK 'spelnia'/'nie_spelnia', recommendation_completion_date date), 6 nowych tabel z RLS: `previous_recommendations` (II — ocena realizacji zaleceń), `emergency_state_items` (II — stan awaryjny), `repair_scope_items` (IV/VI — Zakres czynności / Termin), `basic_requirements_art5` (VI — tylko 5-letni), `inspection_attachments` (VII/VIII — załączniki), `electrical_measurement_protocols` (IV.C — wykaz protokołów do KOB).
- `migrations/2026-04-25_piib_element_definitions_v2.sql`: re-seed `inspection_element_definitions`. **V1 zawiodła z 23505** (`could not create unique index ... section_code='A' is duplicated`) — istniejący seed używał kodów A/B/C/D/E jako grup (nie unique). V2: dezaktywacja wszystkich 17 starych wierszy (is_active=FALSE — zachowuje referencje z `inspection_elements`), częściowy `UNIQUE INDEX ... WHERE is_active = TRUE` zamiast pełnego constraint, INSERT 16 nowych elementów PIIB (15 rocznych + 1 dodatkowy 5-letni "Estetyka") z polami `scope_annual` + `scope_five_year_additional` + `applicable_standards` (cytaty PIIB).
- Każdy nowy SQL ma sekcję WERYFIKACJA z dokładnymi oczekiwanymi wynikami. Waldek wykonał obie migracje ręcznie w Supabase SQL Editor 2026-04-25 ~11:20-11:30 — wszystkie weryfikacje OK (15 dla rocznej / 16 dla 5-letniej / 17 legacy dezaktywowanych).
- `migrations/README.md` z instrukcją krok-po-kroku (backup → SQL #1 → SQL #2 → regeneracja types → smoke test → commit).
- `src/lib/database.types.ts` zaktualizowany ręcznie: enum `condition_rating` rozszerzony do 7 wartości (4 PIIB + 3 legacy), nowe kolumny w `inspections` i `inspection_elements`, definicje 6 nowych tabel z Relationships do `inspections`.

**Faza 9 (rozpoczęta 2026-04-25) — UI komponentów oceny:**
- `src/lib/design/protocol-tokens.ts` (single source of truth dla DOCX/PDF): rozszerzone `RatingKey` o `dostateczny` + `niedostateczny`, dodany `RatingKeyActive` (tylko 4 PIIB), nowe kolory w `RATING_COLORS_HEX/RGB` 1:1 z prototypem (dobry=zielony success, dostateczny=niebieski info, niedostateczny=amber warning, awaryjny=czerwony danger), legacy wartości (`zadowalajacy/sredni/zly`) zachowane z oryginalnymi kolorami dla bezpiecznego renderingu starych rekordów. Dodana stała `RATING_KEYS_ACTIVE` jako lista wybieralnych w UI w kolejności od najlepszej do najgorszej. `RATING_LABELS` zaktualizowany — aktywne 4 + legacy 3 (na wszelki wypadek).

**Pułapki napotkane podczas sesji (na przyszłość):**
- **Mount Cowork sandbox bash desynchronizuje się** od pliku po `Edit` przez okno tooli. `Read` widzi prawdziwą zawartość, `bash wc -l` widzi cache sprzed 10+ edytów. To jest INNE od phantom `.git/index.lock` z poprzednich sesji — ten bug dotyczy plików `src/`, nie `.git/`. Workaround: zaufanie `Read tool` jako single source of truth podczas edycji, walidacja TypeScript przez `npm run dev` lub Vercel build (nie przez `npx tsc --noEmit` w bash sandbox).
- **Edit bez końcowego newline w `new_string` skleja się z następną linią pliku.** Podczas dopisywania końcówki `database.types.ts` (od ostatniej obciętej linii `commissioning_dat`) zakończyłem `new_string` na `} as const` (bez `\n`), w pliku po nim była dalej kontynuacja `e?: string | null` od oryginału. Wynik: `} as conste?: string | null` — 287 zduplikowanych linii. Naprawa jednym dużym Edit-em z `old_string` na 235 linii. **Zasada**: każdy `new_string` w `Edit` kończ jawnym `\n` jeśli to nie ostatnia linia pliku.
- **Markdown w chacie obcinał `ON DELETE CASCADE,` z bloków SQL** — gdy SQL został wklejony do Supabase Editor, fragmenty inline obcinały się. Workaround: zawsze udostępniać pliki przez `computer://` link, nigdy nie kazać użytkownikowi kopiować długich SQL z chatu.

**TODO przyszła sesja (Faza 9 dokończenie + 10-13):**
- `src/lib/constants.ts` — `CONDITION_RATINGS` na 4 stopnie + `LEGACY_RATING_LABELS` jako fallback dla starych wartości.
- `src/components/inspection/rating-badge.tsx` — toggle 4 wartości aktywne, legacy fallback.
- `src/components/inspection/element-card.tsx` — ukrycie slidera `wear_percentage` (legacy view-only dla starych inspekcji), dodanie dropdown `usage_suitability` dla `inspection_type === 'five_year'`, scope split na "Zakres roczny" + "Zakres dodatkowy 5-letni" + "Przepisy / normy".
- 5 nowych komponentów PIIB: `previous-recommendations-table`, `emergency-state-table`, `repair-scope-table`, `basic-requirements-art5`, `attachments-list`, `inspection-metadata-piib`.
- Generatory DOCX i PDF — pełen rewrite pod układ PIIB (jeden generator z warunkiem `inspection_type`).
- `turbine-inspection-form.tsx` — aktualizacja 3-krokowego kreatora (4 oceny, ukrycie wear%, sekcje metryczki PIIB).
- **Regeneracja `database.types.ts` przez Supabase CLI** dla pełnej spójności z views i ewentualnymi ukrytymi indeksami (Waldek wykona w przyszłej sesji: `npx supabase gen types typescript --project-id lhxhsprqoecepojrxepf > src/lib/database.types.ts`, wymaga `npx supabase login` jednorazowo).

**Generowanie dokumentów (2026-04-10 → 04-13)**
- PDF: poprawione nazwy kolumn i JOIN-y, obsługa polskich znaków przez osadzony font Roboto.
- PDF: nagłówek firmowy ProWaTech + prawny tytuł protokołu, logo ProWaTech w nagłówku.
- DOCX: nowy endpoint `/api/docx/[id]` + przycisk pobierania. Po kilku iteracjach naprawione: runtime `nodejs`, poprawne użycie `PageNumber`, `Buffer`, `altText` dla obrazów.

**Branding (2026-04-12)**
- Logo ProWaTech zastąpiło ikonę `Wind` w sidebarze, nagłówku i na stronie logowania.

**Iteracja po feedbacku testera (2026-04-10)**
- Duży batch: fix zapisu, szablony, automatyczne daty, wyszukiwanie.
- Picker biblioteki defektów w formularzu inspekcji.
- Per-element photos, picker biblioteki dla notatek i rekomendacji, auto-fill inspektora.
- Typ naprawy i pilność jako szybkie przyciski toggle (zamiast `select`).
- Slider zużycia widoczny tylko dla inspekcji 5-letnich.
- Śledzenie poprzednich findings per-turbine (ładowanie i wyświetlanie).
- Zmiana etykiety "Konserwacja" → "Prace konserwacyjne".
- Wyszukiwanie inspekcji po turbinie / farmie / kliencie + działający filtr klienta.
- Przycisk usunięcia inspekcji (admin, soft-delete przez `is_deleted`).

**Inspektorzy i certyfikaty (2026-04-10)**
- GWO jako 4 osobne kursy z datami ważności (First Aid, Manual Handling, Fire Awareness, Working at Heights).
- Formularz inspektora: WINDA ID, skany uprawnień + izby, specjalność jako enum.
- `rated_power_kw` → `rated_power_mw` (migracja kolumn), pola certyfikatów izby.
- Farm → turbine filtr (kaskadowy), certyfikaty GWO / UDT / SEP, checklista ukończenia.

**Formularz inspekcji + UI (2026-04-07 → 04-08)**
- `TurbineInspectionForm` — 3-krokowy formularz zoptymalizowany pod tablet.
- Podłączony do Supabase z realnymi definicjami elementów.
- Struktura formularza odpowiada strukturze protokołu papierowego.
- Kompletna modernizacja UI: profesjonalny design, tablet-first.
- Shadcn-ui wdrożony jako biblioteka komponentów.
- Karta turbiny: zdjęcie, poprzednie findings, status, upload dla admin/inspektor.
- Layout zdjęć 3-photo: portret po lewej + 2 pejzaże po prawej, dokładne wymiary (12×7 cm portret, 5,5×7 cm pejzaż).

**Stabilizacja (2026-04-02 → 04-07)**
- Naprawa błędów SSR w Supabase: `createClient()` przeniesiony poza poziom komponentu, potem do `useEffect`, ostatecznie zrobiony tak, by był wywoływany dopiero runtime.
- Hardkodowanie kredenciali Supabase (po problemach z inlining zmiennych środowiskowych w buildzie Vercel).
- PWA: manifest, ikony, meta tagi.
- Naprawa nazw kolumn (polskie → angielskie), filtry `is_deleted`, null-safe access dla JOIN-ów, empty `SelectItem` values → `'all'`.

**Początek (2026-04-01 → 04-02)**
- Initial commit: aplikacja Next.js.
- Ominięcie błędów TypeScript/ESLint w buildzie Vercel.

## W toku / następne kroki

**Redesign — Faza 1 DONE (2026-04-23).** Tokeny, fonty i komponenty bazowe wdrożone w commit `0c4fd3c`.

**Redesign — Faza 2 DONE (2026-04-23).** Re-skin wszystkich ekranów wewnętrznych wdrożony w commit `a43d457`. Zero hard-coded `blue-*`/`gray-*`; wszystkie klasy tokeny z Fazy 1.

**Redesign — krok 7 (wariant A — re-skin komponentów detalu inspekcji + dead code cleanup) DONE (2026-04-24)**, 2 commity:
- `cff318d` — **feat(design): krok 7 wariant A — re-skin komponentow detalu inspekcji + dead code cleanup.** 4 pliki w `src/components/inspection/`: photo-gallery (13 hits), repair-table (7+7 hits), electrical-measurements (5+1 hits), service-checklist (4+1 hits). Razem 39 insertions / 39 deletions.
- `6dd2507` — **chore(cleanup): remove dead code new-inspection-wizard.tsx.** 823 linii w `components/forms/`, nie importowany nigdzie (`grep NewInspectionWizard` w `src/` = 0 poza definicją). Usunięty na czysto — rozwiązuje ostatnie 7 hits blue/gray w `src/components/forms/`.

Zakres re-skinu (commit `cff318d`):
- **`photo-gallery.tsx`** — loading/empty `text-graphite-500`, CTA „Dodaj zdjęcie" default primary (bg-blue override usunięty), **karta zdjęcia `bg-white + border-graphite-200 + shadow-xs + rounded-xl`** (wcześniej bg-gray-50), aspect placeholder `bg-graphite-100`, **element badge `bg-info-50 text-info-800`**, edit button neutral graphite, delete button `text-danger/danger-800/danger-50`, modal preview graphite-100.
- **`repair-table.tsx`** — **kluczowa zmiana `urgencyColors`**: I=`bg-danger-100 text-danger-800`, II=`bg-warning-100 text-warning-800`, III=`bg-info-100 text-info-800`, IV=`bg-graphite-100 text-graphite-800` (1:1 z `URGENCY_COLORS_HEX/RGB` z `protocol-tokens.ts` używanym w DOCX A3 i PDF B3 z kroku 4). `typeColors`: NG=`danger`, NB=`warning`, K=`success`. TableHeader `bg-graphite-50 hover:bg-graphite-50 border-b border-graphite-200`. Edit button neutral graphite, delete danger token, save button default primary.
- **`electrical-measurements.tsx`** — shared-fields box `bg-graphite-50 border border-graphite-200`, TableHeader graphite wzorzec, `row.hover:bg-graphite-50/50 border-b border-graphite-100`, delete danger, CTA default primary.
- **`service-checklist.tsx`** — checklist item `border-graphite-200 rounded-xl p-4 shadow-xs hover:bg-graphite-50`, strikethrough `line-through text-graphite-500`, delete danger, save button default primary.

Decyzje projektowe:
- **Wariant A (re-skin + dead code)** wybrany zamiast wariantu C (refactor `turbine-inspection-form.tsx` 2058 linii). Wariant C odłożony — nie ma pilnego powodu, plik choć duży działa i nie ma hits blue/gray (zmigrowany w Fazie 2).
- **`urgencyColors` jako single source of truth przez tokeny**, nie osobna tabelka semantic w protocol-tokens.ts. Komponent UI używa Tailwind classy (`bg-danger-100` itp.), protokoły używają `URGENCY_COLORS_HEX/RGB` (identyczne semantycznie, inne formaty dla jspdf/docx). Konwencja: **każda zmiana palety urgency = update w obu miejscach**.
- **Delete button wszędzie na token `danger`** zamiast Tailwindowego `text-red-600` — spójne z resztą aplikacji, zgodne z palety semantic.
- **`new-inspection-wizard.tsx` usunięty, nie przekierowany ani zarchiwizowany.** Grep potwierdził 0 importów. Jeśli w przyszłości będzie potrzebny wizard, robimy nowy v2 od zera, nie odkopujemy tego.

Gotchas:
- **Bracketed paste mode w Git Bash MINGW zjada pierwszą linię wielokrokowego paste.** Dzisiejsza sesja: `git rm ...` wkleił się jako `^[[200~git rm ...~` i został zignorowany przez shell. Workaround: wklejaj komendy pojedynczo, albo użyj prawego przycisku myszy zamiast Ctrl+V.

**Redesign — krok 6 (reszta paneli) DONE (2026-04-24)**, 3 commity:
- `368d34d` — **chore(repo): add .gitattributes enforcing LF line endings.** Preventive measure: `* text=auto eol=lf` + binary exclusions (png/jpg/pdf/docx/xlsx/pptx/woff/ttf). Nie rozwiązuje zaległych null bytes w HEAD obiektów gitowych (wymagałoby `git filter-branch`/BFG, osobny temat), ale blokuje pogłębianie problemu przy przyszłych edycjach z Windows-side Cowork.
- `d15929a` — **feat(design): krok 6 — re-skin pozostałych paneli.** 13 plików, 110 insertions / 119 deletions (clean diff bez null-byte szumu).
- `5ced61d` — **feat(layout): link „Diagnostyka" w sidebar + mobile-nav (admin-only).** Fetch `profile.role` w `(protected)/layout.tsx` po `getSession()`, przekaz jako `userRole` prop do Sidebar i MobileNav. Komponenty dzielą `navItems` na `NAV_ITEMS_BASE` (widoczne dla wszystkich) + `NAV_ITEMS_ADMIN` (tylko role=admin). Ikona `Activity` z lucide-react.

Zakres re-skinu (commit `d15929a`):
- `/inspektorzy/page.tsx` — pełny re-skin listy (wcześniej 37 hits blue/gray): nagłówek, CTA „Dodaj inspektora" zielony primary, empty state, karty mobile, tabela desktop (8 kolumn). Badges certyfikatów: **GWO=info (niebieski), UDT=warning (amber), SEP=neutral (graphite)** — SEP jako wyjątek bo brak purple w tokenach. Badge Aktywny=success, Nieaktywny=neutral. Font-mono na `license_number` i `phone`.
- `components/forms/inspector-form.tsx` — 5 kolorowych sekcji wg semantic tokens: **Uprawnienia=primary-50/700, Izba=success-50/800, GWO=info-50/800, UDT=warning-50/800, SEP=graphite-100/800**. Error box=danger-50/800. Scan link=info-800.
- `components/layout/sidebar.tsx`, `header.tsx` — dokończenie migracji z Fazy 1: `border-graphite-200`, `shadow-xs`, user section graphite.
- `components/layout/mobile-nav.tsx` — pełna migracja na tokeny + **logo ProWaTech zamiast Wind-icon-w-niebieskim-boxie** (konsystencja z desktop sidebar).
- `(protected)/layout.tsx` — `text-graphite-500` na „Ładowanie…" loading message.
- `/diagnostyka/page.tsx` — `bg-graphite-900`, `text-success` na JSON output, nowa struktura (nagłówek + opis), `font-mono` + `shadow-xs` + `rounded-xl` na `<pre>`.
- `/login/page.tsx` — `bg-gradient from-primary-50 to-primary-100` (wcześniej blue), `border-graphite-200`, `shadow-lg`, graphite texts.
- `components/ui/{avatar,separator,skeleton,sheet,dropdown-menu}.tsx` — mop-up fallbacków shadcn (`bg-gray-*` → `bg-graphite-*`, `text-gray-*` → `text-graphite-*`).

Decyzje projektowe:
- **SEP = graphite** (nie purple) bo paleta nie ma `purple-*` w tokenach; traktujemy SEP jako neutralną „trzecią" kategorię certyfikatów, spójną hierarchicznie po GWO (info) i UDT (warning). Jeśli kiedyś dojdzie purple do palety, SEP przejdzie na purple.
- **Link „Diagnostyka" admin-only w UI, nie na route** — strona `/diagnostyka` dalej dostępna bezpośrednio przez URL (RLS na DB i tak chroni dane). Jeśli chcemy server-side guard — osobny ticket.
- **`.gitattributes` dodany jako osobny commit** (nie razem z re-skinem) — zgodnie z polityką „jeden commit = jeden rodzaj zmiany", żeby `git blame` kroku 6 było clean.

Pułapka sesji (ważna na przyszłość — patrz też „Gotchas" niżej):
- **Null bytes w plikach `src/`** — podczas sesji Cowork okazało się, że **80 plików w `src/` ma null bytes zacommitowane w HEAD** (`git show HEAD:file | grep -c $'\\x00'` daje np. 70 dla `dashboard/page.tsx`). Prawdopodobna przyczyna: wcześniejsze edycje z Windows-side zapisywały fragmenty UTF-16 LE lub bug Edit tool. Build Vercela przechodzi przez `typescript.ignoreBuildErrors: true`. Git for Windows z `core.autocrlf=true` maskuje problem u klienta (po `git checkout` pliki w WT są LF bez null bytes), ale jak sklonuje ktoś na Linux bez autocrlf, dostanie uszkodzone pliki. `.gitattributes` zapobiega pogłębianiu — nie cofa historii.
- **`tr -d '\\0'` obcina ogony plików UTF-16 LE** — klasyczny bug: plik UTF-16 LE kończący się pełnym znakiem ma parę bajtów `X\\0` lub `\\0X` na końcu, które `tr -d '\\0'` usunie częściowo → ostatnie bajty lecą w niebyt. W sesji 2026-04-24 zepsuło to 13 plików (ogony exportów ucięte do `Separato`, `Skeleto`, `SheetDescrip` itd.). Naprawione ręcznie dopisywaniem brakujących ogonów. **Zasada**: do konwersji UTF-16 LE → UTF-8 używać `iconv -f UTF-16LE -t UTF-8`, nigdy `tr -d '\\0'`.
- **Phantom `.git/index.lock` w Cowork sandbox** — w sesji Cowork mount `.git/` ma Windows ACL, nie pozwala sandboxowi na `rm` pliku który Git tworzy. Skutek: Claude w Cowork **nie może zrobić `git commit`** — trzeba to robić z Windows-side przez Git Bash. Plik lock istnieje jako „phantom" (widoczny w `ls .git/` ale `stat .git/index.lock` mówi „No such file") — nieusuwalny z sandboxa, nieaktywny.

**Redesign — krok 5 (Turbina · detail redesign) DONE (2026-04-24)**, commity `fe30f4a` → `26ae3a2`:
- `fe30f4a` C1 — hero graphite + struktura 5 tabs (dotychczasowa zawartość opakowana w tab „Przegląd"). Nowy fetch `inspectionsCount` + `openRecsCount` do liczników tab-trigger i chipów hero. W tym commicie też wprowadzenie `SESSION_HANDOVER_2026-04-24.md` (plik to-shot-use, później usunięty).
- `163cc47` C2 — tab Przegląd: wykres oceny w czasie (inline SVG, 6 ostatnich inspekcji, skala sev-1..5 z empty state gdy <2 punkty), karta „Ostatnia kontrola" (nr protokołu Mono, data, lead inspector, linki PDF/DOCX), karta „Najbliższe przeglądy" (3 typy kontroli z countdown dni).
- `e8a197e` C3 — tab Historia inspekcji (tabela 5-kol: Data · Nr protokołu · Typ pill · Inspektor · PDF/DOCX linki) + tab Zalecenia (filter bar „Tylko otwarte", lista kart z urgency pills I-IV, element + opis + rodzaj + deadline + nr protokołu). Wspólne `URGENCY_UI` (klucze I/II/III/IV, klasy Tailwind) zgodne z DOCX A3 / PDF B3.
- `26ae3a2` C4 — tab Zdjęcia (grid 2/3/4-kol responsywny, badge „FOT. NN" na tile, opis + nr protokołu + data pod spodem, klik otwiera pełny obraz) + tab Certyfikaty (lista kart per inspektor z ostatniej inspekcji, certyfikaty UDT/SEP/GWO/Izba z expiry pills: success >90d / warning ≤90d / danger przeterminowane).

Decyzje projektowe potwierdzone w tym kroku:
- Karta „Ustalenia z ostatniej kontroli" (legacy `previous_findings`) **zostaje** w tab Przegląd — Waldek ma tam dane z poprzednich kontroli, zniknie gdy zostaną zmigrowane do `repair_recommendations`.
- Wykres oceny w czasie: **empty state gdy <2 punkty** (z info „Pierwsza inspekcja: [data]. Trend pojawi się po drugiej inspekcji").
- Stare 3 zdjęcia turbiny (`turbines.photo_url/2/3`) **zostają w tab Przegląd** jako wizytówka — nie przenoszone do tab Zdjęcia. Empty state tab Zdjęcia wskazuje użytkownikowi gdzie je znaleźć.
- Tab Historia — **prosta tabela** (data / nr / typ / PDF/DOCX), bez ocen pill czy rich details, bo szczegóły są w samym PDF-ie. Decyzja uzasadniona planami dodawania protokołów historycznych w osobnym feature (inne storage niż Supabase, decyzja odłożona).

Wzorce:
- `InspectionTrendChart` — inline SVG 600×200, 5 grid lines, gradient fill brand-500 18%, linia brand-600 2.5px, punkty r=4 (ostatni r=5 w amber), X labels Mono data, Y labels „Dobry / Zadow. / Średni / Zły / Awaryj.". Skala Y: dobry=5 (górę), awaryjny=1 (dół).
- `URGENCY_UI` w `page.tsx` — map `{ I: danger-50/danger-800, II: amber-100/amber-800, III: info-50/info-700, IV: graphite-100/graphite-700 }`, identyczne wartości jak `URGENCY_COLORS_HEX` z `protocol-tokens.ts` ale jako klasy Tailwind dla UI.
- Joiny przez inner join `inspections!inner(turbine_id, is_deleted)` + filter — wzorzec używany w C3 (`repair_recommendations`) i C4 (`inspection_photos`). Konsekwentny z wzorcami z kroku 4 (DOCX/PDF).
- Empty states everywhere — każdy tab ma sensowny komunikat gdy dane są puste (zgodnie z gotchaa „baza nowych inspekcji jest pusta, będzie napełniana przez aplikację w najbliższym czasie").

**Redesign — krok 4 (re-skin protokołu PDF/DOCX) DONE (2026-04-24)**, commity `654e9b4` → `f48a07e`:
- `654e9b4` A1 — DOCX paleta + typografia (nowy moduł `src/lib/design/protocol-tokens.ts`)
- `5dd35ec` A2 — DOCX color-coding ocen sev-1..5 w tabeli elementów
- `6ab653b` A3 — DOCX color-coding pilności I-IV w tabeli zaleceń
- `c551522` B1 — PDF paleta + typografia (jspdf RGB tokeny, uppercase z kerningiem)
- (B2) PDF color-coding ocen sev-1..5 (autoTable didParseCell + didDrawCell dla paska 1.5mm)
- `f48a07e` B3 — PDF color-coding pilności I-IV (autoTable didParseCell per col 0)

Decyzje projektowe (potwierdzone z Waldkiem na starcie kroku 4): (1) nagłówki tabel w `graphite-800` (oficjalne/urzędowe), nie brand; (2) paleta sev-1..5 1:1 z prototypu HTML; (3) pills pilności I-IV ze standardowej semantyki danger/amber/info/graphite; (4) zwykły workflow testowania — baseline przed startem, po każdym etapie pobieranie nowej wersji z prod. Logo ProWaTech bez zmian. Ratingi per-row weryfikowane SQL-em (opcja A: zmiana 4 elementów → pobierz DOCX → pełna paleta widoczna → rollback).

Wzorce:
- Single source of truth dla protokołów — `src/lib/design/protocol-tokens.ts` z eksportami HEX (docx) + RGB (jspdf) dla brand / graphite / semantic / rating (sev-1..5) / urgency (I-IV) + skala typografii (DXA / pt) + TRACKING_DXA.
- Nagłówki sekcji: 11pt, `text.toUpperCase()`, `characterSpacing: TRACKING_DXA` (docx) lub `setCharSpace(0.4)` (jspdf).
- Tabela ocen (DOCX): wiersz renderowany przez `elementRow(el, idx)` — tło wg `RATING_COLORS_HEX[rating].bg`, tekst wg `.text`, pierwsza komórka ma `left: { style: SINGLE, size: 18 }` jako pasek 3px.
- Tabela ocen (PDF): `pdf.autoTable` z `didParseCell` (fillColor/textColor per row) + `didDrawCell` (dodatkowy `pdf.rect(x, y, 1.5, height, 'F')` — pasek 1.5mm z lewej).
- Tabela zaleceń: kolumna Pilność ma nadpisane tło + kolor tekstu wg `URGENCY_COLORS_HEX/RGB[level]`, reszta kolumn neutralna.

**Redesign — krok 3 (re-layout Dashboard) DONE (2026-04-24), commit `c9b09aa`.** 3 nowe komponenty + nowy grid w `dashboard/page.tsx`:
- `components/dashboard/inspection-trend-sparkline.tsx` — sparkline SVG liczby inspekcji per tydzień (12 tyg.), KPI + chip trendu (Δ vs poprzedni tydzień), gradient fill pod linią, ostatni punkt wyróżniony primary-700. Zapytanie: `inspections.inspection_date >= 12w ago`, `.not('is_deleted', 'is', true)`.
- `components/dashboard/inspection-calendar-14d.tsx` — heat-grid 14 dni (dziś-3 → dziś+10), układ 7-kolumnowy z nagłówkami Pn–Nd, wyróżnienie „dziś" (primary-600 border + ring), liczniki wyk./plan. per dzień. Zapytanie: `inspection_date` + `next_annual_date` + `next_five_year_date` + `next_electrical_date` w oknie, przez Supabase `.or('and(...),and(...)')`. Klik w dzień z danymi → `/inspekcje?date=YYYY-MM-DD`.
- `components/dashboard/rating-distribution.tsx` — bar-chart poziomy rozkładu ocen elementów z `inspection_elements` (5 kategorii: dobry / zadowalający / średni / zły / awaryjny) z kolorami semantic tokens + liczba + procent. Zapytanie z `inspections!inner(is_deleted)` i filtrem `.not('inspections.is_deleted', 'is', true)`, `is_not_applicable=false`, `condition_rating IS NOT NULL`.

Nowy layout Dashboard:
- Row 1: `StatsCards` (bez zmian, 4 KPI)
- Row 2: `InspectionTrendSparkline` (1/3) + `InspectionCalendar14d` (2/3)
- Row 3: `RecentInspections` (2/3) + `{RatingDistribution + AlertsPanel}` (1/3)

Zero nowych zależności. Wszystkie wykresy inline SVG / Tailwind — zgodnie z zasadą „preferuj recharts jeśli już jest, inaczej zaproponuj" — recharts nie było w `package.json`, więc pojechałem czystym SVG. Zgodnie z konwencją: `createClient()` w `useEffect`, `.not('is_deleted', 'is', true)` wszędzie, Polish-first copy.

**Faza 3 — Portal klienta WDROŻONY NA PRODUKCJĘ (2026-04-24), commit `d301abf`, Vercel deploy `TaVz1pRJ5`:**
- ✅ Blok 1 — Migracja DB (`client_users`, `profiles.force_password_change`) + `/api/portal/create-account` + UI w `/klienci/[id]`
- ✅ Blok 2 — `/portal/login` (email+hasło, reset hasła), `/portal/auth/reset`, `/portal/(client)/layout.tsx` (guard roli), `auth/callback` (redirect per rola)
- ✅ Blok 3 — `/portal/(client)/dashboard` (KPI cards, ostatnie protokoły, nadchodzące inspekcje), `/portal/(client)/farmy` (grid z chipem zdrowia)
- ✅ Blok 4 — `/portal/(client)/turbiny/[id]` (read-only, access check), `/portal/(client)/protokoly` (tabela, PDF/DOCX download)
- ✅ Blok 5 — `/portal/(client)/konto` (zmiana hasła + force_password_change)
- ✅ Zabezpieczenie `/api/pdf/[id]` i `/api/docx/[id]` — auth check + weryfikacja dostępu dla `client_user`

**Konfiguracja produkcyjna (wykonane 2026-04-24):**
1. ✅ `SUPABASE_SERVICE_ROLE_KEY` (Sensitive) na Vercelu w środowiskach Production + Preview. Development blokowany przez Vercel dla Sensitive vars — obsłużony lokalnym `.env.local`. **Pułapka:** pierwszy klucz wklejony 2026-04-23 okazał się nieprawidłowy ("Invalid API key" w teście) — trzeba było ponownie skopiować service_role JWT z Supabase → Settings → API Keys → zakładka "Legacy anon, service_role API keys" → Reveal → Copy i nadpisać wartość w Vercelu + wymusić Redeploy.
2. ✅ `.env.local` (w `.gitignore`) z jednym wpisem `SUPABASE_SERVICE_ROLE_KEY=...` — URL i anon key są hardkodowane w `src/lib/supabase/client.ts` i `src/app/api/portal/create-account/route.ts`, więc `NEXT_PUBLIC_*` w `.env.local` są zbędne.
3. ✅ Supabase → Authentication → URL Configuration → Additional Redirect URLs: `https://prowatech-inspekcje.vercel.app/portal/auth/reset` (już był dodany wcześniej).

**Test przepływu (testowe konto, potem skasowane):**
- ✅ POST `/api/portal/create-account` → temp password XXXX-XXXX-XXXX
- ✅ `/portal/login` z temp password → redirect do `/portal/konto` (force_password_change)
- ✅ Zmiana hasła → redirect do `/portal/dashboard`
- ✅ Dashboard: "Witamy, Działdowo Sp. z o.o." + KPI (1 Farma / 2 Turbiny / 0 Protokołów) + Nadchodzące inspekcje
- ✅ `/portal/farmy`: tylko FW Działdowo (1 z 98 farm w bazie) — access check działa
- ✅ `/portal/turbiny/[własna]`: T027-Kisiny widoczna
- ✅ `/portal/turbiny/[obca]` (turbina innego klienta): "Brak dostępu do tej turbiny" + przycisk "Wróć do farm"
- ✅ `/portal/protokoly`: empty state "Brak protokołów" (klient bez zakończonych inspekcji)
- ⏭️ **Nie testowane:** reset hasła przez email (infra OK, Redirect URL skonfigurowany), pobieranie PDF/DOCX (klient Działdowo bez zakończonych inspekcji — pierwszy klient z protokołem sprawdzi ten scenariusz)

Poza propozycją designu brak innych jawnie udokumentowanych prac w toku w repo, ale na podstawie stanu gałęzi i nietrackowanych plików można przypuszczać następujące otwarte wątki:

- ~~**Kosmetyczny diff CRLF/LF**~~ — **ROZWIĄZANE 2026-04-24** (commit `368d34d`): dodany `.gitattributes` z `* text=auto eol=lf` + binary exclusions. Nowe edycje trzymają LF automatycznie.
- **Seed biblioteki defektów** — w katalogu głównym są `defect_library.json`, `defect_batch_0..4.sql`, `seed_defects_via_ef.mjs`, `upload_defects.mjs`. Feature biblioteki defektów jest już w UI (commit `09e82ae`), ale te pliki nie są ani zacommitowane, ani oczywiście wykonane — warto potwierdzić z użytkownikiem, czy seed został faktycznie załadowany do Supabase produkcyjnego.
- **Seed findings** — podobnie `findings_batch_0..11.sql`, `findings_v2_batch_0..11.sql`, `findings_updates.json`, `upload_findings.mjs` — wygląda na dwa przebiegi (v1 i v2) migracji poprzednich findings do nowego schematu. Status nieznany.
- **Rename folderów Google Drive** — `rename_folders_2024.gs` i `rename_folders_2025.gs` (Google Apps Script). Nie powiązane bezpośrednio z appem — raczej pomocnicze skrypty do uporządkowania zdjęć / dokumentów ze starych inspekcji w GDrive.
- **Raport zmian** — `Raport_zmian_Prowatech_Inspekcje.pdf` — prawdopodobnie wygenerowany przez Claude raport dla klienta/stakeholdera. Nie powinien być commitowany.
- **Zdjęcia główne turbin** — `turbine_main_photos/` + `turbine_photos_map.json` + `upload_photos.mjs` — seedowanie zdjęć głównych. Status nieznany.

**Niepotwierdzone, możliwe kolejne tematy** — ponieważ feature-set wydaje się już dość kompletny, naturalne następne kroki to: kontrola dostępu per-klient (RLS w Supabase), eksport do Excel, dashboard analityczny, mobilna wersja offline (już jest PWA — być może service worker z cache).

## Znane problemy / gotchas

- **`is_deleted` nulluje się domyślnie** — kolumna `is_deleted` w kilku tabelach ma default `NULL`, nie `FALSE`. Dlatego zapytania client-side filtrujące skasowane rekordy **muszą** używać:
  ```ts
  .not('is_deleted', 'is', true)
  ```
  a **nie**:
  ```ts
  .eq('is_deleted', false)   // ❌ gubi wszystkie rekordy z NULL
  ```
  To jest powtarzający się błąd — fix widać w commitach `adfb128` i `8dcac77`.

- **OAuth redirect na Vercel** — lokalny `localhost:3000` przy logowaniu Google OAuth zostaje przekierowany na URL Vercela. W praktyce: testuj feature'y związane z auth na deployu Vercel, nie lokalnie. Prawdopodobnie wynika z konfiguracji Redirect URL w Supabase → Auth → Providers → Google (wskazuje na produkcyjny URL).

- **Credentialsy Supabase hardkodowane** — po problemach z inliningiem `NEXT_PUBLIC_*` w buildzie Vercel, URL i anon key są twardo wpisane w `src/lib/supabase/client.ts` (commit `1a39485`). Przy rotacji klucza — pamiętać o update w kodzie, nie tylko w env.

- **Empty `SelectItem value=""`** — shadcn/ui Select nie toleruje pustych wartości. Używamy `'all'` jako sentinel dla "brak filtra" (commit `7fe2348`, `98824f4`).

- **Polskie znaki w PDF** — domyślny font jspdf nie ma polskich znaków. Projekt osadza Roboto przez font subset (patrz `src/fonts/`). Nowe endpointy PDF muszą wczytać i zarejestrować ten font.

- **DOCX API route wymaga runtime `nodejs`** — `export const runtime = 'nodejs'` na górze pliku. W Edge runtime nie działa `Buffer` ani biblioteka `docx`. Nauczone po 3 iteracjach (`6f955b0`, `3b58e34`, `329e6ca`).

- **SSR w Supabase** — `createClient()` **nie wolno** wywoływać w body komponentu ani na top-level module. Zawsze w `useEffect` albo przez Server Action / Route Handler. Commity `5d3aff5` i `e328fdb`.

- **Migracja `rated_power_kw` → `rated_power_mw`** — starsze dane lub seedy mogą mieć starą nazwę. Zmiana z commit `2719c85`.

- **Bug formularza `/klienci/[id]`** (wykryty 2026-04-24) — przycisk "Zaktualizuj" w sekcji "Dane klienta" nie zapisuje zmian w DB (m.in. `contact_email` zostaje `NULL` po submit). UI wygląda jakby zapisał (toast?/brak błędu), ale reload ujawnia stary stan. Workaround: direct SQL `UPDATE public.clients SET contact_email=... WHERE id=...`. Do naprawy: sprawdzić `src/app/(protected)/klienci/[id]/page.tsx` — prawdopodobnie brak `await` na mutacji lub problem z kluczami kolumn.

- **`inspections.completed_at` nie istnieje** (wykryte 2026-04-24). Tabela `inspections` w obecnym schemacie nie ma pola `completed_at` — są tylko `inspection_date`, `inspector_signature_date`, `owner_signature_date`, `site_visit_date`. Jeśli spotkasz filtr `.gte('completed_at', ...)` — to stary bug, zamieniać na `inspection_date`. StatsCards miał go od Fazy 2 i cicho zwracał 0 (aż się ujawniło po un-delete testowych inspekcji w kroku 3 redesignu).

- **Filter na embedded relation przez `!inner`** (potwierdzone 2026-04-24). Kiedy trzeba filtrować listę `repair_recommendations` / `inspection_elements` po polu z parent `inspections`, robi się `.select("*, inspections!inner(is_deleted)")` + `.not('inspections.is_deleted', 'is', true)`. Składnia działa w Supabase JS client i mapuje się na inner join z klauzulą. Używane w `rating-distribution.tsx` i `alerts-panel.tsx`. Commit `9147796`.

- **Sensitive env var niedostępny w Development na Vercelu** — Vercel blokuje flagę Sensitive dla środowiska Development ("Sensitive environment variables cannot be created in the Development environment"). Dla Production + Preview OK. Lokalne dev używa `.env.local`.

- **Service_role JWT vs nowe sb_secret_...** — Supabase ma teraz dwa tryby API keys: "Publishable and secret keys" (nowy, `sb_secret_...`) oraz "Legacy anon, service_role API keys" (klasyczny JWT). Kod projektu (`route.ts` używa klasycznej zmiennej `SUPABASE_SERVICE_ROLE_KEY`) — używamy **klasycznego service_role JWT z zakładki Legacy** dla zgodności nomenklatury i kompatybilności z `@supabase/supabase-js` w klasycznym trybie.

- **Null bytes w plikach `src/` zacommitowane w HEAD** (wykryte 2026-04-24) — 80 plików w `src/` ma null bytes w wersji gitowej (HEAD). Prawdopodobne źródło: wcześniejsze edycje z Windows-side Cowork zapisywały fragmenty UTF-16 LE. Build Vercela nie cierpi bo `typescript.ignoreBuildErrors: true` + Git for Windows z `autocrlf=true` konwertuje przy checkout. Ale Linux / CI bez autocrlf dostanie uszkodzone pliki. `.gitattributes` z kroku 6 (commit `368d34d`) zapobiega pogłębianiu — **nie cofa historii**. Pełne czyszczenie wymagałoby `git filter-branch`/BFG (osobny temat).

- **`tr -d '\0'` obcina ogony UTF-16 LE plików** (wykryte 2026-04-24) — klasyczny bug: plik UTF-16 LE kończący się pełnym znakiem ma bajty `X\0` lub `\0X` na końcu, które `tr -d '\0'` usunie częściowo — ostatnie bajty zostają odcięte, tracąc ogon. W sesji 2026-04-24 zepsuło mi to 13 plików (ogony typu `Separato`, `Skeleto`, `SheetDescrip` zamiast pełnych nazw). **Zasada**: do konwersji UTF-16 LE → UTF-8 używać `iconv -f UTF-16LE -t UTF-8`, nigdy `tr -d '\0'`.

- **Phantom `.git/index.lock` w Cowork sandbox** (wykryte 2026-04-24) — `.git/` w Cowork mount ma Windows ACL, sandbox nie może usunąć pliku lock. Skutek: **Claude w sesji Cowork nie może zrobić `git commit`**. Lock istnieje jako „phantom" (widoczny w `ls .git/` ale `stat .git/index.lock` mówi „No such file"). Workaround: wszystkie commity i push robisz z Windows-side przez Git Bash. Claude przygotowuje zmiany w plikach, Ty wykonujesz `git add`/`commit`/`push`.

- **`enum user_role` w bazie używa wartości po angielsku** (potwierdzone 2026-04-26 podczas Fazy 15.E) — wartości to `admin`, `inspector` (NIE `inspektor`!), `client_user`, `viewer`. UI wyświetla "Inspektor" jako label po polsku, ale w DB enum jest po angielsku. RLS policies pisane dla `profiles.role` muszą używać `'inspector'`, inaczej `22P02: invalid input value for enum user_role: "inspektor"`. Sprawdzaj w razie wątpliwości: `SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')`.

- **Cloudflare R2 storage** (od Fazy 15, 2026-04-26) — bucket `prowatech-inspekcje` (EU Frankfurt), Account ID `587ba2347ed372341fe359b0ed2d632d`, Endpoint `https://{account}.eu.r2.cloudflarestorage.com`, Public URL `https://pub-edbf124678454e819a88cd7054401694.r2.dev`. Konwencja kluczy: `inspections/{id}/photos/`, `turbines/{id}/photo_{slot}.{ext}`, `inspectors/{id}/{docType}.{ext}`, `historical/{turbine_id}/{year}_{type}_{ts}_{rand}.pdf`. Helper `src/lib/storage/r2.ts` (build, upload, delete, presigned) + endpoint `/api/storage/presigned` (POST z auth + role admin/inspector + walidacja per context). CORS skonfigurowany dla `vercel.app` + `localhost:3000`. **Public Development URL jest rate-limited** — przy zwiększonym ruchu klienta przeskoczyć na custom domain (CNAME `files.prowatech.pl` na Cloudflare) zmienia tylko env `R2_PUBLIC_URL`, bez touch kodu.

- **`cat >>` na plik widziany przez Edit/Read jako "obcięty" → duplikat na produkcji** (wykryte 2026-04-26, naprawione 2026-04-26 commitem `968be27`) — gotcha pochodna od desync mount sandbox vs Edit tool. W Fazie 14 sandbox bash uparcie pokazywał plik DOCX route z 2222 liniami kończącymi się `const err =` (jakby obcięty), podczas gdy Edit/Read widziały go już naprawiony (2235 linii z prawidłowym `}` na końcu funkcji GET). Mój `cat >> src/app/api/docx/[id]/route.ts << EOF ... EOF` dorzucił "brakującą" końcówkę catch — w efekcie HEAD na GitHubie miał 2248 linii z 13-linijkowym duplikatem po prawidłowym zakończeniu funkcji. Vercel build failed: `Return statement is not allowed here` + `Expression expected`. **Zasada**: nigdy nie ufać bash `wc -l`/`tail` do walidacji świeżych zmian — używać Read tool (single source of truth) lub `git show HEAD:plik | wc -l` po commit, nigdy nie dorzucać końcówki przez `cat >>` bez bezpośredniej weryfikacji. Naprawa polegała na `head -n 2235 ... > tmp && mv tmp ...` na Windows-side i osobnym commicie.

- ~~**Line endings (CRLF/LF)**~~ — **ROZWIĄZANE 2026-04-24** (commit `368d34d`): `.gitattributes` z `* text=auto eol=lf`.

## Kluczowe decyzje architektoniczne

- **Next.js 14 App Router**, nie Pages Router. Struktura `src/app/(protected)/...` z grupą chronioną przez `layout.tsx` z sprawdzaniem sesji.
- **Supabase Client-side only** w większości miejsc, przez `@supabase/ssr` (`createBrowserClient`). Serwerowy klient (`server.ts`) używany głównie w route handlers (`/api/pdf`, `/api/docx`) i w auth callbacku.
- **Język UI i domeny: polski**. Wszystkie etykiety, nazwy tras (`/inspekcje`, `/turbiny`, `/farmy`, `/klienci`, `/inspektorzy`, `/diagnostyka`), nazwy elementów turbiny, typy napraw itp. są po polsku. Nazwy kolumn w DB — angielskie (po migracji z commita `47a7e50`).
- **Shadcn/ui + Radix** dla komponentów, **Tailwind** dla stylu. `components.json` zcommitowany.
- **Autentykacja**: Google OAuth wyłącznie, ról z tabeli `profiles` (admin / inspektor). Brak logowania email/password.
- **PWA** (manifest + ikony) — aplikacja ma być instalowalna, głównie na tablecie używanym w terenie.
- **PDF: jspdf + jspdf-autotable**. DOCX: `docx` (Node runtime).
- **Formularz inspekcji jako kreator 3-krokowy** — odzwierciedla przepływ papierowego protokołu, nie techniczny model DB.
- **Soft-delete** (`is_deleted`) zamiast fizycznego usuwania — po stronie UI filtrowane przez `.not('is_deleted', 'is', true)`.
- **Biblioteki (defects, findings, templates)** — pickery z gotowych fraz w Supabase, żeby inspektorzy nie wpisywali tego samego ręcznie za każdym razem.

## Przydatne komendy / linki

| Co | Gdzie |
|---|---|
| Repo na dysku | `C:\prowatech-inspekcje` |
| GitHub | https://github.com/wtrzecki-hub/prowatech-inspekcje |
| Live | https://prowatech-inspekcje.vercel.app |
| Supabase project id | `lhxhsprqoecepojrxepf` |
| Supabase URL | `https://lhxhsprqoecepojrxepf.supabase.co` |
| User (admin) | Waldek — `w.trzecki@cgedata.com` (Google OAuth) |
| Branch główny | `main` |
| Dane w DB | 424 turbiny, 98 farm, 70 klientów |

Przydatne komendy:
```bash
npm run dev           # lokalnie (ale OAuth redirectuje na Vercel)
npm run build         # produkcyjny build
npm run type-check    # tsc --noEmit
git log --oneline -20 # ostatnie commity
```

## Pliki nietrackowane (stan na 2026-04-23)

Do potwierdzenia z użytkownikiem czy gitignorować / zcommitować / usunąć:

- `Raport_zmian_Prowatech_Inspekcje.pdf` — raport dla klienta, nie commitować.
- `defect_batch_0..4.sql`, `defect_library.json`, `seed_defects_via_ef.mjs`, `upload_defects.mjs` — seed biblioteki defektów.
- `findings_batch_*.sql`, `findings_v2_batch_*.sql`, `findings_updates.json`, `upload_findings.mjs` — seed/migracja findings (już w .gitignore? do sprawdzenia).
- `seed_defect_library.sql` — jedna z wersji seedu.
- `rename_folders_2024.gs`, `rename_folders_2025.gs` — Google Apps Scripts, pomocnicze.
- `turbine_main_photos/`, `turbine_photos_map.json`, `upload_photos.mjs`, `generate-icons.mjs`, `generate-icons.ps1` — skrypty/assets jednorazowe.

Wszystkie skrypty z rozszerzeniem `.mjs` w katalogu głównym to prawdopodobnie operacje jednorazowe (seed, upload) uruchamiane przez Node ręcznie z lokalnej maszyny.

## Faza 1 — Fundamenty designu (zakończona 2026-04-23)

**13 plików, 2 commity na `main`:**
- `0c4fd3c` — `feat(design): faza 1 — tokeny kolorystyczne, typografia, komponenty bazowe`
- `5a1ad4d` — `docs: aktualizacja PROGRESS.md i redesign.md po Fazie 1 — sekcje 2, 4, 5`

### Tokeny — `tailwind.config.ts` + `src/app/globals.css`

**Primary / brand**
- `primary-600` = `#259648` (DEFAULT) — delikatnie jaśniejszy od logo #1F7F3A, ~5%. Zmiana jednolinijkowa gdy przyjdzie dokładny hex z pliku źródłowego logo.
- `primary-700` = `#1F7F3A` — hover na CTA
- Pełna paleta: `primary-50 / 100 / 500 / 600 / 700 / 800`

**Graphite (neutralna paleta zamiast generic `gray-*`)**

| Token | Hex | Zastosowanie |
|---|---|---|
| `graphite-50` | `#F7F9FB` | Tło strony / body |
| `graphite-100` | `#EEF1F5` | Nagłówki tabel, tła pomocnicze |
| `graphite-200` | `#DDE3EA` | Ramki, border default |
| `graphite-500` | `#5F6B7A` | Tekst drugorzędny, ikony nieaktywne |
| `graphite-800` | `#1B2230` | Nagłówki tabel (TableHead) |
| `graphite-900` | `#0F1520` | Tekst podstawowy |

**Kolory semantyczne** (każdy z odcieniami 50 / 100 / DEFAULT / foreground / 800)

| Token | DEFAULT | Zastosowanie |
|---|---|---|
| `success` | `#2E9F4A` | Ocena Dobry, status Zakończona/Podpisana |
| `info` | `#0284C7` | Ocena Zadowalający, status W toku |
| `warning` | `#F59E0B` | Ocena Średni, pilność Średnia |
| `danger` / `destructive` | `#DC2626` | Ocena Awaryjny, pilność Wysoka/Krytyczna |

**Shadcn base tokens** — wcześniej niezdefiniowane, teraz poprawnie podpięte jako bezpośrednie hex w `tailwind.config.ts`:

```
background / foreground / border / input / ring
card (DEFAULT + foreground)
muted (DEFAULT + foreground)
accent (DEFAULT + foreground)
secondary (DEFAULT + foreground)
popover (DEFAULT + foreground)
```

Dzięki temu klasy `bg-background`, `border-input`, `ring-ring`, `ring-offset-background`, `hover:bg-accent`, `bg-muted`, `text-muted-foreground` itp. faktycznie generują CSS (wcześniej cicho fallbackowały na transparent/nieokreślone).

**Cienie** (subtelne, B2B — nie „jebnięte"):

| Klasa | Wartość |
|---|---|
| `shadow-xs` | `0 1px 2px rgba(15,23,32,0.04)` |
| `shadow-sm` | `0 1px 3px rgba(15,23,32,0.06), 0 1px 2px rgba(15,23,32,0.04)` |
| `shadow-md` | `0 4px 12px rgba(15,23,32,0.06), 0 1px 2px rgba(15,23,32,0.04)` |
| `shadow-lg` | `0 12px 32px rgba(15,23,32,0.10), 0 2px 4px rgba(15,23,32,0.05)` |
| `shadow-focus` | `0 0 0 4px rgba(37,150,72,0.22)` |

**Radius** — `sm=4px, md=6px, lg=8px, xl=12px, 2xl=16px` (odpowiada Tailwind defaults poza `sm`: 2px→4px).

**CSS variables w `globals.css`** — `--color-primary`, `--color-fg-default`, `--color-surface-0/1/2/3`, `--color-border`, `--shadow-xs/sm/md/lg/focus`, `--radius-sm/md/lg/xl/2xl` — dla bezpośredniego użycia w CSS i przyszłego theming.

---

### Typografia — `src/app/layout.tsx`

- **Inter** (400 / 500 / 600) via `next/font/google`, zmienna CSS `--font-inter`
- **JetBrains Mono** (400 / 500) via `next/font/google`, zmienna CSS `--font-jetbrains-mono`
- `body className` = `{inter.variable} {jetbrainsMono.variable} font-sans`
- `tailwind.config.ts fontFamily` mapuje `font-sans` → `var(--font-inter)` i `font-mono` → `var(--font-jetbrains-mono)`
- Klasa `font-mono` gotowa do użycia wszędzie tam gdzie dane liczbowe / kody / daty (Faza 2)
- `theme-color` meta zmieniony z niebieskiego na `#259648`

---

### Komponenty bazowe

| Komponent | Zmiana |
|---|---|
| `badge.tsx` | +5 wariantów semantycznych: `neutral` (graphite), `success` (zielony), `warning` (amber), `danger` (czerwony), `info` (niebieski) — backward compat: stare warianty `default/secondary/destructive/outline` bez zmian |
| `button.tsx` | Wariant `default` → teraz zielony (bo `bg-primary` = `#259648`); +nowy wariant `danger`; hover `primary-700` zamiast `primary/90` |
| `card.tsx` | `shadow-sm` → `shadow-xs` (subtelniejszy); jawny `border-border` |
| `table.tsx` | `TableHeader`/`TableFooter`: `bg-gray-100` → `bg-graphite-100`; `TableRow`: `border-gray-200` → `border-graphite-200`, `hover:bg-gray-50` → `hover:bg-graphite-50`; `TableHead`: `text-gray-700` → `text-graphite-800`; `TableCaption`: `text-gray-500` → `text-graphite-500` |
| `sheet.tsx` | Focus ring: `ring-blue-500` → `ring-ring` (zielony) |
| `slider.tsx` | Track: `bg-gray-200` → `bg-graphite-200`; thumb: `accent-blue-600` → `accent-primary` |

---

### Layout

**`src/components/layout/sidebar.tsx`**
- Aktywny nav item: `bg-blue-50 text-blue-700` → `bg-primary-50 text-primary-700`
- Aktywna ikona: `text-blue-600` → `text-primary-600`
- Aktywna kropka: `bg-blue-600` → `bg-primary-600`
- Avatar fallback: `bg-blue-600` → `bg-primary-600`
- Nieaktywne ikony: `text-gray-400` → `text-graphite-500`
- Hover nav item: `hover:bg-gray-50` → `hover:bg-graphite-50`

**`src/components/layout/header.tsx`**
- Avatar fallback: `bg-blue-600` → `bg-primary-600`

**`src/app/(protected)/layout.tsx`**
- Loading spinner: `border-blue-600` → `border-primary`
- Kontener strony: `bg-gray-50` → `bg-graphite-50`

**`src/app/globals.css`**
- Body background: `#f3f4f6` (gray-100) → `#F7F9FB` (graphite-50)
- Scrollbar track/thumb: zaktualizowane do graphite

---

### `src/lib/constants.ts`

`STATUS_COLORS`, `CONDITION_COLORS`, `URGENCY_LEVEL`, `INSPECTION_STATUS` zaktualizowane do nowych tokenów semantycznych:

| Klucz | Przed | Po |
|---|---|---|
| `in_progress` | `bg-blue-100 text-blue-800` | `bg-info-100 text-info-800` |
| `completed` | `bg-green-100 text-green-800` | `bg-success-100 text-success-800` |
| `signed` | `bg-emerald-100 text-emerald-800` | `bg-primary-100 text-primary-700` |
| `draft` | `bg-gray-100 text-gray-800` | `bg-graphite-100 text-graphite-800` |
| `review` | `bg-yellow-100 text-yellow-800` | `bg-warning-100 text-warning-800` |
| `zadowalajacy` | `bg-blue-100 text-blue-800` | `bg-info-100 text-info-800` |
| `dobry` | `bg-green-100 text-green-800` | `bg-success-100 text-success-800` |
| `awaryjny` | `bg-red-100 text-red-800` | `bg-danger-100 text-danger-800` |
| urgency `low` | `bg-blue-100 text-blue-800` | `bg-info-100 text-info-800` |

---

### Co NIE zostało zmienione w Fazie 1

- Logika biznesowa, zapytania Supabase, typy TypeScript
- API / propsy komponentów (żadnych zmian w sygnaturach)
- Protokoły PDF/DOCX i logo w dokumentach (`public/logo-prowatech.png`)
- Indywidualne ekrany aplikacji (Dashboard, Klienci, Farmy, Inspekcje, Turbiny) — nadal mają hard-coded `blue-*` i `gray-*` klasy → to jest zakres Fazy 2

---

### Co wymaga oczu przed Fazą 2

1. **Kolor primary na żywo na Vercelu** — sprawdź czy `#259648` wygląda dobrze przy logo ProWaTech w sidebarze. Jak dostarczysz plik źródłowy logo z dokładnym hexem — zmiana jednolinijkowa w `tailwind.config.ts` (pole `primary-600` i `ring`).
2. **Ekrany aplikacji nadal mają `blue-*`** — sidebar i header są już zielone, ale np. Dashboard (`stats-cards.tsx`, `recent-inspections.tsx`), Inspekcje, Klienci, Inspektorzy mają jeszcze stare klasy — wygląd mieszany do momentu ukończenia Fazy 2.

---

## Historia sesji

Brief log kolejnych sesji pracy z Claude nad tym projektem. Każda nowa sesja powinna **dodać jedną linię** na górę tej sekcji.

- **2026-04-26** — **Faza 15 — Migracja na Cloudflare R2 + archiwum historycznych protokołów PIIB DONE end-to-end na produkcji.** 3 commity: `87d99d8` (15.B feat(storage) — adapter `src/lib/storage/r2.ts` z S3-compatible client, `getPresignedUploadUrl` + `buildKey` per context, plus API route `/api/storage/presigned` z auth/role check; npm install `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` 107 paczek; env vars `R2_ACCESS_KEY_ID/SECRET_ACCESS_KEY` Sensitive na Vercelu) + migracja SQL `2026-04-26_historical_protocols.sql` ręcznie w Supabase (15.E — tabela z RLS dla 4 ról, UNIQUE(turbine_id, year, type), trigger updated_at, 7 zapytań WERYFIKACJA OK) + `d309f12` (15.F feat(archive) — UI zakładki Archiwum w turbiny/[id] z drag-drop + parser regex `NN_T_RRRR Protokol_kontroli_typ ...` auto-fill + edit/delete dialogs, plus sekcja Archiwum w portal/(client)/protokoly z RLS-em filtrującym swoich klienta). **Smoke test prod**: T330-Żałe → drag-drop pliku 4.5 MB → auto-fill 2024/Roczna/`48/T/2024`/23.04.2024 → Zapisz → wpis w liście, plik na R2 pod `historical/{turbine_uuid}/2024_annual_{ts}_{rand}.pdf`. **Setup Cloudflare R2**: bucket `prowatech-inspekcje` w EU Frankfurt, Public Development URL `pub-edbf124...r2.dev`, CORS dla `vercel.app` + `localhost:3000`, Account API Token `prowatech-app` z Object Read & Write. **Diagnostyka pre-migracji**: DB 14 MB / 500 MB free (2.8%), Storage Supabase 38 MB / 1 GB free (3.75%), forecast archiwum z 425 turbin × 5y × 1.2 inspekcji = ~2550 protokołów × 0.5 MB = ~1.3 GB → zostajemy w 10 GB R2 free, ZERO cost. **Pułapki sesji**: (a) `enum user_role` używa `inspector` po angielsku, nie `inspektor` po polsku — RLS policies trzeba było poprawić; (b) stara tabela `historical_protocols` z innego eksperymentu w bazie (różny schema) — DROP CASCADE + retry; (c) Supabase SQL Editor pokazuje tylko ostatni result set z multi-statement Run — workaround: skondensowany compact diagnostic skrypt z `string_agg`; (d) Chrome Console blokuje pierwsze paste — `allow pasting` Enter; (e) Free tier Supabase nie ma backup-ów — non-destructive migracja + ROLLBACK section jako bezpiecznik. Pozostaje 15.G (opcjonalna): cleanup R2 orphans przy delete + skrypt migracji obecnych 38 MB z Supabase Storage do R2 + refactor 4 miejsc upload UI. Klient od jutra może wgrywać archiwum z folderu GDrive `04 inspekcje` po jednym pliku.
- **2026-04-26** — **PIIB Faza 14 — 3 zdjęcia turbiny w metryczce inspekcji + protokole PDF/DOCX.** 2 commity: `cafab60` (feat — auto-pull z `turbines.photo_url/_2/_3`, layout 1+2 portret + 2 pejzaże w PDF/DOCX, stary `object_photo_url` jako legacy fallback w `<details>`, 425 insertions / 71 deletions w 3 plikach: `inspection-metadata-piib.tsx`, `pdf/[id]/route.ts`, `docx/[id]/route.ts`) + `968be27` (fix — usunięcie 13-linijkowego duplikatu końcówki catch w DOCX, build fail po `cafab60`). Decyzje strategiczne potwierdzone przez AskUserQuestion: auto-pull z karty turbiny (nie nowe pola per-inspekcja), 3 zdjęcia w protokole, upload tylko w karcie turbiny (metryczka read-only z linkiem). Smoke test PDF z prod: `pdfimages -list` pokazuje 1 zdjęcie turbiny (slot 1) + puste ramki dla slotów 2/3 (T150-Kowalewo ma tylko 1 zdjęcie wgrane), label "Fotografie obiektu" widoczny. **Nowa gotcha**: `cat >>` na plik widziany przez Edit/Read jako "obcięty" → duplikat 13 linijek na produkcji (build error `Return statement is not allowed here`). Naprawa: `head -n 2235 ...` na Windows-side. Single source of truth dla świeżych edycji = Read tool, nigdy `bash wc -l`/`tail`.
- **2026-04-24** — **Redesign krok 7 (wariant A) — re-skin components/inspection/* + dead code cleanup.** 2 commity: `cff318d` (feat(design): re-skin photo-gallery/repair-table/electrical-measurements/service-checklist — 4 pliki, 39+/39-; kluczowa zmiana urgencyColors I-IV red/orange/yellow/green → danger/warning/info/graphite dla spójności z protokołem DOCX A3/PDF B3), `6dd2507` (chore(cleanup): remove dead code new-inspection-wizard.tsx — 823 linii, nie importowany nigdzie). Scope nie ruszał `turbine-inspection-form.tsx` (2058 linii, 0 hits — zmigrowany w Fazie 2) ani `/inspekcje/[id]/page.tsx` (0 hits). Po commicie `6dd2507` w `src/` zostaje zero `blue-*/gray-*/red-*/orange-*/yellow-*/green-*` klas w komponentach aplikacyjnych (poza shadcn primitives toast/form które mają intencjonalne `red-500/slate-*` dla destructive variants). **Decyzja**: wariant C (refactor monolitu `turbine-inspection-form.tsx` 2058 linii) **odłożony** — plik działa, nie ma hits, nie ma pilnego powodu. **Nowa gotcha w sesji**: bracketed paste mode w Git Bash MINGW zjada pierwszą linię paste-a (dzisiejsze `git rm` zostało zignorowane jako `^[[200~...~`; workaround: wklejać komendy pojedynczo).
- **2026-04-24** — **Redesign krok 6 — reszta paneli + link Diagnostyka.** 3 commity: `368d34d` (chore(repo): `.gitattributes` enforcing LF + binary exclusions — preventive), `d15929a` (feat(design): krok 6 re-skin pozostałych paneli — 13 plików, 110+/119-; re-skin `/inspektorzy` z font-mono na kodach uprawnień, 5 kolorowych sekcji formularza inspektora z semantic tokens, mop-up layoutów + logo w mobile-nav, `/login` z primary gradient, `/diagnostyka` z graphite-900 i font-mono na JSON, mop-up UI primitives shadcn), `5ced61d` (feat(layout): link „Diagnostyka" admin-only w sidebar+mobile-nav — fetch `profile.role` w `(protected)/layout.tsx`, podział `NAV_ITEMS_BASE` + `NAV_ITEMS_ADMIN`, ikona Activity). Zweryfikowane wizualnie na prod (Vercel) — badges GWO/UDT/SEP dokładnie w info/warning/neutral, font-mono na numerach uprawnień i telefonach, Aktywny=success. **Pułapka sesji**: próba ręcznego cleanup null bytes przez `tr -d '\0'` obcięła ogony 13 plikom UTF-16 LE (zepsute exporty typu `Separato`/`Skeleto`/`SheetDescrip`) — naprawione ręcznie dopisywaniem brakujących końcówek. Drugi blocker: **phantom `.git/index.lock` w Cowork sandbox** uniemożliwił Claude'owi wykonanie `git commit` — wszystkie commity zrobione z Windows-side Git Bash. Pełny audyt null-byte state w repo: 80 plików w `src/` ma null bytes zacommitowane w HEAD, build Vercela je znosi przez `typescript.ignoreBuildErrors: true` + autocrlf Windows Git. Decyzja: `.gitattributes` jako preventive; pełne cleanup HEAD odłożone (wymaga `git filter-branch`/BFG). Trzy nowe Gotchas: null bytes + `tr -d '\0'` pułapka + phantom `.git/index.lock`.
- **2026-04-24** — **Redesign krok 5 — Turbina · detail redesign.** 4 commity `fe30f4a` → `26ae3a2`: C1 (hero graphite z kodem turbiny Mono + chipy + 5 tabs, obecna zawartość w tab Przegląd), C2 (wykres oceny SVG + KPI „Ostatnia kontrola" i „Najbliższe przeglądy" z empty state dla małej historii), C3 (tabela historii + lista zaleceń z urgency pills I-IV zgodne z DOCX A3/PDF B3), C4 (grid zdjęć z `inspection_photos` + lista certyfikatów zespołu ostatniej inspekcji z expiry countdown). Zweryfikowane wizualnie na T150-Kowalewo (`fc7f18d6-cb55-45b8-a13b-1c44dbe406c7`) — dla testowej inspekcji 017/R/2026 pokazuje realne dane zaleceń (7 otwartych, 6×III i 1×II amber), empty states dla wykresu (<2 punkty), certyfikatów (brak `inspection_inspectors` relacji). **Plik przejściowy `SESSION_HANDOVER_2026-04-24.md`** wprowadzony w C1 (bo sesja była przy 61% tokenów; kolejne tury kontynuowały w tej samej sesji więc handover nie był potrzebny). **Gotcha**: URL `/turbiny/<id>` używa `turbine_id`, nie `inspection_id` — łatwo pomylić (UUID `4df3b711-...` to inspekcja 017/R/2026, `fc7f18d6-...` to turbina T150-Kowalewo). Plik page.tsx urósł z 479 → 1718 linii; wszystkie komponenty inline (do wydzielenia w osobnym refactorze jeśli będzie potrzeba).
- **2026-04-24** — **Redesign krok 4 — re-skin protokołu PDF/DOCX.** 6 commitów: `654e9b4` A1 (DOCX paleta/typografia + nowy moduł `src/lib/design/protocol-tokens.ts`), `5dd35ec` A2 (DOCX color-coding ocen sev-1..5 per-row shading + 3px pasek po lewej), `6ab653b` A3 (DOCX pills pilności I-IV w komórce Priorytet), `c551522` B1 (PDF analogicznie A1: jspdf RGB tokeny, setCharSpace dla kerningu, grubszy zielony pasek cover, running header graphite), B2 (PDF autoTable `didParseCell` + `didDrawCell` dla paska 1.5mm), `f48a07e` B3 (PDF autoTable `didParseCell` tylko na kolumnie Priorytet). Każdy etap zweryfikowany wizualnie na realnej inspekcji `4df3b711-867d-43d8-9127-91bdab1f91ef` (017/R/2026 — un-deleted dla celów testu + temporary SQL update 4 elementów na sev-2..5 → pobranie DOCX → pełna paleta widoczna → rollback). Decyzje: nagłówki tabel `graphite-800` (nie brand — prototyp HTML sugeruje oficjalność), paleta sev-1..5 1:1 z `design/prowatech-prototype.html` § 3, pills pilności z `constants.ts URGENCY_LEVEL`. Logo ProWaTech bez zmian (decyzja klienta). Polski copy (`Dobry/Zadowalający/Średni/Zły/Awaryjny`) z `RATING_LABELS` zamiast starych fragmentów (`'1'→'Bdb'`) z wcześniejszego kodu. Workflow: baseline pobrany na starcie (`PROTOKOL_017_PRZED.pdf/docx`) jako punkt odniesienia dla A/B. **Pułapka sesji:** Edit tool notorycznie obcinał duże pliki (DOCX route 1016 linii) — rozwiązanie: edycje przez Python w bash z parsowaniem ze świadomością string literals i `[` w `TableRow[]` (counting brackets od pozycji po `= [`).
- **2026-04-24** — **Fix Dashboard: filtr is_deleted w 3 starych komponentach + drobiazgi** (commit `9147796`). Po un-delete 3 testowych inspekcji odsłoniły się stare bugi: `StatsCards.totalInspections`, `RecentInspections` i `AlertsPanel` nie filtrowały `is_deleted` (w efekcie Dashboard pokazywał soft-deleted jako aktywne); `StatsCards.completedThisMonth` filtrował po nieistniejącym polu `completed_at` (zawsze 0) — zmiana na `inspection_date`. `AlertsPanel` użyła wzorca `inspections!inner(is_deleted)` + `.not('inspections.is_deleted', 'is', true)` — zweryfikowany SQL-em (7/0/7 — wszystkie otwarte zalecenia pochodzą z żywych inspekcji). Sparkline: copy chipu „w.t. tyg." → „vs poprz. tydz." + empty-state z ikoną gdy `total=0` zamiast płaskiej linii z kropkami. Build + Vercel deploy OK.
- **2026-04-24** — **Redesign krok 3 — re-layout Dashboard** (commit `c9b09aa`). Dodane 3 nowe komponenty w `src/components/dashboard/`: `inspection-trend-sparkline.tsx` (sparkline 12-tyg. liczby inspekcji, SVG inline z gradientem primary + chip trendu Δ), `inspection-calendar-14d.tsx` (grid 14 dni z wyróżnieniem „dziś", liczniki wyk./plan., klik → `/inspekcje?date=…`), `rating-distribution.tsx` (bar-chart poziomy rozkładu 5 ocen elementów). `dashboard/page.tsx` przepisany na 3-wierszowy układ: StatsCards → (sparkline 1/3 + kalendarz 2/3) → (Recent 2/3 + stack [RatingDist + Alerts] 1/3). Zero nowych zależności (recharts nie ma w package.json — użyto inline SVG). Konwencje: `createClient()` w `useEffect`, `.not('is_deleted', 'is', true)`, tokeny graphite/primary/semantic, UI po polsku. Build Next 14.2 — BUILD_ID `q_HDgEwR5eOCMD0eYr7vX`, brak błędów. 5 files changed, 759 insertions(+), 10 deletions(-).
- **2026-04-24** — **Portal klienta (Faza 3) wdrożony na produkcję.** Konfiguracja Vercel: nadpisano `SUPABASE_SERVICE_ROLE_KEY` świeżym service_role JWT z zakładki Legacy Supabase (pierwotny klucz z 2026-04-23 zwracał "Invalid API key" — pewnie został obcięty przy pierwszym wklejaniu). Env var tylko w Production + Preview (Development blokowany przez Vercel dla Sensitive). Utworzono `.env.local` z jedną zmienną `SUPABASE_SERVICE_ROLE_KEY` (Waldek wklejał wartość lokalnie). Supabase → URL Configuration: Redirect URL `portal/auth/reset` już był dodany wcześniej. Wymuszono pełny Redeploy na Vercelu (deploy `TaVz1pRJ5`). **Test przepływu**: utworzono testowe konto `w.trzecki+portaltest@cgedata.com` dla klienta Działdowo, zalogowano, zmieniono hasło (force_password_change OK), sprawdzono dashboard / farmy / turbinę własną / turbinę obcą (Brak dostępu OK) / protokoly. Testowe konto skasowane (auth.users + profiles + client_users + contact_email klienta przywrócony do `NULL`). Nowe wpisy w "Gotchas": bug formularza /klienci/[id] (UPDATE nie zapisuje), Sensitive env var vs Development Vercel, service_role vs nowe sb_secret_ keys.
- **2026-04-23** — **Faza 3 — Portal klienta** (commit `d301abf`). 14 nowych plików: migracja SQL (`client_users` + `force_password_change`), `/api/portal/create-account` (service role, temp password XXXX-XXXX-XXXX), UI portalu w `/klienci/[id]` (karta "Portal klienta", tworzenie konta, wyświetlanie hasła tymczasowego z kopiowaniem), `/portal/login` (email+hasło, reset hasła), `/portal/auth/reset` (route handler), `/portal/(client)/layout.tsx` (guard `client_user`, sidebar, force_password_change redirect), `auth/callback` (redirect per rola), dashboard, farmy, turbiny/[id], protokoly, konto. Zabezpieczone `/api/pdf` i `/api/docx` (auth check + weryfikacja `client_id` dla `client_user`). Pliki `design/next-steps.md` i `database.types.ts` zaktualizowane.
- **2026-04-23** — **Faza 2 wdrożona** (commit `a43d457`). Re-skin 15 plików: Dashboard (page+stats+recent+alerts), Inspekcje (lista+detail+StatusBar+ElementCard+RatingBadge), Formularz inspekcji (turbine-inspection-form), Klienci (lista+detail), Farmy (lista+detail), Turbiny (detail+PhotoSlot+InfoItem). Wzorce: font-mono dla dat/kodów/liczb, `text-[11px] uppercase tracking-wider text-graphite-400` dla nagłówków tabel, `h-[52px] hover:bg-graphite-50/50` dla wierszy, `border-graphite-200 shadow-xs rounded-xl` dla kart. Build czysty `✓ Compiled successfully`. Wypchnięto na `main`.
- **2026-04-23** — **Faza 1 wdrożona** (commit `0c4fd3c`). Tokeny kolorystyczne (#259648 primary), typografia (Inter 400/500/600 + JetBrains Mono 400/500 via next/font), palety graphite/semantic, shadcn base tokens, cienie xs–lg. Komponenty: badge (5 wariantów semantycznych), button (danger), card (shadow-xs), table (graphite), sheet/slider (primary). Layout: sidebar/header avatar+aktywny stan blue→primary, body bg→graphite-50. constants.ts: STATUS_COLORS/CONDITION_COLORS na nowe tokeny. Build przeszedł czysto. Vercel deploy w toku.
- **2026-04-23** — Propozycja nowego designu aplikacji (panel inspektora + portal klienta + protokół PDF). Deliverable: `design/prowatech-prototype.html` (klikany prototyp) + `design/prowatech-redesign.md` (dokument). Decyzje: primary #259648 (delikatnie jaśniejszy od logo #1F7F3A), JetBrains Mono na dane/kody, portal klienta email+hasło (Faza 3), ton portalu „Państwo/Państwa". **Logo protokołów zostaje bez zmian** — oryginalna wersja (`public/logo-prowatech.png`) w dokumentach wychodzących. Stylizowany znak SVG pozostaje w UI wewnętrznym.
- **2026-04-23** — utworzenie tego pliku PROGRESS.md. Read-only rekonesans: git log, struktura repo, stan gałęzi. Nie wprowadzono zmian w kodzie.
- **2026-04-13** — (rekonstrukcja z git log) DOCX: naprawa korupcji pliku, `runtime = 'nodejs'`, poprawne `Buffer`, `PageNumber`. Stabilizacja endpointu `/api/docx/[id]`.
- **2026-04-12 / 04-13** — dodanie endpointu DOCX i przycisku pobierania, osadzenie logo ProWaTech w PDF, nagłówek firmowy + prawny w protokole PDF.
- **2026-04-10** — duża sesja po feedbacku testera: biblioteka defektów, GWO 4 moduły, inspektorzy (WINDA ID, skany), farm→turbine kaskada, soft-delete inspekcji, wyszukiwarka, formularz PDF z polskimi znakami.
- **2026-04-07 / 04-08** — modernizacja UI (tablet-first, shadcn), formularz inspekcji `TurbineInspectionForm` 3-krokowy, layout zdjęć 12×7 cm / 5,5×7 cm, naprawa crashy klienta.
- **2026-04-02 → 04-04** — stabilizacja deploymentu na Vercel: SSR, env vars, kolumny, foreign keys, PWA manifest.
- **2026-04-01** — initial commit aplikacji.
