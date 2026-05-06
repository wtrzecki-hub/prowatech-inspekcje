# PROGRESS — Prowatech Inspekcje

> **Ten plik jest aktualizowany na koniec każdej sesji pracy nad projektem.**
> **Jeśli jesteś Claude rozpoczynającym nową sesję pracy nad Prowatech Inspekcje — przeczytaj ten plik w pierwszej kolejności**, zanim zaczniesz eksplorować repo lub pytać użytkownika o kontekst.
>
> Po refaktorze 2026-04-29 (wieczór) ten plik jest **cienki**: bieżący stan + W toku + linki. Pełna historia / pułapki / architektura → katalog [docs/](docs/).

_Ostatnia aktualizacja: 2026-04-30 wieczór — **Sesja zamykająca uwagi Artura (3a + 3c + 5 + krok 7 z 27.04) + 2 bugfixy UX + uplift nazw spółek właścicieli FW + naprawa formularza farmy. 8 commitów, 2 migracje DB, wymiana biblioteki usterek 250→135. 100% uwag Artura zamkniętych.**_

---

## Bieżąca sesja — 2026-04-30 wieczór: zamknięcie wszystkich uwag Artura

**(1) Uplift nazw spółek właścicieli FW (Zestawienie 2026 — kontynuacja).** Po sygnale Waldka „nie zmigrowało nazw spółek" zrobione systematyczne porównanie 103 farm xlsx vs 106 farm DB. Znalezione 7 niezgodności, po weryfikacji z Arturem zatwierdzone 4 zmiany w migracji `2026-04-30_clients_owner_names_uplift_from_xlsx.sql` (commit `5e2983c`):
- `Eurowind Polska III` → `Eurowind Polska III Sp. z o.o.` (FW ROGOŹNO)
- `Eurowind PolskaVI` → `Eurowind Polska VI Sp. z o.o.` (FW Kębłowo, dodano spację + sufiks)
- **EW Bieganowo zmiana właściciela**: `PRASMET Sp. z o.o.` → `EW GRADOWO Sp. z o.o.`
- **FW Brzeźno (WS Wind Park VI, T149-Bronisław)** → przemianowana na `FW Bronisław` (klient zostaje); druga FW Brzeźno (Trasko Energia, T162) bez zmian.

Świadomie pominięte: `Eurowind Polska V` (sierota, 0 farm — Artur sprawdzi); `EW Pruchnowo`/`EW Skibin` (DB ma `Sp. k.` poprawnie, xlsx ma starą `Sp. z o.o.` — była zmiana formy prawnej).

**(2) Bug pre-fill „Klient" w formularzu farmy + 6 brakujących pól (commit `d59faa0`).** Waldek pokazał screenshot karty FW Bronisław: header pokazywał poprawnie „WS Wind Park VI Sp. z o.o.", ale Select w formularzu pusty. Diagnoza: `wind-farm-form.tsx:45` `useState(clientId || '')` — `clientId` to props używany tylko w trybie tworzenia; w edycji parent przekazuje `initialData.client_id`, który był ignorowany. Fix: `useState(clientId || initialData?.client_id || '')` + computed children w `SelectValue` (fallback gdy lista clients ładuje się asynchronicznie). Dodatkowo do formularza dodane 6 pól które są w DB ale były niewidoczne w UI: `location_gmina`, `location_powiat`, `location_voivodeship`, `area_label`, `notes`, `google_drive_folder_url`. Helper `str/num/int` konwertuje puste pola na `null`. Label „Lokalizacja" → „Miejscowość".

**(3) Bug „tylko 4 znaki" w polu Opis stanu technicznego (commit `f82386b`).** Waldek pokazał screenshot z polem zawierającym „Upra" (4 znaki). Diagnoza: `handleFieldChange` w `element-card.tsx` ustawiał `setIsLoading(true)` natychmiast po każdym wciśnięciu klawisza → `disabled={isLoading}` na Textarea blokował dalsze pisanie. User wpisywał 1-4 znaki zanim React zdążył re-renderować, potem czekał 800ms. Fix: usunięte `disabled={isLoading}` z **wszystkich 8 miejsc** karty elementu (Checkbox „Nie dotyczy", 2× Select, 3× Textarea, 2× Input). Wskaźnik „Zapisywanie..." na dole karty pozostaje. Przy okazji naprawione 4 broken indents JSX po replace_all (Select condition, Select usage, Input completion, Textarea description, Textarea recommendations).

**(4) Pkt 3c Artura — przycisk „Kopiuj do Wniosków" (commit `fad1e2d`).** Obok labelu „Zalecenia / uwagi" w karcie elementu mały przycisk outline. Klik kopiuje treść z prefixem `[Element N — Nazwa]:` do pola `overall_assessment` w tabie Wnioski (append `\n\n` zamiast replace). Disabled gdy pole Zalecenia puste. Krótki feedback „✓ Skopiowano" 1.8s. Implementacja: nowy prop `onCopyToConclusions` w ElementCard + handler `handleCopyRecommendationToConclusions` w `/inspekcje/[id]/page.tsx`. Wykorzystany istniejący debounce `handleInspectionChange` 500ms.

**(5) Pkt 3a Artura — wymiana biblioteki defect_library 250 → 135 (commit `74e584f`).** Artur dostarczył `baza_usterek_dostosowana.xlsx` (135 wpisów) z **rozdzielonymi kolumnami**: Opis wizualny + Zalecenie naprawcze + Typ naprawy K/NB/NG + Priorytet I/II/III + Sekcja protokołu + Podstawa prawna. Stara biblioteka (250 wpisów, `description_template` puste, `recommendation_template` zawierał tylko 2-literowy kod) zastąpiona w całości przez REST API bulk insert (DELETE 250 + INSERT 135). Brak FK do defect_library = bezpieczne. Mapowanie: `name_pl = name + (K/NB/NG)`, `description_template = visual_desc + Podstawa prawna: ...`, `recommendation_template = recommendation`, `typical_urgency = priority`. 5 nowych kategorii: **Fundament**, **Wieża**, **Stacja**, **Pozostałe**, **5-letnie**. Backup 250 starych wpisów eksportowany jako `defect_library_backup_2026-04-30.xlsx` (33 KB, untracked) — Artur ma dopasować opis usterki do każdego ze starych zaleceń jako kolejna iteracja merge'u.

**(6) Pkt 3a — Dialog biblioteki w karcie elementu (commit `3738493`).** Wcześniej biblioteka była tylko w `turbine-inspection-form.tsx` (formularz nowej inspekcji). W widoku edycji `/inspekcje/[id]` (używany w terenie) NIE BYŁO biblioteki w ogóle. Dodany w `element-card.tsx`: przycisk **„Z biblioteki"** obok labelu „Opis i ustalenia z kontroli" → otwiera Dialog z 135 wpisami. Filtr po kategorii + szukanie po nazwie/opisie/zaleceniu/kodzie. Każdy wpis: badge z kodem (F01, W12, S03, P02, 5L01), nazwa, opis wizualny (truncated), strzałka + zalecenie (truncated), badge priorytetu. **Jeden klik = oba pola wypełnione** (`description_template` → `notes`, `recommendation_template` → `recommendations`). `confirm()` przed nadpisaniem jeśli któreś pole ma treść. Lazy fetch biblioteki na pierwszym otwarciu dialogu. Wykorzystany `onUpdate({notes, recommendations})` w jednym wywołaniu zamiast 2× `handleFieldChange` żeby uniknąć wyścigu z debounce.

**(7) Bug scroll w bibliotece usterek (commit `56ffa90`).** Po deployu Artura zgłosił że lista 135 wpisów się nie scrolluje — content wykrztaszał się poza Dialog. Mimo `flex-1 min-h-0` (analogicznie do fix 871c704 z turbine-inspection-form), nie działało. Niezawodniejsze: `flex-1` → konkretna wysokość `h-[55vh]`. Radix ScrollArea Viewport ma `h-full` i potrzebuje konkretnej wysokości na Root — flex-1 zależy od działającego flex parent (DialogContent z domyślnym `grid` może nie nadpisywać się `flex flex-col` przy niektórych wersjach twMerge).

**(8) Pkt 5 Artura — tab „Zdjęcia" zostaje (decyzja produktowa).** Bez zmian w kodzie. Tab pełni rolę galerii dodatkowych zdjęć inspekcji nieprzypisanych do konkretnego elementu (np. ogólne ujęcie turbiny, dokumentacja kontekstu).

**(9) Pkt 7 Artura (z 27.04) — relabel pola Opis stanu (commit `4c9e630`).** Zamiast dodawać trzecie pole, **przemianowanie istniejącego** `notes` na nazwę zgodną z PIIB: **„Opis i ustalenia z kontroli"** (1:1 z kolumną tabeli III w Załączniku PIIB/KR/0051/2024). Zmiana w 6 miejscach:
- `element-card.tsx` Label + placeholder + 2× w treści Dialog/confirm biblioteki
- `turbine-inspection-form.tsx` placeholder + tekst linku biblioteki („Wybierz z biblioteki (uwagi)" → „... (opis)")
- PDF generator (kolumna tabeli III): `'Opis stanu technicznego'` → `'Opis i ustalenia z kontroli'`
- DOCX generator (header tabeli III, wariant roczny): `'OPIS STANU TECHNICZNEGO'` → `'OPIS I USTALENIA Z KONTROLI'`

Schemat DB bez zmian. Stary placeholder zastąpiony bardziej trafnym „Opisz stan elementu, stwierdzone nieprawidłowości, wyniki oględzin...".

**(10) Raport dla Artura — `Raport_dla_Artura_2026-04-30.pdf` (47.0 KB, untracked) + `.md`.** Wygenerowany przez `scripts/generate_artur_report.py` (kopia generate_tomek_report.py z innym INPUT/OUTPUT/footerem). Punkt po punkcie odpowiedź na każdą uwagę Artura — co znaleziono + co zrobiono + jak przetestować + commit hash.

**Status końcowy uwag Artura:** **100% zamkniętych** (pkt 1 + 2a + 2b + 2c+2d + 3a + 3b + 3c + krok 4 z 27.04 (martwa karta) + pkt 5 (decyzja) + krok 7).

**Komity (8 łącznie, w kolejności chronologicznej):** `5e2983c` uplift nazw spółek, `d59faa0` pre-fill klient + 6 pól, `fad1e2d` Kopiuj do Wniosków (3c), `f82386b` bug 4 znaki, `74e584f` migracja defect_library 250→135, `3738493` Dialog biblioteki w karcie elementu (3a), `56ffa90` fix scroll biblioteki, `4c9e630` relabel Opis stanu → Opis i ustalenia z kontroli (krok 7).

**Migracje DB (2):** `2026-04-30_clients_owner_names_uplift_from_xlsx.sql` (4 UPDATE'y), `2026-04-30_defect_library_replace_with_baza_usterek.sql` (DELETE 250 + INSERT 135).

---

## Najnowsze sesje (skrót — pełne wpisy w [docs/sessions/2026-04.md](docs/sessions/2026-04.md))

- **2026-04-30 noc** — Mega-sesja: Faza 17 push + UX zdjęć + archiwum 2021 (93.2%) + 2020 (66.4%) + 7 uwag Tomka + 5 uwag Artura + raport dla Tomka + uplift xlsx Zestawienie 2026 (turbiny lat/lon 100%, +280 PNU, 106/106 farm lat/lon+miejscowość). 21 commitów, 5 migracji DB, archiwum 92.6%.
- **2026-04-29 wieczór** — Faza 17 DONE (372 turbiny × 3 zdjęcia z PDF 2025) + refaktor PROGRESS na strukturę docs/.
- **2026-04-29 popołudnie** — implementacja Fazy 17 (sample 3-PDF zwalidowane, bulk z sandboxa padł 403 r2.dev).
- **2026-04-29 rano** — migracje archiwum 2022/2023/2025 (947 plików, 3.6 GB na R2), bugfix UI Historia inspekcji, **91.5% pokrycia archiwum**.
- **2026-04-28 noc** — Faza 15.G dla 2024 (PB w GDrive 2025) + audyt 2025: 48 plików PB gotowych, +20 commitów na produkcji.
- **2026-04-27** — Roadmapa uwag Artura: 6/7 kroków DONE, 8 commitów + edit dialog dla turbin + raport `Raport_dla_Artura_2026-04-27.pdf`.
- **2026-04-26** — Faza 16 (audyt seedów + smoke test portalu klienta end-to-end), Faza 16.1 (DB trigger auto-sign), Faza 15 (R2 + archiwum PIIB), Faza 14 (3 zdjęcia turbiny w PDF/DOCX).

> Pełne sesje (ze szczegółami implementacyjnymi, decyzjami, pułapkami): [docs/sessions/2026-04.md](docs/sessions/2026-04.md).

---

## Stan projektu (krótko)

Aplikacja webowa (PWA) do zarządzania inspekcjami turbin wiatrowych dla firmy ProWaTech. Next.js 14 App Router + Supabase + Cloudflare R2 + Vercel. UI po polsku.

**Kluczowe liczby (2026-04-30 wieczór):**
- 425 turbin / 106 farm / 70 klientów w bazie
- 375/425 turbin ma komplet 3 zdjęć z PDF 2025 (Faza 17)
- **Karty turbin po uplifcie xlsx:** 425/425 lat/lon (100%), 281/425 PNU, 425/425 działka/gmina/powiat/województwo
- **Karty farm po uplifcie xlsx:** 106/106 lat/lon + miejscowość + capacity + count + gmina/powiat/wojew., 69/106 data uruchomienia
- Archiwum protokołów PIIB rocznych: **1507/1628 placeholderów = 92.6% pokrycia** (2020 66.4%, 2021 93.2%, 2022 89.0%, 2023 87.5%, 2024 100%, 2025 100%)
- R2 storage (faktyczne): **5.35 GB / 10 GB = 53.5%** (`historical/` 5.28 GB / 1628 plików, `turbines/` 58 MB / 1126, `inspections/` 5 MB / 8)
- `defect_library`: **135 wpisów** (po wymianie ze starych 250 — backup w `defect_library_backup_2026-04-30.xlsx`)
- 6/425 turbin ma inspekcje wykonane w aplikacji (`inspections`), 5 ma otwarte zalecenia (`repair_recommendations`) — reszta tylko archiwum PDF (oczekiwane dla młodej aplikacji)

Pełen opis architektury, stosu technologicznego, decyzji projektowych, komend i linków → [docs/architecture.md](docs/architecture.md).

---

## W toku / następne kroki

**Bieżące priorytety (kolejna sesja):**

1. **Wysłanie raportu Arturowi** — `Raport_dla_Artura_2026-04-30.pdf` (47.0 KB, untracked) zawiera odpowiedź na 4 zamknięte uwagi (3a, 3c, 5, krok 7) + 2 bugfixy + uplift spółek + naprawa formularza farmy.

2. **Dopasowanie 250 starych zaleceń do nowych opisów (Artur, manualnie).** Plik `defect_library_backup_2026-04-30.xlsx` (33 KB, untracked) zawiera 250 starych wpisów `defect_library` z których `description_template` jest puste a `recommendation_template` zawiera tylko kod K/NB/NG. Artur dopisze opis usterki do każdego, potem domergujemy do bieżącej biblioteki 135 wpisów (jeśli okaże się że stare zawierały wartościowe pozycje nieistniejące w nowych).

3. **Wysłanie raportu „do uzupełnienia ręcznie" Arturowi** — `Raport_do_uzupelnienia_recznie_2026-04-30.pdf` (86 KB, untracked z poprzedniej sesji) — 37 farm bez `commissioning_date` + 144 turbin bez PNU + sekcja niespójności C.1-C.5.

4. **Decyzje produktowe (z poprzednich raportów, otwarte):**
   - **Eurowind Polska V** (id `68dfd218-...`) — sierota w bazie (0 farm). Czy faktycznie istniejący podmiot do zachowania, czy do usunięcia?
   - **Konwencja „ostatni protokół"** — 89 turbin: xlsx pokazuje numer rocznego (np. `217/T/2025`), DB ma numer 5-letniego (`234/T/2025`). Co przyjmujemy?
   - **39 turbin Miksztal „WYPADŁY"** — T021-T025 (klient `Miksztal Windfarm Sp. z o.o.`, ostatnia kontrola 26.05.2021). Oznaczyć jako wycofane?
   - **T184-T186 niespójność klienta** — xlsx: `CIME WIND KRZANOWICE III Sp. z o.o.`, DB: `Visavento Krzanowice Sp. z o.o.`. Zmiana właściciela?

5. **Bug `turbines.last_inspection_protocol` = UUID** — dla T150-Kowalewo Opactwo / T317-Kamlarki / T319-Niedźwiedź zapisany jest `inspections.id` zamiast `inspections.protocol_number`. Bug w ścieżce zapisu po `signed`/`completed` inspekcji. Do naprawy w kodzie + jednorazowy UPDATE retroaktywny.

**Otwarte (archiwum) — niezamknięte z dotychczasowych migracji:**

6. **Brakujące placeholdery 2020 (43 z 128 = 33.6%)** — Sekcja A raportu `Brakujace_protokoly_2020.pdf`: FW Bęcino (T062/T063/T064), Bronisław I/II (T199/T336), FW Sumin (T328), FW Błaszki (T158), FW Podzamek/Solec, Lubsin I (T193), Pruchnowo (T004) — możliwe że kontrole roczne 2020 nie były wykonywane dla części klientów.
7. **Brakujące placeholdery 2021 (14 z 206 = 6.8%)** — `Brakujace_protokoly_2021.pdf`: FW Działoszyn (T001/T002 EW Bella/Flower), FW Podzamek Golubski (T320/T321), FW Solec Kujawski (T322/T323), Pruchnowo (T004), Wójcice (T158).
8. **Multi-match Strzałkowo ST5/ST6** (2020 + 2021) — cross-Cytrus/Gólcz, format `EW ST{N}` poza zakresem klienta. Manualne rozstrzygnięcie.
9. **Sekcja B Dobrzyca multi-match** (z 2023) — 12 plików `WTG-EW{N}` których matcher nie potrafi deterministycznie zmapować do `WTG{NN}`. Wymaga ręcznego mapowania lub cross-reference EW→WTG od operatora.
10. **Bławaty/Brzeźno** (1 plik 2020 + 1 plik 2021 + 1 plik 2023) — WS Wind Park VI: DB ma `T149-Bronisław` z `FW Bronisław` (po dzisiejszym przemianowaniu), GDrive ma `EW Bławaty`. Decyzja DB vs operator, potem ręczne uploady.

**Drobna polerka odłożona** (nie blokująca):

- Hero w innych miejscach (lista turbin `/turbiny`, dashboard, search results) — dziś tylko `/turbiny/[id]` ma nowy format `EW 1 · Lokalizacja · T<code>`.
- `Raport_zmian_Prowatech_Inspekcje.pdf` w roocie repo to stary raport — nadpisać przez `Raport_dla_Artura_2026-04-30.pdf` albo zostawić.

**Pliki w workspace gotowe do reuse:**
- `scripts/scan_match_{2020,2021,2022,2023,2025}_local.py` — szablony archiwum (preferuj 2021 jako bazę).
- `scripts/generate_missing_{2020,2021,2022,2023,2025}_report.py` — szablony PDF reportów.
- `scripts/generate_tomek_report.py` + `scripts/generate_artur_report.py` — mini-parser markdown → reportlab Story z fontem Roboto. Reuse dla raportów odpowiedzi na uwagi.
- `scripts/upload_batch.py` — z trybem upsert (działa dla all years).
- `scripts/extract_photos_2025.py` + `scripts/upload_turbine_photos.py` — pipeline Fazy 17 (multi-year extension trywialny).
- `scripts/_r2_size_check.py` — szybki audyt zużycia R2 (boto3 list_objects + aggregation per prefix).

---

## Dokumenty pomocnicze

- **[docs/sessions/2026-04.md](docs/sessions/2026-04.md)** — pełna historia sesji (wpisy `Poprzednia:`, sekcja „Ostatnio zrobione", brief log, Faza 1 fundamenty designu)
- **[docs/gotchas.md](docs/gotchas.md)** — pułapki / utrwalone problemy (sandbox proxy, null bytes, PKCE+Gmail prefetch, R2 User-Agent block, etc.)
- **[docs/architecture.md](docs/architecture.md)** — stan projektu, kluczowe decyzje architektoniczne, komendy + linki, dane DB
- **[design/prowatech-redesign.md](design/prowatech-redesign.md)** — dokument projektowy redesignu (z 2026-04-23)
- **[design/prowatech-prototype.html](design/prowatech-prototype.html)** — klikany prototyp HTML
- **[migrations/](migrations/)** — wszystkie migracje SQL (każda z sekcją WERYFIKACJA + ROLLBACK)
