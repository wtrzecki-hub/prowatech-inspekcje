'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'

import { StatusBar } from '@/components/inspection/status-bar'
import { ElementCard } from '@/components/inspection/element-card'
import {
  BulkStatusBar,
  CONDITION_BULK_OPTIONS,
  USAGE_BULK_OPTIONS,
} from '@/components/inspection/bulk-status-bar'
import { ServiceChecklist } from '@/components/inspection/service-checklist'
import { ElectricalMeasurements } from '@/components/inspection/electrical-measurements'
import { RepairTable } from '@/components/inspection/repair-table'
import { PhotoGallery } from '@/components/inspection/photo-gallery'

// PIIB components (Faza 10):
import { InspectionMetadataPiib } from '@/components/inspection/inspection-metadata-piib'
import { PreviousRecommendationsTable } from '@/components/inspection/previous-recommendations-table'
import { EmergencyStateTable } from '@/components/inspection/emergency-state-table'
import { RepairScopeTable } from '@/components/inspection/repair-scope-table'
import { BasicRequirementsArt5 } from '@/components/inspection/basic-requirements-art5'
import { AttachmentsList } from '@/components/inspection/attachments-list'

import {
  INSPECTION_STATUSES,
  INSPECTION_TYPES,
  CONDITION_RATINGS,
} from '@/lib/constants'
import {
  isInspectionLocked,
  LOCKED_BANNER_TITLE,
  LOCKED_BANNER_BODY,
} from '@/lib/inspections/locked'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Save,
} from 'lucide-react'

type ConditionRating = 'dobry' | 'zadowalajacy' | 'sredni' | 'zly' | 'awaryjny'
type InspectionStatus = 'draft' | 'in_progress' | 'review' | 'completed' | 'signed'

interface Inspection {
  id: string
  protocol_number: string | null
  inspection_date: string
  inspection_type: 'annual' | 'five_year'
  status: InspectionStatus
  overall_condition_rating: ConditionRating | null
  overall_assessment: string | null
  hazard_information: string | null
  environmental_protection_findings: string | null
  documentation_verification_findings: string | null
  weather_exposure_methods: string | null
  next_annual_date: string | null
  next_five_year_date: string | null
  next_electrical_date: string | null
  inspector_signature_location: string | null
  inspector_signature_date: string | null
  owner_representative_name: string | null
  owner_signature_date: string | null
  turbine: {
    id: string
    turbine_code: string
    /** Oznaczenie EW nadane przez zarządcę (np. „EW Bieganowo") — preferowane
     *  do wyświetlania w nagłówku zamiast technicznego turbine_code. */
    ew_designation: string | null
    model: string | null
    manufacturer: string | null
    rated_power_mw: number | null
  }
  wind_farm: {
    id: string
    name: string
  }
  client: {
    id: string
    name: string
    nip: string | null
  }
}

// Matches ElementCard's internal InspectionElement type
interface InspectionElement {
  id: string
  element_number: number
  condition_rating: ConditionRating | null
  wear_percentage: number
  notes: string | null
  recommendations: string | null
  photo_numbers: string | null
  detailed_description: string | null
  not_applicable: boolean
  // PIIB (od 2026-04-25):
  usage_suitability: 'spelnia' | 'nie_spelnia' | null
  recommendation_completion_date: string | null
}

interface ElementDefinition {
  id: string
  name_pl: string
  section_code: string | null
  scope_annual: string | null
  scope_five_year_additional: string | null
  // PIIB (od 2026-04-25):
  applicable_standards: string | null
}

type InspectionElementWithDef = InspectionElement & { definition: ElementDefinition }

interface Inspector {
  id: string
  full_name: string
  license_number: string | null
  specialty: string | null
}

export default function InspectionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [inspection, setInspection] = useState<Inspection | null>(null)
  const [elements, setElements] = useState<InspectionElementWithDef[]>([])
  const [inspectors, setInspectors] = useState<Inspector[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showOnlyNotes, setShowOnlyNotes] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [manualSaving, setManualSaving] = useState<'idle' | 'saving' | 'done'>('idle')

  // Zdjęcia inspekcji — ładowane raz, dystrybuowane do ElementCardów per
  // element_id. Refresh przez `refreshPhotos` po upload/delete.
  const [allPhotos, setAllPhotos] = useState<
    Array<{
      id: string
      photo_number: number | null
      file_url: string | null
      description: string | null
      element_id: string | null
    }>
  >([])

  // Tomasz pkt 5 + Waldek 2026-05-08: domyślnie OFF, sekcja w PDF/DOCX dopiero
  // gdy checkbox + dane wypełnione.
  const [serviceIncludeInProtocol, setServiceIncludeInProtocol] = useState<boolean>(false)
  const [serviceInfoId, setServiceInfoId] = useState<string | null>(null)

  const elementSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inspectionSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetchInspectionData()
    void refreshPhotos()
  }, [id])

  const refreshPhotos = async () => {
    const supabase = createClient()
    try {
      const { data, error: photosError } = await supabase
        .from('inspection_photos')
        .select('id, photo_number, file_url, description, element_id')
        .eq('inspection_id', id)
        .order('photo_number', { ascending: true, nullsFirst: false })
      if (photosError) throw photosError
      setAllPhotos(data || [])
    } catch (err) {
      console.error('[InspectionDetail] refreshPhotos failed:', err)
    }
  }

  const fetchInspectionData = async () => {
    const supabase = createClient()
    try {
      setLoading(true)
      setError(null)

      const { data: inspectionData, error: inspectionError } = await supabase
        .from('inspections')
        .select(
          `
          id,
          protocol_number,
          inspection_date,
          inspection_type,
          status,
          overall_condition_rating,
          overall_assessment,
          hazard_information,
          environmental_protection_findings,
          documentation_verification_findings,
          weather_exposure_methods,
          next_annual_date,
          next_five_year_date,
          next_electrical_date,
          inspector_signature_location,
          inspector_signature_date,
          owner_representative_name,
          owner_signature_date,
          turbine:turbine_id (
            id,
            turbine_code,
            ew_designation,
            model,
            manufacturer,
            rated_power_mw,
            wind_farm:wind_farm_id (
              id,
              name,
              client:client_id (id, name, nip)
            )
          )
        `
        )
        .eq('id', id)
        .single()

      if (inspectionError) throw inspectionError

      // Flatten nested wind_farm / client into top-level for compatibility with Inspection type
      const raw = inspectionData as any
      const flattened: Inspection = {
        ...raw,
        turbine: {
          id: raw.turbine?.id,
          turbine_code: raw.turbine?.turbine_code,
          ew_designation: raw.turbine?.ew_designation ?? null,
          model: raw.turbine?.model,
          manufacturer: raw.turbine?.manufacturer,
          rated_power_mw: raw.turbine?.rated_power_mw,
        },
        wind_farm: raw.turbine?.wind_farm ?? { id: '', name: '' },
        client: raw.turbine?.wind_farm?.client ?? { id: '', name: '', nip: null },
      }

      setInspection(flattened)

      // Fetch inspection elements
      const { data: elementsData, error: elementsError } = await supabase
        .from('inspection_elements')
        .select(
          `
          id,
          condition_rating,
          wear_percentage,
          notes,
          recommendations,
          photo_numbers,
          detailed_description,
          is_not_applicable,
          usage_suitability,
          recommendation_completion_date,
          definition:element_definition_id (
            id,
            element_number,
            section_code,
            name_pl,
            scope_annual,
            scope_five_year_additional,
            applicable_standards
          )
        `
        )
        .eq('inspection_id', id)

      if (elementsError) throw elementsError

      if (elementsData && elementsData.length === 0) {
        await createElementsFromDefinitions(id)
        await fetchInspectionElements(id)
      } else {
        // Sort po `element_number` (z joined definition). Wcześniej order
        // szedł po `element_definition_id` (UUID) → kolejność wyświetlania
        // była pseudolosowa, np. 14, 11, 1, 10, 8, 9, 15, 6, 13, 3, 18, 4, 17.
        // Uwaga Artura 2026-05-12: "numeracja nie po kolei".
        setElements(
          (elementsData || [])
            .map((el: any) => ({
              id: el.id,
              element_number: el.definition?.element_number ?? 0,
              condition_rating: el.condition_rating ?? null,
              wear_percentage: el.wear_percentage ?? 0,
              notes: el.notes ?? null,
              recommendations: el.recommendations ?? null,
              photo_numbers: el.photo_numbers ?? null,
              detailed_description: el.detailed_description ?? null,
              not_applicable: el.is_not_applicable ?? false,
              usage_suitability: el.usage_suitability ?? null,
              recommendation_completion_date: el.recommendation_completion_date ?? null,
              definition: {
                id: el.definition?.id ?? '',
                name_pl: el.definition?.name_pl ?? '',
                section_code: el.definition?.section_code ?? null,
                scope_annual: el.definition?.scope_annual ?? null,
                scope_five_year_additional:
                  el.definition?.scope_five_year_additional ?? null,
                applicable_standards: el.definition?.applicable_standards ?? null,
              },
            }))
            .sort((a, b) => a.element_number - b.element_number)
        )
      }

      // Fetch inspectors
      const { data: inspectorsData, error: inspectorsError } = await supabase
        .from('inspection_inspectors')
        .select(
          `
          inspector:inspector_id (
            id,
            full_name,
            license_number,
            specialty
          )
        `
        )
        .eq('inspection_id', id)

      if (inspectorsError) throw inspectorsError

      setInspectors(
        inspectorsData?.map((item: any) => item.inspector).filter(Boolean) || []
      )

      // Tomasz pkt 5: pobierz flage czy serwis trafia do protokolu
      const { data: svcData, error: svcErr } = await supabase
        .from('service_info')
        .select('id, include_in_protocol')
        .eq('inspection_id', id)
        .maybeSingle()
      if (!svcErr && svcData) {
        setServiceInfoId(svcData.id)
        setServiceIncludeInProtocol(svcData.include_in_protocol ?? false)
      }
    } catch (err) {
      console.error('Error fetching inspection:', err)
      setError('Błąd podczas wczytywania inspekcji')
    } finally {
      setLoading(false)
    }
  }

  // Tomasz pkt 5: toggle czy serwis trafia do PDF/DOCX
  const handleToggleServiceInProtocol = async (checked: boolean) => {
    setServiceIncludeInProtocol(checked)
    const supabase = createClient()
    if (serviceInfoId) {
      const { error } = await supabase
        .from('service_info')
        .update({ include_in_protocol: checked })
        .eq('id', serviceInfoId)
      if (error) {
        console.error('[ServiceIncludeToggle] update failed:', error)
        // Rollback UI gdy fail
        setServiceIncludeInProtocol(!checked)
      }
    } else if (inspection) {
      // Pierwsze ustawienie - utworz wpis service_info z sama flaga
      const { data, error } = await supabase
        .from('service_info')
        .insert({ inspection_id: inspection.id, include_in_protocol: checked })
        .select('id')
        .single()
      if (!error && data) setServiceInfoId(data.id)
      else {
        console.error('[ServiceIncludeToggle] insert failed:', error)
        setServiceIncludeInProtocol(!checked)
      }
    }
  }

  const fetchInspectionElements = async (inspectionId: string) => {
    const supabase = createClient()
    const { data: elementsData, error: elementsError } = await supabase
      .from('inspection_elements')
      .select(
        `
        id,
        condition_rating,
        wear_percentage,
        notes,
        recommendations,
        photo_numbers,
        detailed_description,
        is_not_applicable,
        usage_suitability,
        recommendation_completion_date,
        definition:element_definition_id (
          id,
          element_number,
          section_code,
          name_pl,
          scope_annual,
          scope_five_year_additional,
          applicable_standards
        )
      `
      )
      .eq('inspection_id', inspectionId)

    if (!elementsError && elementsData) {
      // Sort po `element_number` (z joined definition). PostgREST nie wspiera
      // order po polach joined, więc sort client-side. Bez tego kolejność
      // jest pseudolosowa (insertion order = UUID).
      setElements(
        elementsData
          .map((el: any) => ({
            id: el.id,
            element_number: el.definition?.element_number ?? 0,
            condition_rating: el.condition_rating ?? null,
            wear_percentage: el.wear_percentage ?? 0,
            notes: el.notes ?? null,
            recommendations: el.recommendations ?? null,
            photo_numbers: el.photo_numbers ?? null,
            detailed_description: el.detailed_description ?? null,
            not_applicable: el.is_not_applicable ?? false,
            usage_suitability: el.usage_suitability ?? null,
            recommendation_completion_date: el.recommendation_completion_date ?? null,
            definition: {
              id: el.definition?.id ?? '',
              name_pl: el.definition?.name_pl ?? '',
              section_code: el.definition?.section_code ?? null,
              scope_annual: el.definition?.scope_annual ?? null,
              scope_five_year_additional:
                el.definition?.scope_five_year_additional ?? null,
              applicable_standards: el.definition?.applicable_standards ?? null,
            },
          }))
          .sort((a, b) => a.element_number - b.element_number)
      )
    }
  }

  const createElementsFromDefinitions = async (inspectionId: string) => {
    const supabase = createClient()

    // Pobierz typ inspekcji + flagi opcjonalnych elementów per-turbina:
    // - poz. 17 „Stacja kontenerowa pomiarowa" → turbines.has_measurement_station
    // - poz. 18 „Panele fotowoltaiczne (instalacja PV)" → turbines.has_pv_panels
    //   (2 turbiny na FW Działoszyn, decyzja Waldka 2026-05-13)
    const { data: inspMeta } = await supabase
      .from('inspections')
      .select('inspection_type, turbines(has_measurement_station, has_pv_panels)')
      .eq('id', inspectionId)
      .single<{
        inspection_type: 'annual' | 'five_year'
        turbines: {
          has_measurement_station: boolean | null
          has_pv_panels: boolean | null
        } | null
      }>()

    const isFiveYear = inspMeta?.inspection_type === 'five_year'
    const hasStation = inspMeta?.turbines?.has_measurement_station === true
    const hasPvPanels = inspMeta?.turbines?.has_pv_panels === true

    // Filtr: aktywne (PIIB) definicje pasujące do typu inspekcji
    let query = supabase
      .from('inspection_element_definitions')
      .select('id, section_code')
      .eq('is_active', true)

    query = isFiveYear ? query.eq('applies_to_five_year', true) : query.eq('applies_to_annual', true)

    const { data: definitions } = await query

    if (definitions) {
      const elementsToCreate = definitions
        .filter((def) => def.section_code !== 'stacja_pomiarowa' || hasStation)
        .filter((def) => def.section_code !== 'panele_pv' || hasPvPanels)
        .map((def) => ({
          inspection_id: inspectionId,
          element_definition_id: def.id,
          condition_rating: null,
          wear_percentage: null,
          notes: null,
          is_not_applicable: false,
        }))
      await supabase.from('inspection_elements').insert(elementsToCreate)
    }
  }

  const handleElementUpdate = (elementId: string, data: Partial<InspectionElement>) => {
    setElements((prev) =>
      prev.map((el) =>
        el.id === elementId ? ({ ...el, ...data } as InspectionElementWithDef) : el
      )
    )
    if (elementSaveTimer.current) clearTimeout(elementSaveTimer.current)
    elementSaveTimer.current = setTimeout(async () => {
      const supabase = createClient()
      setSaving(true)
      try {
        // Map not_applicable → is_not_applicable for the DB column name
        const dbData: Record<string, unknown> = { ...data }
        if ('not_applicable' in dbData) {
          dbData.is_not_applicable = dbData.not_applicable
          delete dbData.not_applicable
        }
        await supabase.from('inspection_elements').update(dbData).eq('id', elementId)
      } catch (err) {
        console.error('Error saving element:', err)
      } finally {
        setSaving(false)
      }
    }, 500)
  }

  const handleInspectionChange = (field: string, value: unknown) => {
    // Freeze: gdy inspekcja jest 'signed', jedyna zmiana którą dopuszczamy
    // to przejście statusu na inny (żeby user mógł odblokować). Pozostałe
    // pola są zablokowane do edycji.
    if (
      isInspectionLocked(inspection?.status) &&
      !(field === 'status' && value !== 'signed')
    ) {
      return
    }
    setInspection((prev) => {
      if (!prev) return prev
      return { ...prev, [field]: value }
    })
    if (inspectionSaveTimer.current) clearTimeout(inspectionSaveTimer.current)
    inspectionSaveTimer.current = setTimeout(async () => {
      const supabase = createClient()
      setSaving(true)
      try {
        await supabase.from('inspections').update({ [field]: value }).eq('id', id)
      } catch (err) {
        console.error('Error saving inspection:', err)
      } finally {
        setSaving(false)
      }
    }, 500)
  }

  // Appenduje tekst zalecenia (juz z prefixem `[Element N — Nazwa]: ...`) do
  // pola "Ocena ogólna stanu technicznego" w tabie Wnioski. Wywolywane przez
  // przycisk "Kopiuj do Wnioskow" w ElementCard (Artur pkt 3c).
  const handleCopyRecommendationToConclusions = (text: string) => {
    const current = (inspection?.overall_assessment || '').trimEnd()
    const next = current ? `${current}\n\n${text}` : text
    handleInspectionChange('overall_assessment', next)
  }

  /**
   * Manualny zapis: czyści debouncery rodzica + odczekuje 1000 ms żeby
   * debouncery dzieci (PreviousRecommendations / RepairScope / Metryczka /
   * ElectricalMeasurements / AttachmentsList — wszystkie 500–800 ms) zdążyły
   * zapisać. Zwraca dopiero po dograniu.
   *
   * Auto-save robi już to samo w tle, ale przyciski „Zapisz" / „Zapisz
   * i zamknij" dają inspektorowi pewność że nic nie pominął przed wyjściem
   * lub przekazaniem protokołu.
   */
  const flushAndSave = async () => {
    setManualSaving('saving')
    if (inspectionSaveTimer.current) clearTimeout(inspectionSaveTimer.current)
    if (elementSaveTimer.current) clearTimeout(elementSaveTimer.current)
    // Czekamy 1000 ms — dłużej niż najdłuższy child debounce (800 ms).
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  const handleManualSave = async () => {
    await flushAndSave()
    setManualSaving('done')
    setTimeout(() => setManualSaving('idle'), 1500)
  }

  const handleSaveAndExit = async () => {
    await flushAndSave()
    router.push('/inspekcje')
  }

  const filteredElements = showOnlyNotes
    ? elements.filter((el) => el.notes && el.notes.trim())
    : elements

  if (loading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!inspection) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>Inspekcja nie znaleziona</AlertDescription>
      </Alert>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  const elementIds = elements.map((el) => ({
    id: el.id,
    name: el.definition.name_pl,
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-graphite-100 pb-6">
        <div className="flex justify-between items-start gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-graphite-900 mb-2">
              <span className="font-mono">
                {inspection.turbine?.ew_designation || inspection.turbine?.turbine_code}
              </span>
              {' — '}{inspection.wind_farm?.name}
            </h1>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <Label
                  htmlFor="header-protocol-number"
                  className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400"
                >
                  Nr protokołu
                </Label>
                <Input
                  id="header-protocol-number"
                  value={inspection.protocol_number || ''}
                  onChange={(e) =>
                    handleInspectionChange(
                      'protocol_number',
                      e.target.value || null,
                    )
                  }
                  placeholder="np. 003/P/2026"
                  className="font-mono font-medium h-8 text-[13px] mt-1"
                />
              </div>
              <div>
                <Label
                  htmlFor="header-inspection-date"
                  className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400"
                >
                  Data kontroli
                </Label>
                <Input
                  id="header-inspection-date"
                  type="date"
                  value={inspection.inspection_date?.slice(0, 10) || ''}
                  onChange={(e) =>
                    handleInspectionChange(
                      'inspection_date',
                      e.target.value || null,
                    )
                  }
                  className="font-mono font-medium h-8 text-[13px] mt-1"
                />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400">Turbina</p>
                <p className="font-medium text-graphite-800 text-[13px]">
                  {inspection.turbine?.manufacturer} {inspection.turbine?.model}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-graphite-400">Klient</p>
                <p className="font-medium text-graphite-800 text-[13px]">{inspection.client?.name}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              className="gap-2 border-graphite-200"
              onClick={() => void handleManualSave()}
              disabled={manualSaving === 'saving'}
            >
              {manualSaving === 'saving' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Zapisuję…
                </>
              ) : manualSaving === 'done' ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-success-700" />
                  Zapisano
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Zapisz
                </>
              )}
            </Button>
            <Button
              variant="outline"
              className="gap-2 border-graphite-200"
              onClick={() => void handleSaveAndExit()}
              disabled={manualSaving === 'saving'}
            >
              <ArrowLeft className="h-4 w-4" />
              Zapisz i zamknij
            </Button>
            <Button
              className="gap-2"
              onClick={() =>
                window.open(`/api/pdf/${inspection.id}`, '_blank')
              }
            >
              <Download className="h-4 w-4" />
              Generuj PDF
            </Button>
            <Button
              variant="outline"
              className="gap-2 border-graphite-200"
              onClick={() => window.open(`/api/docx/${inspection.id}`, '_blank')}
            >
              <FileText className="h-4 w-4" />
              Generuj DOCX
            </Button>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <StatusBar
        status={inspection.status}
        onStatusChange={(status) => handleInspectionChange('status', status)}
        inspectionId={inspection.id}
      />

      {/* Freeze banner — protokoły podpisane (signed) są read-only.
          StatusBar zostaje aktywny, żeby user mógł odblokować zmieniając status. */}
      {isInspectionLocked(inspection.status) && (
        <Alert className="border-warning-200 bg-warning-50">
          <AlertCircle className="h-4 w-4 text-warning-700" />
          <AlertDescription>
            <p className="font-semibold text-warning-900 mb-1">
              {LOCKED_BANNER_TITLE}
            </p>
            <p className="text-warning-800 text-sm">{LOCKED_BANNER_BODY}</p>
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs — wrapper z pointer-events:none gdy inspekcja podpisana.
          To zapobiega klikalności wszystkich inputów/buttonów wewnątrz;
          guard backendowy w save funkcjach dodatkowo zabezpiecza przed
          obejściem przez devtools. PDF/DOCX generowanie zostaje aktywne
          bo nie modyfikuje danych (jest poza Tabs, w nagłówku). */}
      <Tabs
        defaultValue="elementy"
        className={
          'w-full' +
          (isInspectionLocked(inspection.status)
            ? ' pointer-events-none opacity-60 select-none'
            : '')
        }
        aria-disabled={isInspectionLocked(inspection.status)}
      >
        {/* pointer-events-auto: przełączanie tabów ma działać nawet w trybie locked. */}
        <TabsList className="flex w-full lg:w-auto overflow-x-auto pointer-events-auto opacity-100">
          <TabsTrigger value="metryczka">Metryczka</TabsTrigger>
          <TabsTrigger value="elementy">Elementy</TabsTrigger>
          <TabsTrigger value="serwis">Serwis</TabsTrigger>
          {inspection.inspection_type === 'five_year' && (
            <TabsTrigger value="pomiary">Pomiary</TabsTrigger>
          )}
          <TabsTrigger value="zalecenia">Zalecenia</TabsTrigger>
          <TabsTrigger value="zdjecia">Zdjęcia</TabsTrigger>
          {inspection.inspection_type === 'five_year' && (
            <TabsTrigger value="wymagania">Wymagania</TabsTrigger>
          )}
          <TabsTrigger value="wnioski">Wnioski</TabsTrigger>
        </TabsList>

        {/* Tab: Metryczka PIIB (NEW) */}
        <TabsContent value="metryczka" className="space-y-4">
          <h2 className="text-[15px] font-bold text-graphite-900">
            Metryczka obiektu (PIIB)
          </h2>
          <p className="text-sm text-graphite-500">
            Dane wprowadzane do nagłówka protokołu PIIB: adres obiektu,
            właściciel, zarządca, wykonawca kontroli, dokumenty do wglądu.
          </p>
          <InspectionMetadataPiib
            inspectionId={inspection.id}
            inspectionType={inspection.inspection_type}
            inspectionStatus={inspection.status}
          />
        </TabsContent>

        {/* Tab: Elements */}
        <TabsContent value="elementy" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-[15px] font-bold text-graphite-900">Elementy do inspekcji</h2>
            <label className="flex items-center gap-2 text-sm text-graphite-700 cursor-pointer">
              <input
                type="checkbox"
                checked={showOnlyNotes}
                onChange={(e) => setShowOnlyNotes(e.target.checked)}
                className="rounded"
              />
              Pokaż tylko z uwagami
            </label>
          </div>

          {/* Bulk-status bar — szybkie ustawienie oceny dla wszystkich elementów,
              z pominięciem N/D. Operuje na pełnej liście, nie na filtrze. */}
          <BulkStatusBar
            title="Ustaw ocenę dla wszystkich elementów"
            hint={'Szybkie wstępne uzupełnienie. Po kliknięciu możesz zmienić ocenę poszczególnych elementów ręcznie. Pomija „Nie dotyczy".'}
            elements={elements.map((el) => ({
              id: el.id,
              value: el.condition_rating,
              not_applicable: el.not_applicable,
            }))}
            field="condition_rating"
            options={CONDITION_BULK_OPTIONS}
            onApplied={(updates) => {
              setElements((prev) =>
                prev.map((el) => {
                  const u = updates.find((x) => x.id === el.id)
                  return u
                    ? { ...el, condition_rating: u.value as ConditionRating | null }
                    : el
                }),
              )
            }}
          />

          {/* Bulk-status dla "Przydatność do użytkowania" — tylko 5-letni (PIIB sekcja III). */}
          {inspection.inspection_type === 'five_year' && (
            <BulkStatusBar
              title="Ustaw przydatność do użytkowania dla wszystkich"
              hint={'Pole 5-letnie wg art. 62 ust. 1 pkt 2 PB. Pomija elementy „Nie dotyczy".'}
              elements={elements.map((el) => ({
                id: el.id,
                value: el.usage_suitability,
                not_applicable: el.not_applicable,
              }))}
              field="usage_suitability"
              options={USAGE_BULK_OPTIONS}
              onApplied={(updates) => {
                setElements((prev) =>
                  prev.map((el) => {
                    const u = updates.find((x) => x.id === el.id)
                    return u
                      ? {
                          ...el,
                          usage_suitability: u.value as
                            | 'spelnia'
                            | 'nie_spelnia'
                            | null,
                        }
                      : el
                  }),
                )
              }}
            />
          )}

          <div className="space-y-4">
            {(() => {
              const maxPhotoNumber = allPhotos.reduce(
                (max, p) => Math.max(max, p.photo_number ?? 0),
                0,
              )
              return filteredElements.map((element) => (
                <ElementCard
                  key={element.id}
                  element={element}
                  inspectionType={inspection.inspection_type}
                  photos={allPhotos.filter((p) => p.element_id === element.id)}
                  inspectionId={inspection.id}
                  maxPhotoNumber={maxPhotoNumber}
                  onUpdate={(data) => handleElementUpdate(element.id, data)}
                  onPhotosChanged={() => void refreshPhotos()}
                  onCopyToConclusions={handleCopyRecommendationToConclusions}
                />
              ))
            })()}
          </div>

          {filteredElements.length === 0 && (
            <Alert>
              <AlertDescription>
                Brak elementów do wyświetlenia
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        {/* Tab: Service */}
        <TabsContent value="serwis" className="space-y-4">
          <h2 className="text-[15px] font-bold text-graphite-900">Historia serwisowania</h2>

          {/* Tomasz pkt 5: toggle czy sekcja trafia do PDF/DOCX */}
          <div className="rounded-xl border border-graphite-200 bg-white p-4 flex items-start gap-3">
            <Checkbox
              id="include-service-in-protocol"
              checked={serviceIncludeInProtocol}
              onCheckedChange={(c) => handleToggleServiceInProtocol(c === true)}
              className="mt-0.5"
            />
            <div className="flex-1">
              <Label htmlFor="include-service-in-protocol" className="text-base font-semibold cursor-pointer">
                Uwzględnij sekcję „Serwis" w protokole
              </Label>
              <p className="text-xs text-graphite-500 mt-1">
                Zaznacz jeśli masz dane serwisowe (z protokołów ekipy serwisowej lub własnych obserwacji).
                Odznacz, jeśli serwis ma zostać pominięty w PDF/DOCX (np. brak danych od operatora).
              </p>
            </div>
          </div>

          <div className={!serviceIncludeInProtocol ? 'opacity-60' : ''}>
            <ServiceChecklist inspectionId={inspection.id} />
          </div>
        </TabsContent>

        {/* Tab: Measurements (only for 5-year) */}
        {inspection.inspection_type === 'five_year' && (
          <TabsContent value="pomiary" className="space-y-4">
            <h2 className="text-[15px] font-bold text-graphite-900">Pomiary elektryczne</h2>
            <ElectricalMeasurements inspectionId={inspection.id} />
          </TabsContent>
        )}

        {/* Tab: Repairs (PIIB sekcja II + IV/VI) */}
        <TabsContent value="zalecenia" className="space-y-6">
          <h2 className="text-[15px] font-bold text-graphite-900">
            Zalecenia i ocena realizacji
          </h2>

          {/* PIIB sekcja II — Sprawdzenie wykonania zaleceń z poprzednich kontroli */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-graphite-700 uppercase tracking-wide">
              II. Sprawdzenie wykonania zaleceń z poprzednich kontroli
            </h3>
            <PreviousRecommendationsTable
              inspectionId={inspection.id}
              turbineId={inspection.turbine?.id}
              inspectionDate={inspection.inspection_date}
              inspectionStatus={inspection.status}
            />
            <EmergencyStateTable inspectionId={inspection.id} />
          </div>

          {/* PIIB sekcja IV/VI — Zakres robót remontowych */}
          <div className="space-y-4 border-t border-graphite-200 pt-6">
            <h3 className="text-sm font-semibold text-graphite-700 uppercase tracking-wide">
              {inspection.inspection_type === 'five_year' ? 'VI' : 'IV'}.
              Zalecenia (zakres robót remontowych)
            </h3>
            <RepairScopeTable
              inspectionId={inspection.id}
              inspectionDate={inspection.inspection_date}
            />
          </div>

          {/* Legacy: stary RepairTable (NG/NB/K + I-IV) — collapsible dla dawnych inspekcji */}
          <details className="border-t border-graphite-200 pt-6">
            <summary className="cursor-pointer text-sm text-graphite-500 hover:text-graphite-700">
              Pokaż legacy zalecenia (NG/NB/K + pilność I-IV) — dla starych inspekcji
            </summary>
            <div className="mt-4">
              <RepairTable inspectionId={inspection.id} elements={elementIds} />
            </div>
          </details>
        </TabsContent>

        {/* Tab: Photos — zachowane jako widok zbiorczy galerii.
            Per-element widok jest w karcie elementu (Krok 3). */}
        <TabsContent value="zdjecia" className="space-y-4">
          <h2 className="text-[15px] font-bold text-graphite-900">Zdjęcia</h2>
          <PhotoGallery inspectionId={inspection.id} elements={elementIds} />
        </TabsContent>

        {/* Tab: Wymagania art. 5 PB (PIIB sekcja VI, tylko 5-letni) */}
        {inspection.inspection_type === 'five_year' && (
          <TabsContent value="wymagania" className="space-y-4">
            <h2 className="text-[15px] font-bold text-graphite-900">
              Wymagania podstawowe (art. 5 Prawa Budowlanego)
            </h2>
            <p className="text-sm text-graphite-500">
              Sekcja obowiązkowa dla kontroli 5-letniej. 7 wymagań z art. 5 PB
              jest auto-utworzonych przy pierwszym otwarciu — wystarczy
              zaznaczyć ocenę dla każdego wymagania.
            </p>
            <BasicRequirementsArt5 inspectionId={inspection.id} />
          </TabsContent>
        )}

        {/* Tab: Assessment & Conclusions */}
        <TabsContent value="wnioski" className="space-y-6">
          <h2 className="text-[15px] font-bold text-graphite-900">Wnioski i ocena</h2>

          <div className="grid gap-6">
            {/* Overall Condition Rating */}
            <div className="space-y-2">
              <Label htmlFor="rating">Ocena ogólna stanu technicznego</Label>
              <Select
                value={inspection.overall_condition_rating || 'none'}
                onValueChange={(value) =>
                  handleInspectionChange('overall_condition_rating', value === 'none' ? null : value)
                }
              >
                <SelectTrigger id="rating">
                  <SelectValue placeholder="Wybierz ocenę" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— brak oceny —</SelectItem>
                  {Object.entries(CONDITION_RATINGS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Overall Assessment */}
            <div className="space-y-2">
              <Label htmlFor="assessment">Ocena ogólna stanu technicznego</Label>
              <Textarea
                id="assessment"
                placeholder="Wpisz ocenę ogólną..."
                value={inspection.overall_assessment || ''}
                onChange={(e) =>
                  handleInspectionChange('overall_assessment', e.target.value)
                }
                rows={4}
              />
            </div>

            {/* Hazard Information */}
            <div className="space-y-2">
              <Label htmlFor="hazard">Informacja o zagrożeniach</Label>
              <Textarea
                id="hazard"
                placeholder="Opis zagrożeń i rekomendacji bezpieczeństwa..."
                value={inspection.hazard_information || ''}
                onChange={(e) =>
                  handleInspectionChange('hazard_information', e.target.value)
                }
                rows={4}
              />
            </div>

            {/* Pkt 6 zakresu kontroli — instalacje ochrony środowiska */}
            <div className="space-y-2">
              <Label htmlFor="env-protection">
                Stan techniczny instalacji ochrony środowiska{' '}
                <span className="text-xs text-graphite-500">
                  (pkt 6 zakresu kontroli)
                </span>
              </Label>
              <Textarea
                id="env-protection"
                placeholder="W trakcie kontroli dokonano przeglądu instalacji i urządzeń służących ochronie środowiska (instalacja odgromowa, oświetlenie nawigacyjne). Nie stwierdzono uchybień ani odstępstw od wymagań ochrony środowiska."
                value={inspection.environmental_protection_findings || ''}
                onChange={(e) =>
                  handleInspectionChange(
                    'environmental_protection_findings',
                    e.target.value
                  )
                }
                rows={3}
              />
            </div>

            {/* Pkt 7 zakresu kontroli — weryfikacja dokumentacji */}
            <div className="space-y-2">
              <Label htmlFor="doc-verification">
                Weryfikacja kompletności i aktualności dokumentów{' '}
                <span className="text-xs text-graphite-500">
                  (pkt 7 zakresu kontroli)
                </span>
              </Label>
              <Textarea
                id="doc-verification"
                placeholder="Zweryfikowano kompletność i aktualność dokumentów obiektu: Książka Obiektu Budowlanego (KOB), protokoły serwisowe, protokoły pomiarów elektrycznych, certyfikaty UDT urządzeń podlegających kontroli. Dokumentacja kompletna i aktualna."
                value={inspection.documentation_verification_findings || ''}
                onChange={(e) =>
                  handleInspectionChange(
                    'documentation_verification_findings',
                    e.target.value
                  )
                }
                rows={3}
              />
            </div>

            {/* Pkt 8.6 wzorca PIIB — metody i środki użytkowania */}
            <div className="space-y-2">
              <Label htmlFor="weather-exposure">
                Metody i środki użytkowania elementów narażonych na szkodliwe
                wpływy atmosferyczne{' '}
                <span className="text-xs text-graphite-500">
                  (pkt 8.6 wzorca; dla turbin zwykle „Nie dotyczy")
                </span>
              </Label>
              <Textarea
                id="weather-exposure"
                placeholder="Nie dotyczy."
                value={inspection.weather_exposure_methods || ''}
                onChange={(e) =>
                  handleInspectionChange(
                    'weather_exposure_methods',
                    e.target.value
                  )
                }
                rows={2}
              />
            </div>

            {/* Inspection Dates */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="next-annual">Następna kontrola roczna</Label>
                <Input
                  id="next-annual"
                  type="date"
                  value={inspection.next_annual_date?.split('T')[0] || ''}
                  onChange={(e) =>
                    handleInspectionChange('next_annual_date', e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="next-five-year">
                  Następna kontrola 5-letnia
                </Label>
                <Input
                  id="next-five-year"
                  type="date"
                  value={inspection.next_five_year_date?.split('T')[0] || ''}
                  onChange={(e) =>
                    handleInspectionChange('next_five_year_date', e.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="next-electrical">
                  Następna kontrola instalacji elektrycznej
                </Label>
                <Input
                  id="next-electrical"
                  type="date"
                  value={inspection.next_electrical_date?.split('T')[0] || ''}
                  onChange={(e) =>
                    handleInspectionChange('next_electrical_date', e.target.value)
                  }
                />
              </div>
            </div>

            {/* Inspector Signature */}
            <div className="border-t border-graphite-100 pt-4 space-y-4">
              <h3 className="font-semibold text-graphite-900">Podpis inspektora</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sig-location">Miejsce podpisu</Label>
                  <Input
                    id="sig-location"
                    placeholder="Miejscowość"
                    value={inspection.inspector_signature_location || ''}
                    onChange={(e) =>
                      handleInspectionChange(
                        'inspector_signature_location',
                        e.target.value
                      )
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sig-date">Data podpisu</Label>
                  <Input
                    id="sig-date"
                    type="date"
                    value={inspection.inspector_signature_date?.split('T')[0] || ''}
                    onChange={(e) =>
                      handleInspectionChange('inspector_signature_date', e.target.value)
                    }
                  />
                </div>
              </div>
            </div>

            {/* Owner Representative + signature date */}
            <div className="border-t border-graphite-100 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="owner-rep">
                    Imię i nazwisko reprezentanta właściciela
                  </Label>
                  <Input
                    id="owner-rep"
                    placeholder="Imię i nazwisko"
                    value={inspection.owner_representative_name || ''}
                    onChange={(e) =>
                      handleInspectionChange(
                        'owner_representative_name',
                        e.target.value
                      )
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="owner-sig-date">Data podpisu właściciela</Label>
                  <Input
                    id="owner-sig-date"
                    type="date"
                    value={
                      inspection.owner_signature_date?.split('T')[0] || ''
                    }
                    onChange={(e) =>
                      handleInspectionChange(
                        'owner_signature_date',
                        e.target.value
                      )
                    }
                  />
                  <p className="text-xs text-graphite-500">
                    Po wypełnieniu obu dat podpisu (inspektora i właściciela)
                    protokół automatycznie przejdzie na status{' '}
                    <span className="font-semibold">Podpisana</span> i stanie
                    się widoczny w portalu klienta.
                  </p>
                </div>
              </div>
            </div>

            {/* PIIB sekcja VII/VIII — Załączniki do protokołu */}
            <div className="border-t border-graphite-100 pt-6 space-y-2">
              <h3 className="font-semibold text-graphite-900">
                Załączniki do protokołu (PIIB sekcja VII/VIII)
              </h3>
              <p className="text-sm text-graphite-500">
                Lista załączników wymienianych na końcu protokołu (np.
                protokoły pomiarowe, dokumentacja zdjęciowa, certyfikaty).
              </p>
              <AttachmentsList inspectionId={inspection.id} />
            </div>

            {/* Save indicator */}
            {saving && (
              <Alert>
                <AlertDescription>Zapisywanie...</AlertDescription>
              </Alert>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
