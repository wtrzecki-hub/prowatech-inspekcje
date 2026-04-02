'use client'

import { NewInspectionWizard } from '@/components/forms/new-inspection-wizard'

export default function NewInspectionPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Nowa inspekcja</h1>
        <p className="text-muted-foreground mt-2">
          Utwórz nową inspekcję techniczną turbiny wiatrowej
        </p>
      </div>

      <NewInspectionWizard />
    </div>
  )
}
