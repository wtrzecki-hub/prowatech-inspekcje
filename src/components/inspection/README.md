# Inspection Components

Production-quality components for the Prowatech Inspekcje Next.js application. All UI elements are in Polish.

## Components

### 1. **status-bar.tsx** (4.6 KB)
Horizontal progress bar showing inspection workflow status through 5 stages: draft → in_progress → review → completed → signed.

**Features:**
- Visual progress indicator with numbered stages
- Current status highlighted, completed ones checked
- "Przejdź do:" button to advance status
- Confirmation dialog before status change
- Supabase integration for persistence
- Status labels from INSPECTION_STATUSES constant
- Color-coded: gray → blue → yellow → green → emerald

**Props:**
```typescript
status: 'draft' | 'in_progress' | 'review' | 'completed' | 'signed'
onStatusChange: (status: string) => void
inspectionId: string
```

---

### 2. **rating-badge.tsx** (712 B)
Small badge component displaying condition rating with color coding.

**Features:**
- Shows one of 5 ratings: DOBRY, ZADOWALAJĄCY, ŚREDNI, ZŁY, AWARYJNY
- Color-coded backgrounds based on CONDITION_COLORS constant
- Displays "Brak oceny" for null values in gray
- Compact design suitable for tables and cards

**Props:**
```typescript
rating: 'dobry' | 'zadowalajacy' | 'sredni' | 'zly' | 'awaryjny' | null
```

---

### 3. **element-card.tsx** (11 KB)
Expandable card for inspecting individual building elements with full assessment details.

**Features:**
- Header with element number and name
- Expandable/collapsible design with ChevronDown/Up
- Collapsible "Zakres kontroli" section showing annual and 5-year scope requirements
- Condition rating dropdown (5-level color scale)
- Wear percentage slider (0-100%) with visual indicator
- Notes, recommendations, detailed description textareas
- Photo numbers input
- "Nie dotyczy" checkbox to disable element (grays out card)
- RatingBadge display
- Debounced auto-save (800ms) on field blur
- Full Supabase integration

**Props:**
```typescript
element: InspectionElement & { definition: ElementDefinition }
onUpdate: (data: Partial<InspectionElement>) => void
```

**Database Fields:**
- condition_rating, wear_percentage, notes, recommendations
- photo_numbers, detailed_description, not_applicable

---

### 4. **service-checklist.tsx** (14 KB)
Manages service information and maintenance checklist for inspected equipment.

**Features:**
- Service Info Card with fields:
  - Firma serwisowa (service company name)
  - Nr certyfikatu UDT (UDT certificate number)
  - Data ostatniego serwisu (last service date)
  - Nr protokołu serwisu (protocol number)
  - Następny serwis (next service date)
  - Protokoły w KOB (checkbox)
  - Uwagi (notes textarea)
- Checklist Section:
  - Checkbox for each item with strikethrough on completion
  - Notes field per item
  - Delete button per item
  - Add new item with inline input + button
  - Items can be added/deleted/edited dynamically
- Auto-creates service_info record on first edit
- Debounced auto-save (800ms)
- Full Supabase integration

**Props:**
```typescript
inspectionId: string
```

---

### 5. **electrical-measurements.tsx** (16 KB)
Comprehensive electrical test results table with multiple measurement parameters.

**Features:**
- Shared fields across all measurements:
  - Data pomiaru (measurement date)
  - Pomiary przeprowadził (measured by)
  - Informacje o urządzeniu (instrument info)
- Detailed table with columns for:
  - Measurement point name
  - Grounding resistance (Ω) + result
  - Insulation resistance (MΩ) + result
  - Loop impedance (Ω) + result
  - RCD time (ms) + result
  - PE continuity (Ω) + result
- All measurements are numerical inputs
- Result fields for OK/NOK status
- "Dodaj punkt pomiarowy" button to add rows
- Delete row button
- Debounced auto-save (800ms)
- Full Supabase integration

**Props:**
```typescript
inspectionId: string
```

---

### 6. **repair-table.tsx** (18 KB)
Table of repair recommendations with full CRUD operations and status tracking.

**Features:**
- Sortable table columns:
  - Lp. (row number)
  - Element (from element_id)
  - Zakres robót (scope description)
  - Rodzaj (NG/NB/K badges with colors)
  - Pilność (I/II/III/IV urgency badges)
  - Termin (deadline date)
  - Koszt szacunkowy (estimated cost in PLN)
  - Status (completion checkbox + date tracking)
- "Dodaj zalecenie" button opens dialog with:
  - Element selection (dropdown)
  - Repair type (NG/NB/K selector)
  - Urgency level (I-IV)
  - Deadline date picker
  - Estimated cost (number input)
  - Scope description (required textarea)
- Edit/Delete actions per row
- Completion toggle with auto-dated completion_date
- Color-coded urgency levels (red→orange→yellow→green)
- Full Supabase integration

**Props:**
```typescript
inspectionId: string
elements?: { id: string; name: string }[]
```

---

### 7. **photo-gallery.tsx** (14 KB)
Image gallery with upload management and element association.

**Features:**
- Grid layout (1 col mobile, 2 cols tablet, 3 cols desktop)
- Photo cards showing:
  - Thumbnail preview (or placeholder icon)
  - Photo number
  - Description (line-clamped to 2 lines)
  - Element association (blue badge)
  - Edit/Delete buttons
- "Dodaj zdjęcie" button opens dialog with:
  - Photo URL input (required)
  - Auto-incrementing photo number
  - Element selection (dropdown)
  - Description textarea
  - Live preview of uploaded image
- Filter by element (dropdown)
- Sorted by photo_number
- Full Supabase integration

**Props:**
```typescript
inspectionId: string
elements?: { id: string; name: string }[]
```

---

## Shared Patterns

### Supabase Integration
All components use the same client instantiation pattern:
```typescript
const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

### UI Library
- Button, Card, Input, Label, Select, Textarea, Checkbox, Dialog, Badge components from `@/components/ui/*`
- Table component for data-heavy displays

### Auto-Save Pattern
Debounced updates (800ms) on field blur to avoid excessive database writes:
```typescript
const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

if (debounceTimerRef.current) {
  clearTimeout(debounceTimerRef.current)
}

debounceTimerRef.current = setTimeout(async () => {
  // Save to database
}, 800)
```

### Constants
Components reference from `@/lib/constants`:
- `INSPECTION_STATUSES` - Status labels
- `CONDITION_RATINGS` - Rating display names
- `CONDITION_COLORS` - Color coding for ratings

### Icons
Using lucide-react icons: Check, ChevronDown, ChevronUp, ChevronRight, Edit2, Plus, Trash2, Image, X

---

## Usage Example

```typescript
import { StatusBar } from '@/components/inspection/status-bar'
import { ElementCard } from '@/components/inspection/element-card'
import { ServiceChecklist } from '@/components/inspection/service-checklist'
import { ElectricalMeasurements } from '@/components/inspection/electrical-measurements'
import { RepairTable } from '@/components/inspection/repair-table'
import { PhotoGallery } from '@/components/inspection/photo-gallery'

export default function InspectionPage() {
  const [status, setStatus] = useState('draft')
  const inspectionId = 'inspection-123'

  return (
    <div className="space-y-6">
      <StatusBar
        status={status}
        onStatusChange={setStatus}
        inspectionId={inspectionId}
      />

      <ElementCard
        element={element}
        onUpdate={handleUpdate}
      />

      <ServiceChecklist inspectionId={inspectionId} />

      <ElectricalMeasurements inspectionId={inspectionId} />

      <RepairTable
        inspectionId={inspectionId}
        elements={elements}
      />

      <PhotoGallery
        inspectionId={inspectionId}
        elements={elements}
      />
    </div>
  )
}
```

---

## Database Tables Required

- `inspections` - Main inspection records
- `inspection_elements` - Individual elements per inspection
- `element_definitions` - Element definitions (annual/5-year scope)
- `service_info` - Service company details
- `service_checklist` - Checklist items
- `electrical_measurements` - Electrical test results
- `repair_recommendations` - Repair suggestions
- `inspection_photos` - Photo gallery

---

## All Files Location
`/sessions/cool-sleepy-galileo/mnt/outputs/prowatech-app/src/components/inspection/`
