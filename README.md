# Prowatech Inspekcje

System zarządzania inspekcjami turbin wiatrowych zbudowany w Next.js z Supabase.

## Cechy

- **Dashboard** - Przegląd inspekcji, statystyki i przeterminowane zalecenia
- **Responsive Design** - Pełna obsługa mobilna i desktop
- **Real-time Data** - Integracja z Supabase
- **Autentykacja** - Logowanie przez Google OAuth
- **Polish UI** - Cały interfejs w języku polskim

## Struktura Projektu

```
src/
├── app/
│   ├── layout.tsx                 # Root layout
│   ├── page.tsx                   # Redirect do dashboard
│   ├── login/
│   │   └── page.tsx              # Login page
│   ├── auth/
│   │   └── callback/route.ts      # OAuth callback
│   └── (protected)/
│       ├── layout.tsx             # Protected routes layout
│       └── dashboard/
│           └── page.tsx           # Dashboard page
├── components/
│   ├── layout/
│   │   ├── sidebar.tsx            # Desktop sidebar
│   │   ├── header.tsx             # Mobile header
│   │   └── mobile-nav.tsx         # Mobile navigation
│   ├── dashboard/
│   │   ├── stats-cards.tsx        # Stats cards grid
│   │   ├── recent-inspections.tsx # Recent inspections table
│   │   └── alerts-panel.tsx       # Overdue alerts panel
│   └── ui/                        # Reusable UI components
├── lib/
│   ├── constants.ts               # Constants (status, urgency)
│   ├── utils.ts                   # Utility functions
│   └── supabase/
│       └── client.ts              # Supabase client
└── app/
    └── globals.css                # Global styles
```

## Setup

### 1. Instalacja zależności

```bash
npm install
```

### 2. Konfiguracja Supabase

Skopiuj `.env.example` do `.env.local` i uzupełnij zmienne:

```bash
cp .env.example .env.local
```

Zmienne wymagane:
- `NEXT_PUBLIC_SUPABASE_URL` - URL Twojego projektu Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Anonimowy klucz API

### 3. Konfiguracja OAuth Google

1. W Supabase → Authentication → Providers → Google
2. Skonfiguruj Client ID i Secret z Google Cloud Console
3. Dodaj redirect URL: `https://yourapp.com/auth/callback`

### 4. Setup Bazy Danych

Wykonaj migracje w Supabase:

```sql
-- Tabela profili
CREATE TABLE profiles (
  id uuid PRIMARY KEY,
  email text UNIQUE,
  full_name text,
  avatar_url text,
  updated_at timestamp DEFAULT NOW()
);

-- Tabela klientów
CREATE TABLE clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamp DEFAULT NOW()
);

-- Tabela farm wiatrowych
CREATE TABLE wind_farms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  client_id uuid REFERENCES clients(id),
  created_at timestamp DEFAULT NOW()
);

-- Tabela turbin
CREATE TABLE turbines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  wind_farm_id uuid REFERENCES wind_farms(id),
  created_at timestamp DEFAULT NOW()
);

-- Tabela inspekcji
CREATE TABLE inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_number text UNIQUE NOT NULL,
  inspection_date timestamp NOT NULL,
  client_id uuid REFERENCES clients(id),
  wind_farm_id uuid REFERENCES wind_farms(id),
  turbine_id uuid REFERENCES turbines(id),
  status text DEFAULT 'draft',
  assessment_rating integer,
  completed_at timestamp,
  created_at timestamp DEFAULT NOW()
);

-- Tabela zaleceń naprawy
CREATE TABLE repair_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid REFERENCES inspections(id),
  element_name text NOT NULL,
  scope_description text,
  urgency_level text,
  deadline_date timestamp,
  is_completed boolean DEFAULT FALSE,
  created_at timestamp DEFAULT NOW()
);
```

### 5. Uruchomienie

```bash
npm run dev
```

Aplikacja będzie dostępna na `http://localhost:3000`

## Komponenty

### Layout Components

- **Sidebar** - Nawigacja desktop z responsywnym menu
- **Header** - Nagłówek mobilny z menu hamburger
- **MobileNav** - Sheet z nawigacją dla urządzeń mobilnych

### Dashboard Components

- **StatsCards** - 4 karty ze statystykami (pobierane z Supabase w real-time)
- **RecentInspections** - Tabela ostatnich 10 inspekcji z możliwością kliknięcia
- **AlertsPanel** - Panel przeterminowanych zaleceń naprawy

## Technologie

- **Next.js 14** - Framework React
- **TypeScript** - Typowanie JavaScript
- **Tailwind CSS** - Utility-first styling
- **Radix UI** - Unstyled komponenty
- **Supabase** - Backend i autentykacja
- **Lucide React** - Ikony

## API

### Supabase Queries

Komponenty pobierają dane z następujących tabel:
- `inspections` - Inspekcje z relacjami
- `repair_recommendations` - Zalecenia napraw
- `profiles` - Profile użytkowników

Wszystkie zapytania używają `createBrowserClient` dla bezpiecznego dostępu z klienta.

## Bezpieczeństwo

- Row Level Security (RLS) powinno być włączone w Supabase
- OAuth przez Google dla autentykacji
- Sesje przechowywane bezpiecznie w ciasteczkach

## Deployment

### Vercel (Rekomendowane)

```bash
vercel deploy
```

### Inne platformy

```bash
npm run build
npm start
```

## Zmienne Środowiska

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc... (dla backend operacji)
```

## Licencja

Proprietary - Prowatech
