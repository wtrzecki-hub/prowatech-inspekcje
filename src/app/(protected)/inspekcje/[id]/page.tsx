'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
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

import { StatusBar } from '@/components/inspection/status-bar'
import { ElementCard } from '@/components/inspection/element-card'
import { ServiceChecklist } from '@/components/inspection/service-checklist'
import { ElectricalMeasurements } from '@/components/inspection/electrical-measurements'
import { RepairTable } from '@/components/inspection/repair-table'
import { PhotoGallery } from '@/components/inspection/photo-gallery'

import {
  INSPECTION_STATUSES,
  INSPECTION_TYPES,
  CONDITION_RATINGS,
} from '@/lib/constants'
import { AlertCircle, Download } from 'lucide-react'

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
  next_annual_date: string | null
  next_five_year_date: string | null
  next_electrical_date: string | null
  inspector_signature_location: string | null
  inspector_signature_date: string | null
  owner_representative_name: string | null
  turbine: {
    id: string
    turbine_code: string
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
}

interface ElementDefinition {
  id: string
  name_pl: string
  scope_annual: string | null
  scope_five_year_additional: string | null
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
  const id = params.id as string

  const [inspection, setInspection] = useState<Inspection | null>(null)
  const [elements, setElements] = useState<InspectionElementWithDef[]>([])
  const [inspectors, setInspectors] = useState<Inspector[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showOnlyNotes, setShowOnlyNotes] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const elementSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inspectionSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetchInspectionData()
  }, [id])

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
          next_annual_date,
          next_five_year_date,
          next_electrical_date,
          inspector_signature_location,
          inspector_signature_date,
          owner_representative_name,
          turbine:turbine_id (
            id,
            turbine_code,
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
          definition:element_definition_id (
            id,
            element_number,
            name_pl,
            scope_annual,
            scope_five_year_additional
          )
        `
        )
        .eq('inspection_id', id)
        .order('element_definition_id', { ascending: true })

      if (elementsError) throw elementsError

      if (elementsData && elementsData.length === 0) {
        await createElementsFromDefinitions(id)
        await fetchInspectionElements(id)
      } else {
        setElements(
          (elementsData || []).map((el: any) => ({
            id: el.id,
            element_number: el.definition?.element_number ?? 0,
            condition_rating: el.condition_rating ?? null,
            wear_percentage: el.wear_percentage ?? 0,
            notes: el.notes ?? null,
            recommendations: el.recommendations ?? null,
            photo_numbers: el.photo_numbers ?? null,
            detailed_description: el.detailed_description ?? null,
            not_applicable: el.is_not_applicable ?? false,
            definition: {
              id: el.definition?.id ?? '',
              name_pl: el.definition?.name_pl ?? '',
              scope_annual: el.definition?.scope_annual ?? null,
              scope_five_year_additional: el.definition?.scope_five_year_additional ?? null,
            },
          }))
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
    } catch (err) {
      console.error('Error fetching inspection:', err)
      setError('Błąd podczas wczytywania inspekcji')
    } finally {
      setLoading(false)
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
        definition:element_definition_id (
          id,
          element_number,
          name_pl,
          scope_annual,
          scope_five_year_additional
        )
      `
      )
      .eq('inspection_id', inspectionId)

    if (!elementsError && elementsData) {
      setElements(
        elementsData.map((el: any) => ({
          id: el.id,
          element_number: el.definition?.element_number ?? 0,
          condition_rating: el.condition_rating ?? null,
          wear_percentage: el.wear_percentage ?? 0,
          notes: el.notes ?? null,
          recommendations: el.recommendations ?? null,
          photo_numbers: el.photo_numbers ?? null,
          detailed_description: el.detailed_description ?? null,
          not_applicable: el.is_not_applicable ?? false,
          definition: {
            id: el.definition?.id ?? '',
            name_pl: el.definition?.name_pl ?? '',
            scope_annual: el.definition?.scope_annual ?? null,
            scope_five_year_additional: el.definition?.scope_five_year_additional ?? null,
          },
        }))
      )
    }
  }

  const createElementsFromDefinitions = async (inspectionId: string) => {
    const supabase = createClient()
    const { data: definitions } = await supabase
      .from('inspection_element_definitions')
      .select('id')

    if (definitions) {
      const elementsToCreate = definitions.map((def) => ({
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
      <div className="border-b pb-6">
        <div className="flex justify-between items-start gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              {inspection.turbine?.turbine_code} - {inspection.wind_farm?.name}
            </h1>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Nr protokołu</p>
                <p className="font-medium">
                  {inspection.protocol_number || 'Brak'}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Data kontroli</p>
                <p className="font-medium">
                  {format(new Date(inspection.inspection_date), 'dd.MM.yyyy', {
                    locale: pl,
                  })}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Turbina</p>
                <p className="font-medium">
                  {inspection.turbine?.manufacturer} {inspection.turbine?.model}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Klient</p>
                <p className="font-medium">{inspection.client?.name}</p>
              </div>
            </div>
          </div>
          <Button
            className="gap-2"
            onClick={() =>
              window.open(`/api/pdf/${inspection.id}`, '_blank')
            }
          >
            <Download className="h-4 w-4" />
            Generuj PDF
          </Button>
        </div>
      </div>

      {/* Status Bar */}
      <StatusBar
        status={inspection.status}
        onStatusChange={(status) => handleInspectionChange('status', status)}
        inspectionId={inspection.id}
      />

      {/* Tabs */}
      <Tabs defaultValue="elementy" className="w-full">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto overflow-x-auto">
          <TabsTrigger value="elementy">Elementy</TabsTrigger>
          <TabsTrigger value="serwis">Serwis</TabsTrigger>
          {inspection.inspection_type === 'five_year' && (
            <TabsTrigger value="pomiary">Pomiary</TabsTrigger>
          )}
          <TabsTrigger value="zalecenia">Zalecenia</TabsTrigger>
          <TabsTrigger value="zdjecia">Zdjęcia</TabsTrigger>
          <TabsTrigger value="wnioski">Wnioski</TabsTrigger>
        </TabsList>

        {/* Tab: Elements */}
        <TabsContent value="elementy" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Elementy do inspekcji</h2>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showOnlyNotes}
                onChange={(e) => setShowOnlyNotes(e.target.checked)}
                className="rounded"
              />
              Pokaż tylko z uwagami
            </label>
          </div>

          <div className="space-y-4">
            {filteredElements.map((element) => (
              <ElementCard
                key={element.id}
                element={element}
                onUpdate={(data) => handleElementUpdate(element.id, data)}
              />
            ))}
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
          <h2 className="text-xl font-semibold">Historia serwisowania</h2>
          <ServiceChecklist inspectionId={inspection.id} />
        </TabsContent>

        {/* Tab: Measurements (only for 5-year) */}
        {inspection.inspection_type === 'five_year' && (
          <TabsContent value="pomiary" className="space-y-4">
            <h2 className="text-xl font-semibold">Pomiary elektryczne</h2>
            <ElectricalMeasurements inspectionId={inspection.id} />
          </TabsContent>
        )}

        {/* Tab: Repairs */}
        <TabsContent value="zalecenia" className="space-y-4">
          <h2 className="text-xl font-semibold">Zalecenia naprawcze</h2>
          <RepairTable inspectionId={inspection.id} elements={elementIds} />
        </TabsContent>

        {/* Tab: Photos */}
        <TabsContent value="zdjecia" className="space-y-4">
          <h2 className="text-xl font-semibold">Zdjęcia</h2>
          <PhotoGallery inspectionId={inspection.id} elements={elementIds} />
        </TabsContent>

        {/* Tab: Assessment & Conclusions */}
        <TabsContent value="wnioski" className="space-y-6">
          <h2 className="text-xl font-semibold">Wnioski i ocena</h2>

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
            <div className="border-t pt-4 space-y-4">
              <h3 className="font-semibold">Podpis inspektora</h3>

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

            {/* Owner Representative */}
            <div className="border-t pt-4 space-y-2">
              <Label htmlFor="owner-rep">Imię i nazwisko reprezentanta właściciela</Label>
              <Input
                id="owner-rep"
                placeholder="Imię i nazwisko"
                value={inspection.owner_representative_name || ''}
                onChange={(e) =>
                  handleInspectionChange('owner_representative_name', e.target.value)
                }
              />
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
