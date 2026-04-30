# Faza 17 — Lista turbin pominiętych przy auto-ekstrakcji zdjęć

_Data: 2026-04-29 wieczór. Powstało po `extract_photos_2025.py` + `upload_turbine_photos.py`._

## Podsumowanie

- **Łącznie turbin w bazie:** 425
- **Z kompletem 3 zdjęć z R2 (Faza 17):** 375
- **Pominiętych:** **50**

**Powód pominięcia (wszystkie 50):** brak wpisu w `historical_protocols` dla `year=2025 AND inspection_type='annual'` — czyli operator nie wykazał kontroli rocznej za 2025 dla tej turbiny, albo arkusz `Zestawienie_turbin_przeglądy_2026` (z którego pochodzą placeholdery 2025) nie obejmował tych klientów.

Reason code w SQL: `no_2025_record`.

## Lista pominiętych turbin (zgrupowana per klient)

### "FW Żary" Sp. z o.o. — 7 turbin (FW Żary)

| Kod turbiny | Oznaczenie EW | Lokalizacja |
|---|---|---|
| T282 | WTG06 | Drożków |
| T283 | WTG07 | Drożków |
| T284 | WTG09 | Drożków |
| T285 | WTG13 | Lubanice |
| T286 | WTG15 | Lubanice |
| T287 | WTG16 | Lubanice |
| T288 | WTG17 | Lubanice |

### Działdowo Sp. z o.o. — 2 turbiny (FW Działdowo)

| Kod turbiny | Oznaczenie EW | Lokalizacja |
|---|---|---|
| T026 | EW 1 | Pierławki |
| T027 | EW 2 | Kisiny |

### Gewind Grabik Sp. z o.o. — 2 turbiny (FW Grabik)

| Kod turbiny | Oznaczenie EW | Lokalizacja |
|---|---|---|
| T031 | WTG 01 | Lubanice |
| T032 | WTG 02 | Lubanice |

### Miksztal Windfarm Spółka z o.o. — 5 turbin (FW Miksztal)

| Kod turbiny | Oznaczenie EW | Lokalizacja |
|---|---|---|
| T021 | WTG 01E | Grochów |
| T022 | WTG 01W | Grochów |
| T023 | WTG 02W | Grochów |
| T024 | WTG 03W | Miksztal |
| T025 | WTG 04W | Miksztal |

### Park Wiatrowy 12 Sp. z o.o. — 15 turbin (FW Słupca - Kołaczkowo)

| Kod turbiny | Oznaczenie EW | Lokalizacja |
|---|---|---|
| T047 | WTG 01 | Krzywa Góra |
| T048 | WTG 02 | Krzywa Góra |
| T049 | WTG 03 | Krzywa Góra |
| T050 | WTG 04 | Krzywa Góra |
| T051 | WTG 05 | Krzywa Góra |
| T052 | WTG 06 | Krzywa Góra |
| T053 | WTG 07 | Krzywa Góra |
| T054 | WTG 08 | Krzywa Góra |
| T055 | WTG 09 | Kołaczkowo |
| T056 | WTG 10 | Kołaczkowo |
| T057 | WTG 11 | Miłosław |
| T058 | WTG 12 | Gorazdowo |
| T059 | WTG 13 | Gorazdowo |
| T060 | WTG 14 | Gorazdowo |
| T061 | WTG 15 | Gorazdowo |

### Salarian Sp. z o.o. — 3 turbiny (FW Brodnica)

| Kod turbiny | Oznaczenie EW | Lokalizacja |
|---|---|---|
| T028 | WTG 01 | Świerczyny |
| T029 | WTG 02 | Świerczyny |
| T030 | WTG 03 | Świerczyny |

### Suchań Sp. z o.o. — 12 turbin (FW Suchań)

| Kod turbiny | Oznaczenie EW | Lokalizacja |
|---|---|---|
| T033 | WTG 01 | Żukowo |
| T034 | WTG 02 | Żukowo |
| T035 | WTG 03 | Żukowo |
| T036 | WTG 04 | Żukowo |
| T037 | WTG 05 | Żukowo |
| T038 | WTG 06 | Żukowo |
| T039 | WTG 07 | Sadłowo |
| T040 | WTG 08 | Sadłowo |
| T041 | WTG 09 | Sadłowo |
| T042 | WTG 10 | Sadłowo |
| T043 | WTG 11 | Sadłowo |
| T044 | WTG 12 | Sadłowo |

### WS Gabin Sp. z o.o. — 3 turbiny (FW GĄBIN)

| Kod turbiny | Oznaczenie EW | Lokalizacja |
|---|---|---|
| T174 | EW 1 | Lwówek |
| T175 | EW 2 | Lwówek |
| T176 | EW 3 | Krubin |

### WS Wind Park VI Sp. z o.o. — 1 turbina (FW Brzeźno)

| Kod turbiny | Oznaczenie EW | Lokalizacja |
|---|---|---|
| T149 | EW Brzeźno | Bronisław |

## Co dalej (opcje dla tych 50 turbin)

1. **Ustalić z operatorami czy kontrola roczna 2025 została wykonana** — dla wszystkich 9 klientów. Jeśli tak: zażądać PDF i wgrać przez UI Archiwum (`/turbiny/[id]` → tab Archiwum → drag-drop). Parser nazwy auto-fillem wypełni rok/typ/numer.
2. **Po wgraniu PDF przez UI** — operator sam zobaczy zdjęcia w karcie turbiny dopiero po ponownym uruchomieniu pipeline'u Faza 17 dla tych konkretnych turbin (skrypt `extract_photos_2025.py` filtruje po `historical_protocols` z `protocol_pdf_url IS NOT NULL`, więc nowe wpisy zostaną złapane). Wystarczy:
   ```powershell
   python scripts/extract_photos_2025.py --skip-existing
   python scripts/upload_turbine_photos.py
   ```
   Idempotentne — turbiny które już mają zdjęcia zostaną pominięte.
3. **Alternatywa: ręczne wgranie zdjęć przez kartę turbiny** — w UI `/turbiny/[id]` jest osobny upload zdjęć (3 sloty). Dla małych liczb (np. 2 turbiny FW Działdowo) szybsze niż pipeline.
4. **Zostawić bez zdjęć** — jeśli operator nie wykonał inspekcji 2025, brak źródła zdjęć z karty tytułowej protokołu PIIB. Karta turbiny w aplikacji pokaże empty state „brak zdjęcia" — UI Faza 14 to obsługuje.

## Zapytanie SQL używane do generowania listy

```sql
WITH p2025 AS (
  SELECT turbine_id, BOOL_OR(protocol_pdf_url IS NOT NULL) AS has_pdf
  FROM historical_protocols
  WHERE year = 2025 AND inspection_type = 'annual'
  GROUP BY turbine_id
)
SELECT t.turbine_code, t.ew_designation, wf.name AS wind_farm, c.name AS client
FROM turbines t
LEFT JOIN wind_farms wf ON wf.id = t.wind_farm_id
LEFT JOIN clients c ON c.id = wf.client_id
LEFT JOIN p2025 p ON p.turbine_id = t.id
WHERE t.photo_url IS NULL OR t.photo_url_2 IS NULL OR t.photo_url_3 IS NULL
ORDER BY c.name, wf.name, t.turbine_code;
```
