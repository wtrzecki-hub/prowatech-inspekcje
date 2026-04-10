'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TurbineInspectionForm, type TurbineOption, type ElementDefinition, type DefectLibraryItem } from '@/components/forms/turbine-inspection-form'
import { Skeleton } from '@/components/ui/skeleton'

export default function NewInspectionPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6 p-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    }>
      <NewInspectionContent />
    </Suspense>
  )
}

function NewInspectionContent() {
  const searchParams = useSearchParams()
  const preselectedTurbineId = searchParams.get('turbine_id')

  const [turbines, setTurbines]                   = useState<TurbineOption[]>([])
  const [elementDefinitions, setElementDefinitions] = useState<ElementDefinition[]>([])
  const [defectLibrary, setDefectLibrary]           = useState<DefectLibraryItem[]>([])
  const [selectedTurbine, setSelectedTurbine]     = useState<TurbineOption | null>(null)
  const [inspectorName, setInspectorName]         = useState('')
  const [inspectors, setInspectors]               = useState<Array<{ id: string; full_name: string; license_number: string; specialty: string; chamber_membership: string; email: string; phone: string }>>([])
  const [loading, setLoading]                     = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const supabase = createClient()

    const [turbinesRes, defsRes, sessionRes, inspectorsRes, defectsRes] = await Promise.all([
      supabase
        .from('turbines')
        .select('id, turbine_code, serial_number, manufacturer, model, location_address, rated_power_mw, hub_height_m, wind_farm_id, wind_farms(name)')
        .not('is_deleted', 'is', true)
        .order('turbine_code'),
      supabase
        .from('inspection_element_definitions')
        .select('id, element_number, section_code, name_pl, name_short')
        .eq('is_active', true)
        .order('sort_order'),
      supabase.auth.getSession(),
      supabase
        .from('inspectors')
        .select('id, full_name, license_number, specialty, chamber_membership, email, phone')
        .not('is_deleted', 'is', true)
        .eq('is_active', true)
        .order('full_name'),
      supabase
        .from('defect_library')
        .select('code, category, name_pl, recommendation_template, typical_urgency')
        .eq('is_active', true)
        .order('category')
        .order('name_pl'),
    ])

    if (turbinesRes.data) setTurbines(turbinesRes.data as unknown as TurbineOption[])
    if (defsRes.data)     setElementDefinitions(defsRes.data)
    if (inspectorsRes.data) setInspectors(inspectorsRes.data as typeof inspectors)
    if (defectsRes.data) setDefectLibrary(defectsRes.data as DefectLibraryItem[])

    if (sessionRes.data.session) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', sessionRes.data.session.user.id)
        .single()
      if (profile) setInspectorName(profile.full_name || '')
    }

    if (preselectedTurbineId && turbinesRes.data) {
      const found = (turbinesRes.data as unknown as TurbineOption[]).find((t) => t.id === preselectedTurbineId)
      if (found) setSelectedTurbine(found)
    }

    setLoading(false)
  }

  if (loading) {
    return (
      <div className="space-y-6 p-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  return (
    <div className="pb-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Nowa inspekcja</h1>
        <p className="text-muted-foreground mt-2">
          Protokół kontroli technicznej turbiny wiatrowej
        </p>
      </div>

      <TurbineInspectionForm
        turbines={turbines}
        elementDefinitions={elementDefinitions}
        preselectedTurbine={selectedTurbine}
        inspectorName={inspectorName}
        inspectors={inspectors}
        defectLibrary={defectLibrary}
      />
    </div>
  )
}
