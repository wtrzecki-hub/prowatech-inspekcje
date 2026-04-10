'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Wind, ClipboardCheck, Camera, FileText, Save, CheckCircle2,
  AlertTriangle, MapPin, Calendar, User, ChevronRight,
  ChevronLeft, Upload, Loader2, Wrench, Plus, Trash2,
  Building2, Shield, Zap, HardHat, Navigation2,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

// ── Types ──────────────────────────────────────────────────────────

type ConditionRating = 'dobry' | 'zadowalajacy' | 'sredni' | 'zly' | 'awaryjny' | null
type RepairType = 'NG' | 'NB' | 'K'
type UrgencyLevel = 'I' | 'II' | 'III' | 'IV'

interface Inspector {
  name: string
  license: string
  specialty: string
  chamber: string
  contact: string
}

interface PrevInspection {
  id: string
  date: string
  protocolNumber: string
  findings: string
  completionStatus: string
}

interface InfraState {
  roadAccess: boolean
  maneuvringArea: boolean
  mvCables: boolean
  substation: boolean
  notes: string
}

interface ElementCheck {
  definitionId: string
  elementNumber: number
  sectionCode: string
  namePl: string
  rating: ConditionRating
  wearPercentage: number | null
  notes: string
  recommendations: string
  photoNumbers: string
  detailedDescription: string
}

interface ServiceChecklistItem {
  code: string
  namePl: string
  checked: boolean
  notes: string
  sortOrder: number
}

interface RepairRecommendation {
  id: string
  scopeDescription: string
  repairType: RepairType
  urgencyLevel: UrgencyLevel
  elementName: string
}

interface PhotoEntry {
  file: File
  description: string
  preview: string
}

export interface TurbineOption {
  id: string
  turbine_code: string
  serial_number: string
  manufacturer: string
  model: string
  location_address: string
  rated_power_mw?: number | null
  hub_height_m?: number | null
  wind_farm_id: string
  wind_farms: { name: string }
}

export interface ElementDefinition {
  id: string
  element_number: number
  section_code: string
  name_pl: string
  name_short: string
}

// ── Constants ──────────────────────────────────────────────────────

const RATINGS: { value: NonNullable<ConditionRating>; label: string; color: string; activeColor: string }[] = [
  { value: 'dobry',       label: 'DOBRY',     color: 'border-green-300  text-green-700  hover:bg-green-50',  activeColor: 'bg-green-600  text-white border-green-600' },
  { value: 'zadowalajacy',label: 'ZADOW.',    color: 'border-blue-300   text-blue-700   hover:bg-blue-50',   activeColor: 'bg-blue-600   text-white border-blue-600' },
  { value: 'sredni',      label: 'ŚREDNI',    color: 'border-yellow-300 text-yellow-700 hover:bg-yellow-50', activeColor: 'bg-yellow-500 text-white border-yellow-500' },
  { value: 'zly',         label: 'ZŁY',       color: 'border-orange-300 text-orange-700 hover:bg-orange-50', activeColor: 'bg-orange-600 text-white border-orange-600' },
  { value: 'awaryjny',    label: 'AWARYJNY',  color: 'border-red-300    text-red-700    hover:bg-red-50',    activeColor: 'bg-red-600    text-white border-red-600' },
]

const SECTION_NAMES: Record<string, string> = {
  A: 'A — Konstrukcja',
  B: 'B — Bezpieczeństwo',
  C: 'C — Instalacje elektryczne',
  D: 'D — BHP i P-POŻ',
  E: 'E — Infrastruktura',
}

const SECTION_ICONS: Record<string, React.ElementType> = {
  A: Building2,
  B: Shield,
  C: Zap,
  D: HardHat,
  E: Navigation2,
}

const DEFAULT_SERVICE_CHECKLIST: Omit<ServiceChecklistItem, 'checked' | 'notes'>[] = [
  { code: 'S01', namePl: 'Oględziny zewnętrzne turbiny i gondoli',           sortOrder: 1 },
  { code: 'S02', namePl: 'Kontrola łopat wirnika (pęknięcia, uszkodzenia)',  sortOrder: 2 },
  { code: 'S03', namePl: 'Kontrola momentów dokręcenia śrub kołnierzy wieży', sortOrder: 3 },
  { code: 'S04', namePl: 'Kontrola momentów dokręcenia śrub łopat',          sortOrder: 4 },
  { code: 'S05', namePl: 'Smarowanie łożysk głównych',                        sortOrder: 5 },
  { code: 'S06', namePl: 'Smarowanie łożysk skoku łopat (pitch)',             sortOrder: 6 },
  { code: 'S07', namePl: 'Kontrola przekładni głównej (olej, wycieki)',       sortOrder: 7 },
  { code: 'S08', namePl: 'Kontrola generatora',                               sortOrder: 8 },
  { code: 'S09', namePl: 'Kontrola układu hamulcowego mechanicznego',         sortOrder: 9 },
  { code: 'S10', namePl: 'Kontrola systemu sterowania i oprogramowania',      sortOrder: 10 },
  { code: 'S11', namePl: 'Kontrola instalacji elektrycznej w gondoli',        sortOrder: 11 },
  { code: 'S12', namePl: 'Kontrola instalacji elektrycznej w wieży',          sortOrder: 12 },
  { code: 'S13', namePl: 'Kontrola systemu odgromowego',                      sortOrder: 13 },
  { code: 'S14', namePl: 'Kontrola drabiny i systemu asekuracji TYP-T',      sortOrder: 14 },
  { code: 'S15', namePl: 'Kontrola systemu przeciwpożarowego',                sortOrder: 15 },
  { code: 'S16', namePl: 'Kontrola anemometru i systemu pomiaru wiatru',      sortOrder: 16 },
  { code: 'S17', namePl: 'Kontrola świateł przeszkodowych',                   sortOrder: 17 },
  { code: 'S18', namePl: 'Weryfikacja danych w systemie SCADA',               sortOrder: 18 },
]

const TABS = ['dane-obiektu', 'ocena-elementow', 'serwis', 'wnioski', 'zdjecia'] as const
type TabKey = (typeof TABS)[number]

// ── Props ──────────────────────────────────────────────────────────

interface InspectorOption {
  id: string
  full_name: string
  license_number: string
  specialty: string
  chamber_membership: string
  email: string
  phone: string
}

interface Props {
  turbines: TurbineOption[]
  elementDefinitions: ElementDefinition[]
  preselectedTurbine?: TurbineOption | null
  inspectorName?: string
  inspectors?: InspectorOption[]
}

// ── Sub-component helpers ──────────────────────────────────────────

function ToggleButton({
  label, checked, onClick,
}: { label: string; checked: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 font-medium text-sm min-h-[48px] transition-all ${
        checked
          ? 'bg-green-600 text-white border-green-600'
          : 'border-gray-200 text-gray-600 hover:border-green-400'
      }`}
    >
      <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
      {label}
    </button>
  )
}

// ── Component ──────────────────────────────────────────────────────

export function TurbineInspectionForm({
  turbines,
  elementDefinitions,
  preselectedTurbine,
  inspectorName = '',
  inspectors = [],
}: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabKey>('dane-obiektu')
  const [saving, setSaving]       = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // ── Tab 1: Dane obiektu ───────────────────────────────────────────

  const [selectedFarmName, setSelectedFarmName]   = useState(preselectedTurbine?.wind_farms?.name || '')
  const [selectedTurbineId, setSelectedTurbineId] = useState(preselectedTurbine?.id || '')
  const [inspectionType, setInspectionType]       = useState<'annual' | 'five_year'>('annual')
  const [inspectionDate, setInspectionDate]       = useState(new Date().toISOString().split('T')[0])
  const [siteVisitDate, setSiteVisitDate]         = useState(new Date().toISOString().split('T')[0])
  const [nextInspectionDate, setNextInspectionDate] = useState('')
  const [committeeMembers, setCommitteeMembers]   = useState('')
  const [inspector1, setInspector1] = useState<Inspector>({
    name: inspectorName, license: '', specialty: 'budowlana', chamber: '', contact: '',
  })
  const [inspector2, setInspector2] = useState<Inspector>({
    name: '', license: '', specialty: 'elektryczna', chamber: '', contact: '',
  })
  const [infra, setInfra] = useState<InfraState>({
    roadAccess: false, maneuvringArea: false, mvCables: false, substation: false, notes: '',
  })
  const [prevInspections, setPrevInspections] = useState<PrevInspection[]>([])

  // ── Tab 2: Ocena elementów ────────────────────────────────────────

  const [elements, setElements] = useState<ElementCheck[]>(
    elementDefinitions.map((def) => ({
      definitionId: def.id,
      elementNumber: def.element_number,
      sectionCode: def.section_code,
      namePl: def.name_pl,
      rating: null,
      wearPercentage: null,
      notes: '',
      recommendations: '',
      photoNumbers: '',
      detailedDescription: '',
    }))
  )

  // ── Tab 3: Serwis ─────────────────────────────────────────────────

  const [serviceCompany, setServiceCompany]       = useState('')
  const [udtCertificate, setUdtCertificate]       = useState('')
  const [lastServiceDate, setLastServiceDate]     = useState('')
  const [lastServiceProtocol, setLastServiceProtocol] = useState('')
  const [nextServiceDate, setNextServiceDate]     = useState('')
  const [protocolsInKob, setProtocolsInKob]       = useState(false)
  const [serviceNotes, setServiceNotes]           = useState('')
  const [serviceChecklist, setServiceChecklist]   = useState<ServiceChecklistItem[]>(
    DEFAULT_SERVICE_CHECKLIST.map((item) => ({ ...item, checked: false, notes: '' }))
  )

  // ── Tab 4: Wnioski ────────────────────────────────────────────────

  const [repairRecs, setRepairRecs]             = useState<RepairRecommendation[]>([])
  const [overallAssessment, setOverallAssessment] = useState(
    'Elementy obiektu znajdują się w należytym stanie technicznym, zapewniającym jego sprawność techniczną i dalsze, bezpieczne jego użytkowanie.\nWskazane jest, aby dołączać do Książki Obiektu Budowlanego protokoły serwisanta z kontroli elementów konstrukcyjnych turbiny.'
  )
  const [hazardInformation, setHazardInformation] = useState(
    'W wyniku przeprowadzonej kontroli nie stwierdzono zagrożeń dla życia lub zdrowia ludzi oraz mogących mieć wpływ na bezpieczeństwo mienia lub środowiska.'
  )

  // ── Tab 5: Zdjęcia ────────────────────────────────────────────────

  const [photos, setPhotos] = useState<PhotoEntry[]>([])

  // ── Turbine search ────────────────────────────────────────────────

  const [turbineSearch, setTurbineSearch] = useState('')

  // ── Completion dialog ─────────────────────────────────────────────

  const [showCompletionDialog, setShowCompletionDialog] = useState(false)
  const [completionChecklist, setCompletionChecklist] = useState({
    uprawnieniaBudowlane: false,
    certyfikatGWO: false,
    certyfikatUDT: false,
    certyfikatSEP: false,
    dokumentacjaFotograficzna: false,
  })

  // ── Derived ───────────────────────────────────────────────────────

  const farmNames = Array.from(new Set(turbines.map((t) => t.wind_farms?.name).filter(Boolean))).sort()
  const filteredTurbines = selectedFarmName
    ? turbines.filter((t) => t.wind_farms?.name === selectedFarmName)
    : turbines
  const filteredTurbinesForSearch = filteredTurbines.filter((t) =>
    turbineSearch === '' ||
    t.turbine_code.toLowerCase().includes(turbineSearch.toLowerCase()) ||
    t.serial_number.toLowerCase().includes(turbineSearch.toLowerCase()) ||
    t.manufacturer.toLowerCase().includes(turbineSearch.toLowerCase()) ||
    t.location_address?.toLowerCase().includes(turbineSearch.toLowerCase())
  )
  const selectedTurbine = turbines.find((t) => t.id === selectedTurbineId)
  const completedCount  = elements.filter((e) => e.rating !== null).length
  const issueCount      = elements.filter(
    (e) => e.rating && !['dobry', 'zadowalajacy'].includes(e.rating)
  ).length

  // ── Updaters ──────────────────────────────────────────────────────

  function updateElement(defId: string, updates: Partial<ElementCheck>) {
    setElements((prev) => prev.map((el) => el.definitionId === defId ? { ...el, ...updates } : el))
  }

  function updI1(field: keyof Inspector, v: string) {
    setInspector1((p) => ({ ...p, [field]: v }))
  }
  function updI2(field: keyof Inspector, v: string) {
    setInspector2((p) => ({ ...p, [field]: v }))
  }

  function toggleInfra(field: keyof Omit<InfraState, 'notes'>) {
    setInfra((p) => ({ ...p, [field]: !p[field] }))
  }

  function addPrevInspection() {
    setPrevInspections((p) => [
      ...p,
      { id: crypto.randomUUID(), date: '', protocolNumber: '', findings: '', completionStatus: '' },
    ])
  }
  function updatePrevInspection(id: string, field: keyof PrevInspection, v: string) {
    setPrevInspections((p) => p.map((x) => x.id === id ? { ...x, [field]: v } : x))
  }
  function removePrevInspection(id: string) {
    setPrevInspections((p) => p.filter((x) => x.id !== id))
  }

  function addRepairRec() {
    setRepairRecs((p) => [
      ...p,
      { id: crypto.randomUUID(), scopeDescription: '', repairType: 'NB', urgencyLevel: 'II', elementName: '' },
    ])
  }
  function updateRepairRec(id: string, updates: Partial<RepairRecommendation>) {
    setRepairRecs((p) => p.map((r) => r.id === id ? { ...r, ...updates } : r))
  }
  function removeRepairRec(id: string) {
    setRepairRecs((p) => p.filter((r) => r.id !== id))
  }

  function toggleChecklistItem(code: string) {
    setServiceChecklist((p) => p.map((x) => x.code === code ? { ...x, checked: !x.checked } : x))
  }
  function updateChecklistNote(code: string, notes: string) {
    setServiceChecklist((p) => p.map((x) => x.code === code ? { ...x, notes } : x))
  }

  function addPhotos(files: FileList | null) {
    if (!files) return
    const entries: PhotoEntry[] = Array.from(files).map((file) => ({
      file,
      description: '',
      preview: URL.createObjectURL(file),
    }))
    setPhotos((p) => [...p, ...entries])
  }
  function removePhoto(i: number) {
    setPhotos((p) => {
      URL.revokeObjectURL(p[i].preview)
      return p.filter((_, idx) => idx !== i)
    })
  }
  function updatePhotoDesc(i: number, description: string) {
    setPhotos((p) => p.map((x, idx) => idx === i ? { ...x, description } : x))
  }

  // ── Auto-calculate next inspection date ──────────────────────────

  useEffect(() => {
    if (inspectionDate) {
      const date = new Date(inspectionDate)
      const nextYear = date.getFullYear() + 1
      const nextMonth = date.getMonth() + 1
      const lastDayOfMonth = new Date(nextYear, nextMonth, 0).getDate()
      setNextInspectionDate(
        `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(lastDayOfMonth).padStart(2, '0')}`
      )
    }
  }, [inspectionDate])

  // ── Navigation ────────────────────────────────────────────────────

  const currentIndex = TABS.indexOf(activeTab)
  const goNext = () => { if (currentIndex < TABS.length - 1) setActiveTab(TABS[currentIndex + 1]) }
  const goPrev = () => { if (currentIndex > 0) setActiveTab(TABS[currentIndex - 1]) }

  // ── Save / Submit ─────────────────────────────────────────────────

  function handleCompleteClick() {
    if (!selectedTurbineId) {
      alert('Wybierz turbinę')
      setActiveTab('dane-obiektu')
      return
    }
    setShowCompletionDialog(true)
  }

  async function saveInspection(status: 'draft' | 'completed') {
    if (!selectedTurbineId) {
      alert('Wybierz turbinę')
      setActiveTab('dane-obiektu')
      return
    }

    if (status === 'completed') setSubmitting(true)
    else setSaving(true)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      // Calculate worst rating
      const rated = elements.filter((e) => e.rating !== null)
      const ratingOrder: ConditionRating[] = ['awaryjny', 'zly', 'sredni', 'zadowalajacy', 'dobry']
      const worstRating = rated.length > 0
        ? (ratingOrder.find((r) => rated.some((e) => e.rating === r)) ?? null)
        : null

      // 1. Create inspection record
      const { data: inspection, error: inspError } = await supabase
        .from('inspections')
        .insert({
          turbine_id: selectedTurbineId,
          inspection_type: inspectionType,
          status,
          inspection_date: inspectionDate,
          site_visit_date: siteVisitDate || null,
          committee_members: committeeMembers || inspector1.name || null,
          overall_condition_rating: worstRating,
          overall_assessment: overallAssessment || null,
          hazard_information: hazardInformation || null,
          notes: null,
          created_by: session?.user.id,
        })
        .select('id')
        .single()

      if (inspError) throw inspError
      const inspectionId = inspection.id

      // 2. Inspection elements
      const elementRows = elements
        .filter((el) => el.rating !== null)
        .map((el) => ({
          inspection_id: inspectionId,
          element_definition_id: el.definitionId,
          condition_rating: el.rating,
          wear_percentage: el.wearPercentage,
          notes: el.notes || null,
          recommendations: el.recommendations || null,
          photo_numbers: el.photoNumbers || null,
          detailed_description: el.detailedDescription || null,
        }))

      if (elementRows.length > 0) {
        const { error } = await supabase.from('inspection_elements').upsert(elementRows, { onConflict: 'inspection_id,element_definition_id' })
        if (error) throw error
      }

      // 3. Service info
      const { error: svcError } = await supabase.from('service_info').insert({
        inspection_id: inspectionId,
        service_company: serviceCompany || null,
        udt_certificate_number: udtCertificate || null,
        last_service_date: lastServiceDate || null,
        last_service_protocol_number: lastServiceProtocol || null,
        next_service_date: nextServiceDate || null,
        service_protocols_in_kob: protocolsInKob,
        notes: serviceNotes || null,
      })
      if (svcError) throw svcError

      // 4. Service checklist
      const checklistRows = serviceChecklist
        .filter((x) => x.checked || x.notes)
        .map((x) => ({
          inspection_id: inspectionId,
          item_code: x.code,
          item_name_pl: x.namePl,
          is_checked: x.checked,
          notes: x.notes || null,
          sort_order: x.sortOrder,
        }))
      if (checklistRows.length > 0) {
        const { error } = await supabase.from('service_checklist').insert(checklistRows)
        if (error) throw error
      }

      // 5. Repair recommendations
      const repairRows = repairRecs
        .filter((r) => r.scopeDescription.trim())
        .map((r, i) => ({
          inspection_id: inspectionId,
          item_number: i + 1,
          scope_description: r.scopeDescription,
          repair_type: r.repairType,
          urgency_level: r.urgencyLevel,
          element_name: r.elementName || null,
        }))
      if (repairRows.length > 0) {
        const { error } = await supabase.from('repair_recommendations').insert(repairRows)
        if (error) throw error
      }

      // 6. Photos upload
      for (let i = 0; i < photos.length; i++) {
        const { file, description } = photos[i]
        const ext = file.name.split('.').pop() || 'jpeg'
        const path = `inspections/${inspectionId}/photo_${i + 1}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('turbine-photos')
          .upload(path, file, { contentType: file.type })

        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('turbine-photos').getPublicUrl(path)
          await supabase.from('inspection_photos').insert({
            inspection_id: inspectionId,
            photo_number: i + 1,
            description: description || `Zdjęcie ${i + 1}`,
            file_url: urlData.publicUrl,
            created_by: session?.user.id,
          })
        }
      }

      // 7. Update turbine last inspection if completed
      if (status === 'completed') {
        await supabase
          .from('turbines')
          .update({ last_inspection_date: inspectionDate, last_inspection_protocol: inspectionId })
          .eq('id', selectedTurbineId)
        router.push('/inspekcje')
      } else {
        alert('Zapisano roboczo!')
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error('Błąd zapisu:', error)
      alert(`Błąd: ${msg}`)
    } finally {
      setSaving(false)
      setSubmitting(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col">
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabKey)}
        className="flex-1 flex flex-col"
      >
        {/* ── Tab strip ── */}
        <TabsList className="grid w-full grid-cols-5 h-14 mb-4">
          <TabsTrigger value="dane-obiektu" className="h-12 text-xs sm:text-sm px-1">
            <ClipboardCheck className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline ml-1.5">Dane obiektu</span>
          </TabsTrigger>
          <TabsTrigger value="ocena-elementow" className="h-12 text-xs sm:text-sm px-1">
            <Wind className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline ml-1.5">Ocena</span>
            {completedCount > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs hidden sm:flex">
                {completedCount}/{elements.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="serwis" className="h-12 text-xs sm:text-sm px-1">
            <Wrench className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline ml-1.5">Serwis</span>
          </TabsTrigger>
          <TabsTrigger value="wnioski" className="h-12 text-xs sm:text-sm px-1">
            <FileText className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline ml-1.5">Wnioski</span>
          </TabsTrigger>
          <TabsTrigger value="zdjecia" className="h-12 text-xs sm:text-sm px-1">
            <Camera className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline ml-1.5">Zdjęcia</span>
            {photos.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs hidden sm:flex">
                {photos.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ══════════════════════════════════════════════════════════ */}
        {/* TAB 1 — Dane obiektu                                       */}
        {/* ══════════════════════════════════════════════════════════ */}
        <TabsContent value="dane-obiektu" className="mt-0 space-y-4">

          {/* Obiekt */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Wind className="h-5 w-5 text-blue-600" />
                Obiekt kontrolowany
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-base">Farma wiatrowa</Label>
                <Select
                  value={selectedFarmName || 'all'}
                  onValueChange={(v) => {
                    const farm = v === 'all' ? '' : v
                    setSelectedFarmName(farm)
                    setSelectedTurbineId('')
                  }}
                >
                  <SelectTrigger className="h-12 text-base">
                    <SelectValue placeholder="Wybierz farmę..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Wszystkie farmy</SelectItem>
                    {farmNames.map((name) => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-base">Turbina *</Label>
                <Input
                  value={turbineSearch}
                  onChange={(e) => setTurbineSearch(e.target.value)}
                  placeholder="Szukaj turbinę (kod, nr seryjny, producent, lokalizacja)..."
                  className="h-11 text-sm"
                />
                <Select value={selectedTurbineId || 'none'} onValueChange={(v) => setSelectedTurbineId(v === 'none' ? '' : v)}>
                  <SelectTrigger className="h-12 text-base">
                    <SelectValue placeholder="Wybierz turbinę..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— wybierz turbinę —</SelectItem>
                    {filteredTurbinesForSearch.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.turbine_code} — {t.manufacturer} {t.model}
                        {!selectedFarmName && ` (${t.wind_farms?.name})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedTurbine && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-sm">
                  <div><span className="text-muted-foreground">Producent:</span> <strong>{selectedTurbine.manufacturer}</strong></div>
                  <div><span className="text-muted-foreground">Model:</span> <strong>{selectedTurbine.model}</strong></div>
                  {selectedTurbine.rated_power_mw != null && (
                    <div><span className="text-muted-foreground">Moc:</span> <strong>{selectedTurbine.rated_power_mw} MW</strong></div>
                  )}
                  {selectedTurbine.hub_height_m != null && (
                    <div><span className="text-muted-foreground">Wys. osi:</span> <strong>{selectedTurbine.hub_height_m} m</strong></div>
                  )}
                  <div><span className="text-muted-foreground">Nr seryjny:</span> <strong>{selectedTurbine.serial_number}</strong></div>
                  <div><span className="text-muted-foreground">Farma:</span> <strong>{selectedTurbine.wind_farms?.name}</strong></div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Lokalizacja:</span>{' '}
                    <strong>{selectedTurbine.location_address}</strong>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-base">Typ kontroli</Label>
                  <Select
                    value={inspectionType}
                    onValueChange={(v) => setInspectionType(v as 'annual' | 'five_year')}
                  >
                    <SelectTrigger className="h-12 text-base"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="annual">Roczna</SelectItem>
                      <SelectItem value="five_year">Pięcioletnia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-base flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    Data przeglądu
                  </Label>
                  <Input
                    type="date"
                    value={inspectionDate}
                    onChange={(e) => setInspectionDate(e.target.value)}
                    className="h-12 text-base"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-base flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    Data wizji lokalnej
                  </Label>
                  <Input
                    type="date"
                    value={siteVisitDate}
                    onChange={(e) => setSiteVisitDate(e.target.value)}
                    className="h-12 text-base"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-base flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    Data następnej kontroli
                  </Label>
                  <Input
                    type="date"
                    value={nextInspectionDate}
                    onChange={(e) => setNextInspectionDate(e.target.value)}
                    className="h-12 text-base"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-base">Skład komisji</Label>
                {inspectors.length > 0 ? (
                  <Select
                    value="none"
                    onValueChange={(v) => {
                      if (v === 'none') return
                      const insp = inspectors.find((i) => i.id === v)
                      if (!insp) return
                      setCommitteeMembers((prev) =>
                        prev ? `${prev}, ${insp.full_name}` : insp.full_name
                      )
                    }}
                  >
                    <SelectTrigger className="h-12 text-base">
                      <SelectValue placeholder="Dodaj inspektora do komisji..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— dodaj inspektora —</SelectItem>
                      {inspectors.map((insp) => (
                        <SelectItem key={insp.id} value={insp.id}>
                          {insp.full_name}{insp.specialty ? ` (${insp.specialty})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
                <Input
                  value={committeeMembers}
                  onChange={(e) => setCommitteeMembers(e.target.value)}
                  placeholder="Imiona i nazwiska członków komisji..."
                  className="h-12 text-base"
                />
              </div>
            </CardContent>
          </Card>

          {/* Infrastruktura */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Navigation2 className="h-5 w-5 text-blue-600" />
                Infrastruktura
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <ToggleButton label="Droga dojazdowa"  checked={infra.roadAccess}     onClick={() => toggleInfra('roadAccess')} />
                <ToggleButton label="Plac manewrowy"   checked={infra.maneuvringArea} onClick={() => toggleInfra('maneuvringArea')} />
                <ToggleButton label="Kable SN"         checked={infra.mvCables}       onClick={() => toggleInfra('mvCables')} />
                <ToggleButton label="Stacja GPZ"       checked={infra.substation}     onClick={() => toggleInfra('substation')} />
              </div>
              <div className="space-y-2">
                <Label className="text-base">Uwagi do infrastruktury</Label>
                <Textarea
                  value={infra.notes}
                  onChange={(e) => setInfra((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Opis stanu infrastruktury..."
                  className="min-h-[80px] text-base resize-none"
                />
              </div>
            </CardContent>
          </Card>

          {/* Inspektor 1 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-5 w-5 text-blue-600" />
                Inspektor — branża budowlana
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-base">Imię i nazwisko</Label>
                {inspectors.length > 0 ? (
                  <Select
                    value={inspector1.name ? (inspectors.find((i) => i.full_name === inspector1.name)?.id ?? 'none') : 'none'}
                    onValueChange={(v) => {
                      if (v === 'none') return
                      const insp = inspectors.find((i) => i.id === v)
                      if (!insp) return
                      setInspector1({
                        name: insp.full_name,
                        license: insp.license_number || '',
                        specialty: insp.specialty || 'budowlana',
                        chamber: insp.chamber_membership || '',
                        contact: [insp.phone, insp.email].filter(Boolean).join(' / '),
                      })
                    }}
                  >
                    <SelectTrigger className="h-12 text-base">
                      <SelectValue placeholder="Wybierz inspektora..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— wybierz inspektora —</SelectItem>
                      {inspectors.map((insp) => (
                        <SelectItem key={insp.id} value={insp.id}>
                          {insp.full_name}{insp.specialty ? ` (${insp.specialty})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={inspector1.name} onChange={(e) => updI1('name', e.target.value)} placeholder="Jan Kowalski" className="h-12 text-base" />
                )}
                {inspectors.length > 0 && (
                  <Input value={inspector1.name} onChange={(e) => updI1('name', e.target.value)} placeholder="Jan Kowalski" className="h-10 text-sm" />
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-base">Nr uprawnień budowlanych</Label>
                <Input value={inspector1.license} onChange={(e) => updI1('license', e.target.value)} placeholder="np. MAŁ/0001/POOK/2020" className="h-12 text-base" />
              </div>
              <div className="space-y-2">
                <Label className="text-base">Specjalność</Label>
                <Input value={inspector1.specialty} onChange={(e) => updI1('specialty', e.target.value)} placeholder="budowlana" className="h-12 text-base" />
              </div>
              <div className="space-y-2">
                <Label className="text-base">Izba</Label>
                <Input value={inspector1.chamber} onChange={(e) => updI1('chamber', e.target.value)} placeholder="MOIIB / PIIB / ..." className="h-12 text-base" />
              </div>
              <div className="space-y-2">
                <Label className="text-base">Kontakt</Label>
                <Input value={inspector1.contact} onChange={(e) => updI1('contact', e.target.value)} placeholder="tel. / e-mail" className="h-12 text-base" />
              </div>
            </CardContent>
          </Card>

          {/* Inspektor 2 — tylko przy 5-letniej */}
          {inspectionType === 'five_year' && (
            <Card className="border-yellow-300 dark:border-yellow-700">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-5 w-5 text-yellow-600" />
                  Inspektor — branża elektryczna
                  <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 text-xs">
                    5-letnia
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-base">Imię i nazwisko</Label>
                  {inspectors.length > 0 ? (
                    <Select
                      value={inspector2.name ? (inspectors.find((i) => i.full_name === inspector2.name)?.id ?? 'none') : 'none'}
                      onValueChange={(v) => {
                        if (v === 'none') return
                        const insp = inspectors.find((i) => i.id === v)
                        if (!insp) return
                        setInspector2({
                          name: insp.full_name,
                          license: insp.license_number || '',
                          specialty: insp.specialty || 'elektryczna',
                          chamber: insp.chamber_membership || '',
                          contact: [insp.phone, insp.email].filter(Boolean).join(' / '),
                        })
                      }}
                    >
                      <SelectTrigger className="h-12 text-base">
                        <SelectValue placeholder="Wybierz inspektora..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— wybierz inspektora —</SelectItem>
                        {inspectors.map((insp) => (
                          <SelectItem key={insp.id} value={insp.id}>
                            {insp.full_name}{insp.specialty ? ` (${insp.specialty})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={inspector2.name} onChange={(e) => updI2('name', e.target.value)} placeholder="Jan Kowalski" className="h-12 text-base" />
                  )}
                  {inspectors.length > 0 && (
                    <Input value={inspector2.name} onChange={(e) => updI2('name', e.target.value)} placeholder="Jan Kowalski" className="h-10 text-sm" />
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-base">Nr uprawnień elektrycznych</Label>
                  <Input value={inspector2.license} onChange={(e) => updI2('license', e.target.value)} placeholder="np. E/0001/2020" className="h-12 text-base" />
                </div>
                <div className="space-y-2">
                  <Label className="text-base">Specjalność</Label>
                  <Input value={inspector2.specialty} onChange={(e) => updI2('specialty', e.target.value)} placeholder="elektryczna" className="h-12 text-base" />
                </div>
                <div className="space-y-2">
                  <Label className="text-base">Izba / Stowarzyszenie</Label>
                  <Input value={inspector2.chamber} onChange={(e) => updI2('chamber', e.target.value)} placeholder="SEP / ..." className="h-12 text-base" />
                </div>
                <div className="space-y-2">
                  <Label className="text-base">Kontakt</Label>
                  <Input value={inspector2.contact} onChange={(e) => updI2('contact', e.target.value)} placeholder="tel. / e-mail" className="h-12 text-base" />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Poprzednie kontrole */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  Poprzednie kontrole
                </CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={addPrevInspection} className="h-10 gap-1.5">
                  <Plus className="h-4 w-4" /> Dodaj
                </Button>
              </div>
            </CardHeader>
            {prevInspections.length > 0 && (
              <CardContent className="space-y-4">
                {prevInspections.map((pi) => (
                  <div key={pi.id} className="p-4 border rounded-lg space-y-3 relative">
                    <button
                      type="button"
                      onClick={() => removePrevInspection(pi.id)}
                      className="absolute top-3 right-3 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-sm">Data kontroli</Label>
                        <Input type="date" value={pi.date} onChange={(e) => updatePrevInspection(pi.id, 'date', e.target.value)} className="h-11" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm">Nr protokołu</Label>
                        <Input value={pi.protocolNumber} onChange={(e) => updatePrevInspection(pi.id, 'protocolNumber', e.target.value)} placeholder="np. P/2023/001" className="h-11" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm">Ustalenia</Label>
                      <Textarea
                        value={pi.findings}
                        onChange={(e) => updatePrevInspection(pi.id, 'findings', e.target.value)}
                        placeholder="Ustalenia z poprzedniej kontroli..."
                        className="min-h-[64px] resize-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm">Stan realizacji</Label>
                      <Input
                        value={pi.completionStatus}
                        onChange={(e) => updatePrevInspection(pi.id, 'completionStatus', e.target.value)}
                        placeholder="np. Zrealizowano w 100%"
                        className="h-11"
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            )}
          </Card>

          <div className="flex justify-end gap-4 pb-2">
            <Button onClick={goNext} size="lg" className="h-14 px-8 text-base gap-2">
              Dalej: Ocena elementów <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════ */}
        {/* TAB 2 — Ocena elementów                                    */}
        {/* ══════════════════════════════════════════════════════════ */}
        <TabsContent value="ocena-elementow" className="mt-0">
          <div className="flex gap-3 mb-4 flex-wrap">
            <Badge variant="outline" className="h-10 px-4 text-sm gap-2">
              <CheckCircle2 className="h-4 w-4" />
              {completedCount}/{elements.length} oceniono
            </Badge>
            {issueCount > 0 && (
              <Badge className="h-10 px-4 text-sm gap-2 bg-red-100 text-red-800 border-red-300">
                <AlertTriangle className="h-4 w-4" /> Problemy: {issueCount}
              </Badge>
            )}
            {inspectionType === 'five_year' && (
              <Badge className="h-10 px-4 text-sm gap-2 bg-yellow-100 text-yellow-800 border-yellow-300">
                Zakres 5-letni aktywny
              </Badge>
            )}
          </div>

          <ScrollArea>
            <div className="space-y-3 pb-4">
              {(() => {
                let lastSection = ''
                return elements.map((el) => {
                  const showSection = el.sectionCode !== lastSection
                  lastSection = el.sectionCode
                  const SectionIcon = SECTION_ICONS[el.sectionCode] ?? Building2

                  const cardBorder =
                    el.rating === 'awaryjny' ? 'border-red-400 bg-red-50/50 dark:border-red-700 dark:bg-red-950/30' :
                    el.rating === 'zly'      ? 'border-orange-300 bg-orange-50/50 dark:border-orange-700 dark:bg-orange-950/30' :
                    el.rating === 'sredni'   ? 'border-yellow-300 bg-yellow-50/50 dark:border-yellow-700 dark:bg-yellow-950/30' :
                    (el.rating === 'dobry' || el.rating === 'zadowalajacy')
                      ? 'border-green-300 bg-green-50/30 dark:border-green-700 dark:bg-green-950/20' : ''

                  return (
                    <div key={el.definitionId}>
                      {showSection && (
                        <div className="pt-5 pb-2 first:pt-0">
                          <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                            <SectionIcon className="h-4 w-4" />
                            {SECTION_NAMES[el.sectionCode] ?? el.sectionCode}
                          </h3>
                        </div>
                      )}

                      <Card className={`transition-colors ${cardBorder}`}>
                        <CardContent className="p-4 space-y-3">
                          <p className="text-base font-semibold leading-snug">
                            {el.elementNumber}. {el.namePl}
                          </p>

                          {/* Rating buttons */}
                          <div className="flex gap-1.5 flex-wrap">
                            {RATINGS.map((r) => (
                              <button
                                key={r.value}
                                type="button"
                                onClick={() =>
                                  updateElement(el.definitionId, {
                                    rating: el.rating === r.value ? null : r.value,
                                  })
                                }
                                className={`px-3 py-2.5 rounded-lg border-2 font-bold text-xs transition-all min-h-[48px] ${
                                  el.rating === r.value ? r.activeColor : r.color
                                }`}
                              >
                                {r.label}
                              </button>
                            ))}
                          </div>

                          {/* % zużycia + nr zdjęcia */}
                          {el.rating !== null && (
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <Label className="text-sm">
                                  % zużycia: <strong>{el.wearPercentage ?? 0}%</strong>
                                </Label>
                                <Slider
                                  min={0}
                                  max={100}
                                  step={5}
                                  value={[el.wearPercentage ?? 0]}
                                  onValueChange={([v]) =>
                                    updateElement(el.definitionId, { wearPercentage: v })
                                  }
                                  className="mt-2"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-sm">Nr zdjęcia</Label>
                                <Input
                                  value={el.photoNumbers}
                                  onChange={(e) =>
                                    updateElement(el.definitionId, { photoNumbers: e.target.value })
                                  }
                                  placeholder="np. 1, 2, 5"
                                  className="h-11"
                                />
                              </div>
                            </div>
                          )}

                          {/* Notes / Recommendations — for non-good ratings */}
                          {el.rating && !['dobry', 'zadowalajacy'].includes(el.rating) && (
                            <div className="space-y-2">
                              <Textarea
                                placeholder="Opis stanu / uwagi..."
                                value={el.notes}
                                onChange={(e) =>
                                  updateElement(el.definitionId, { notes: e.target.value })
                                }
                                className="min-h-[64px] text-base resize-none"
                              />
                              <Textarea
                                placeholder="Zalecenia naprawcze..."
                                value={el.recommendations}
                                onChange={(e) =>
                                  updateElement(el.definitionId, { recommendations: e.target.value })
                                }
                                className="min-h-[64px] text-base resize-none"
                              />
                            </div>
                          )}

                          {/* 5-year extended scope */}
                          {inspectionType === 'five_year' && (
                            <div className="space-y-1 border-t pt-3 border-yellow-200 dark:border-yellow-800">
                              <Label className="text-sm text-yellow-700 dark:text-yellow-400 flex items-center gap-1.5">
                                <Badge className="text-xs bg-yellow-100 text-yellow-800 border-yellow-300">
                                  5-letni
                                </Badge>
                                Szczegółowy opis — zakres rozszerzony
                              </Label>
                              <Textarea
                                placeholder="Opis w zakresie kontroli pięcioletniej..."
                                value={el.detailedDescription}
                                onChange={(e) =>
                                  updateElement(el.definitionId, { detailedDescription: e.target.value })
                                }
                                className="min-h-[56px] text-base resize-none"
                              />
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  )
                })
              })()}
            </div>
          </ScrollArea>

          <div className="flex justify-between mt-6 gap-4">
            <Button onClick={goPrev} variant="outline" size="lg" className="h-14 px-6 text-base gap-2">
              <ChevronLeft className="h-5 w-5" /> Wróć
            </Button>
            <Button onClick={goNext} size="lg" className="h-14 px-8 text-base gap-2">
              Dalej: Serwis <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════ */}
        {/* TAB 3 — Serwis                                             */}
        {/* ══════════════════════════════════════════════════════════ */}
        <TabsContent value="serwis" className="mt-0 space-y-4">

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Wrench className="h-5 w-5 text-blue-600" />
                Dane firmy serwisowej
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-base">Firma serwisowa</Label>
                <Input value={serviceCompany} onChange={(e) => setServiceCompany(e.target.value)} placeholder="Nazwa firmy" className="h-12 text-base" />
              </div>
              <div className="space-y-2">
                <Label className="text-base">Nr certyfikatu UDT</Label>
                <Input value={udtCertificate} onChange={(e) => setUdtCertificate(e.target.value)} placeholder="np. UDT/0001/2023" className="h-12 text-base" />
              </div>
              <div className="space-y-2">
                <Label className="text-base">Data ostatniego serwisu</Label>
                <Input type="date" value={lastServiceDate} onChange={(e) => setLastServiceDate(e.target.value)} className="h-12 text-base" />
              </div>
              <div className="space-y-2">
                <Label className="text-base">Nr protokołu serwisowego</Label>
                <Input value={lastServiceProtocol} onChange={(e) => setLastServiceProtocol(e.target.value)} placeholder="np. SRV/2023/001" className="h-12 text-base" />
              </div>
              <div className="space-y-2">
                <Label className="text-base">Planowany termin serwisu</Label>
                <Input type="date" value={nextServiceDate} onChange={(e) => setNextServiceDate(e.target.value)} className="h-12 text-base" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-base">Uwagi</Label>
                <Textarea value={serviceNotes} onChange={(e) => setServiceNotes(e.target.value)} placeholder="Dodatkowe informacje o serwisie..." className="min-h-[80px] text-base resize-none" />
              </div>
              <div className="sm:col-span-2">
                <ToggleButton
                  label="Protokoły serwisowe w KOB"
                  checked={protocolsInKob}
                  onClick={() => setProtocolsInKob((p) => !p)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-blue-600" />
                Czynności serwisowe
                <Badge variant="secondary">
                  {serviceChecklist.filter((x) => x.checked).length}/{serviceChecklist.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {serviceChecklist.map((item) => (
                <div key={item.code} className="p-3 rounded-lg border bg-card space-y-2">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => toggleChecklistItem(item.code)}
                      className={`w-7 h-7 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        item.checked
                          ? 'bg-green-600 border-green-600'
                          : 'border-gray-300 hover:border-green-400'
                      }`}
                    >
                      {item.checked && <CheckCircle2 className="h-4 w-4 text-white" />}
                    </button>
                    <span className="text-sm font-medium">{item.namePl}</span>
                  </div>
                  {item.checked && (
                    <Input
                      value={item.notes}
                      onChange={(e) => updateChecklistNote(item.code, e.target.value)}
                      placeholder="Uwagi..."
                      className="h-9 text-sm ml-10"
                    />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex justify-between gap-4">
            <Button onClick={goPrev} variant="outline" size="lg" className="h-14 px-6 text-base gap-2">
              <ChevronLeft className="h-5 w-5" /> Wróć
            </Button>
            <Button onClick={goNext} size="lg" className="h-14 px-8 text-base gap-2">
              Dalej: Wnioski <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════ */}
        {/* TAB 4 — Wnioski                                            */}
        {/* ══════════════════════════════════════════════════════════ */}
        <TabsContent value="wnioski" className="mt-0 space-y-4">

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-blue-600" />
                  Zestawienie robót remontowych
                </CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={addRepairRec} className="h-10 gap-1.5">
                  <Plus className="h-4 w-4" /> Dodaj zalecenie
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {repairRecs.length === 0 && (
                <p className="text-center text-muted-foreground py-8 text-sm">
                  Brak zaleceń remontowych — kliknij &quot;Dodaj zalecenie&quot;
                </p>
              )}
              {repairRecs.map((rec, idx) => (
                <div key={rec.id} className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-sm px-3 h-7 font-bold shrink-0">
                      Lp. {idx + 1}
                    </Badge>
                    <button
                      type="button"
                      onClick={() => removeRepairRec(rec.id)}
                      className="ml-auto text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Zakres robót</Label>
                    <Textarea
                      value={rec.scopeDescription}
                      onChange={(e) => updateRepairRec(rec.id, { scopeDescription: e.target.value })}
                      placeholder="Opisz zakres robót remontowych..."
                      className="min-h-[72px] text-base resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-sm">Rodzaj</Label>
                      <Select
                        value={rec.repairType}
                        onValueChange={(v) => updateRepairRec(rec.id, { repairType: v as RepairType })}
                      >
                        <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NG">NG — Naprawa główna</SelectItem>
                          <SelectItem value="NB">NB — Naprawa bieżąca</SelectItem>
                          <SelectItem value="K">K — Prace konserwacyjne</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm">Pilność</Label>
                      <Select
                        value={rec.urgencyLevel}
                        onValueChange={(v) => updateRepairRec(rec.id, { urgencyLevel: v as UrgencyLevel })}
                      >
                        <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="I">I — Niezwłocznie</SelectItem>
                          <SelectItem value="II">II — Do 3 miesięcy</SelectItem>
                          <SelectItem value="III">III — Do 1 roku</SelectItem>
                          <SelectItem value="IV">IV — Do 5 lat</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm">Element</Label>
                      <Input
                        value={rec.elementName}
                        onChange={(e) => updateRepairRec(rec.id, { elementName: e.target.value })}
                        placeholder="np. Fundament"
                        className="h-11"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                Ocena końcowa i zagrożenia
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-base">Ogólna ocena stanu technicznego</Label>
                <Textarea
                  value={overallAssessment}
                  onChange={(e) => setOverallAssessment(e.target.value)}
                  placeholder="Ogólna ocena stanu technicznego obiektu..."
                  className="min-h-[120px] text-base resize-none"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-base">Informacja o zagrożeniach</Label>
                <Textarea
                  value={hazardInformation}
                  onChange={(e) => setHazardInformation(e.target.value)}
                  placeholder="Zidentyfikowane zagrożenia i zalecenia bezpieczeństwa..."
                  className="min-h-[120px] text-base resize-none"
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-between gap-4">
            <Button onClick={goPrev} variant="outline" size="lg" className="h-14 px-6 text-base gap-2">
              <ChevronLeft className="h-5 w-5" /> Wróć
            </Button>
            <Button onClick={goNext} size="lg" className="h-14 px-8 text-base gap-2">
              Dalej: Zdjęcia <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════ */}
        {/* TAB 5 — Zdjęcia                                            */}
        {/* ══════════════════════════════════════════════════════════ */}
        <TabsContent value="zdjecia" className="mt-0 space-y-4">

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Camera className="h-5 w-5 text-blue-600" />
                Dokumentacja fotograficzna
                {photos.length > 0 && (
                  <Badge variant="secondary">{photos.length} zdjęć</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <label className="flex flex-col items-center justify-center h-36 border-2 border-dashed rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition-colors">
                <Upload className="h-10 w-10 text-gray-400 mb-2" />
                <span className="text-base text-gray-500 font-medium">Dotknij aby dodać zdjęcia</span>
                <span className="text-sm text-gray-400 mt-0.5">Aparat lub galeria</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  capture="environment"
                  className="hidden"
                  onChange={(e) => addPhotos(e.target.files)}
                />
              </label>

              {photos.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {photos.map((photo, i) => (
                    <div key={i} className="space-y-2">
                      <div className="relative aspect-[4/3] bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden border">
                        <img
                          src={photo.preview}
                          alt={`Zdjęcie ${i + 1}`}
                          className="w-full h-full object-contain"
                        />
                        <div className="absolute top-1.5 left-1.5 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                          #{i + 1}
                        </div>
                        <button
                          type="button"
                          onClick={() => removePhoto(i)}
                          className="absolute top-1.5 right-1.5 bg-red-600/80 hover:bg-red-700 text-white rounded-full p-1 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <Input
                        value={photo.description}
                        onChange={(e) => updatePhotoDesc(i, e.target.value)}
                        placeholder={`Opis zdjęcia ${i + 1}...`}
                        className="h-9 text-sm"
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-between gap-4">
            <Button onClick={goPrev} variant="outline" size="lg" className="h-14 px-6 text-base gap-2">
              <ChevronLeft className="h-5 w-5" /> Wróć
            </Button>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="h-14 px-6 text-base gap-2"
                disabled={saving}
                onClick={() => saveInspection('draft')}
              >
                {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                Zapisz roboczo
              </Button>
              <Button
                type="button"
                size="lg"
                className="h-14 px-8 text-base gap-2 bg-green-600 hover:bg-green-700"
                disabled={submitting}
                onClick={handleCompleteClick}
              >
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                Zakończ protokół
              </Button>
            </div>
          </div>
        </TabsContent>

      </Tabs>

      {/* ── Completion Dialog ────────────────────────────────────────── */}
      <Dialog open={showCompletionDialog} onOpenChange={setShowCompletionDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Zakończenie protokołu
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Potwierdź, że wszystkie wymagane dokumenty są dostępne:
            </p>

            {([
              { key: 'uprawnieniaBudowlane', label: 'Uprawnienia budowlane inspektora' },
              { key: 'certyfikatGWO',        label: 'Certyfikat GWO (Global Wind Organisation)' },
              { key: 'certyfikatUDT',        label: 'Certyfikat UDT (Urząd Dozoru Technicznego)' },
              { key: 'certyfikatSEP',        label: 'Certyfikat SEP / uprawnienia elektryczne' },
              { key: 'dokumentacjaFotograficzna', label: 'Dokumentacja fotograficzna' },
            ] as { key: keyof typeof completionChecklist; label: string }[]).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() =>
                  setCompletionChecklist((p) => ({ ...p, [key]: !p[key] }))
                }
                className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 text-sm font-medium text-left transition-all ${
                  completionChecklist[key]
                    ? 'bg-green-50 border-green-500 text-green-800 dark:bg-green-950/30 dark:border-green-600 dark:text-green-300'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300 dark:border-gray-700'
                }`}
              >
                <CheckCircle2 className={`h-5 w-5 flex-shrink-0 ${completionChecklist[key] ? 'text-green-600' : 'text-gray-300'}`} />
                {label}
              </button>
            ))}
          </div>

          <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setShowCompletionDialog(false)}
              className="h-11"
            >
              Anuluj
            </Button>
            <Button
              onClick={() => {
                setShowCompletionDialog(false)
                saveInspection('completed')
              }}
              disabled={submitting}
              className="h-11 bg-green-600 hover:bg-green-700 gap-2"
            >
              {submitting
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <CheckCircle2 className="h-4 w-4" />
              }
              Zatwierdź i zakończ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
