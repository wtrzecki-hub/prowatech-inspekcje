'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { format } from 'date-fns'
import { pl } from 'date-fns/locale'
import { debounce } from 'lodash-es'

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

interface Inspection {
  id: string
  protocol_number: string | null
  inspection_date: string
  inspection_type: 'annual' | 'five_year'
  status: string
  overall_condition_rating: number | null
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
    code: string
    model: string
    manufacturer: string
    power_output: number
  }
  wind_farm: {
    id: string
    name: string
    location: string
  }
  client: {
    id: string
    name: string
    nip: string | null
  }
}

interface InspectionElement {
  id: string
  element_definition_id: string
  inspection_id: string
  rating: number | null
  notes: string | null
  element_definition: {
    id: string
    name: string
    description: string | null
    category: string
  }
}

interface Inspector {
  id: string
  name: string
  license_number: string | null
  specialty: string | null
}

export default function InspectionDetailPage() {
  const params = useParams()
  const id = params.id as string

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [inspection, setInspection] = useState<Inspection | null>(null)
  const [elements, setElements] = useState<InspectionElement[]>([])
  const [inspectors, setInspectors] = useState<Inspector[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showOnlyNotes, setShowOnlyNotes] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchInspectionData()
  }, [id])

  const fetchInspectionData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch inspection with relations
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
          turbine:turbine_id (id, code, model, manufacturer, power_output),
          wind_farm:wind_farm_id (id, name, location),
          client:client_id (id, name, nip)
        `
        )
        .eq('id', id)
        .single()

      if (inspectionError) throw inspectionError

      setInspection(inspectionData)

      // Fetch inspection elements
      const { data: elementsData, error: elementsError } = await supabase
        .from('inspection_elements')
        .select(
          `
          id,
          element_definition_id,
          inspection_id,
          rating,
          notes,
          element_definition:element_definition_id (
            id,
            name,
            description,
            category
          )
        `
        )
        .eq('inspection_id', id)

      if (elementsError) throw elementsError

      if (elementsData && elementsData.length === 0) {
        // Create elements from definitions if none exist
        await createElementsFromDefinitions(id)
        fetchInspectionElements(id)
      } else {
        setElements(elementsData || [])
      }

      // Fetch inspectors
      const { data: inspectorsData, error: inspectorsError } = await supabase
        .from('inspection_inspectors')
        .select(
          `
          inspector:inspector_id (
            id,
            name,
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
    const { data: elementsData, error: elementsError } = await supabase
      .from('inspection_elements')
      .select(
        `
        id,
        element_definition_id,
        inspection_id,
        rating,
        notes,
        element_definition:element_definition_id (
          id,
          name,
          description,
          category
        )
      `
      )
      .eq('inspection_id', inspectionId)

    if (!elementsError && elementsData) {
      setElements(elementsData)
    }
  }

  const createElementsFromDefinitions = async (inspectionId: string) => {
    const { data: definitions } = await supabase
      .from('inspection_element_definitions')
      .select('id')

    if (definitions) {
      const elementsToCreate = definitions.map((def) => ({
        inspection_id: inspectionId,
        element_definition_id: def.id,
        rating: null,
        notes: null,
      }))

      await supabase.from('inspection_elements').insert(elementsToCreate)
    }
  }

  const debouncedSaveElement = useCallback(
    debounce(async (elementId: string, rating: number | null, notes: string | null) => {
      setSaving(true)
      try {
        await supabase
          .from('inspection_elements')
          .update({ rating, notes })
          .eq('id', elementId)
      } catch (err) {
        console.error('Error saving element:', err)
      } finally {
        setSaving(false)
      }
    }, 500),
    [supabase]
  )

  const handleElementChange = (
    elementId: string,
    rating: number | null,
    notes: string | null
  ) => {
    setElements((prevElements) =>
      prevElements.map((el) =>
        el.id === elementId ? { ...el, rating, notes } : el
      )
    )
    debouncedSaveElement(elementId, rating, notes)
  }

  const debouncedSaveInspection = useCallback(
    debounce(async (updates: Partial<Inspection>) => {
      setSaving(true)
      try {
        await supabase
          .from('inspections')
          .update(updates)
          .eq('id', id)
      } catch (err) {
        console.error('Error saving inspection:', err)
      } finally {
        setSaving(false)
      }
    }, 500),
    [supabase, id]
  )

  const handleInspectionChange = (field: string, value: any) => {
    setInspection((prev) => {
      if (!prev) return prev
      const updated = { ...prev, [field]: value }
      debouncedSaveInspection({ [field]: value })
      return updated
    })
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
    name: el.element_definition.name,
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b pb-6">
        <div className="flex justify-between items-start gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              {inspection.turbine.code} - {inspection.wind_farm.name}
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
                  {inspection.turbine.manufacturer} {inspection.turbine.model}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Klient</p>
                <p className="font-medium">{inspection.client.name}</p>
              </div>
            </div>
          </div>
          <Button
            asChild
            className="gap-2"
            onClick={() =>
              window.open(`/api/pdf/${inspection.id}`, '_blank')
            }
          >
            <div>
              <Download className="h-4 w-4" />
              Generuj PDF
            </div>
          </Button>
        </div>
      </div>

      {/* Status Bar */}
      <StatusBar inspectionId={inspection.id} currentStatus={inspection.status} />

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
                onChange={handleElementChange}
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
                value={inspection.overall_condition_rating?.toString() || ''}
                onValueChange={(value) =>
                  handleInspectionChange('overall_condition_rating', parseInt(value))
                }
              >
                <SelectTrigger id="rating">
                  <SelectValue placeholder="Wybierz ocenę" />
                </SelectTrigger>
                <SelectContent>
                  {CONDITION_RATINGS.map((rating) => (
                    <SelectItem key={rating.value} value={rating.value.toString()}>
                      {rating.label}
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
