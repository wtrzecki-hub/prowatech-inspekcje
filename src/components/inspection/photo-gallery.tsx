'use client'

import { useEffect, useRef, useState } from 'react'
import { Edit2, Plus, Trash2, Image as ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { createBrowserClient } from '@supabase/ssr'

interface Photo {
  id: string
  inspection_id: string
  photo_number: number
  photo_url: string | null
  description: string | null
  element_id: string | null
  element_name: string | null
}

interface Element {
  id: string
  name: string
}

interface PhotoGalleryProps {
  inspectionId: string
  elements?: Element[]
}

export function PhotoGallery({ inspectionId, elements = [] }: PhotoGalleryProps) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [filterElement, setFilterElement] = useState<string>('')
  const [formData, setFormData] = useState({
    photo_url: '',
    photo_number: '',
    description: '',
    element_id: '',
    element_name: '',
  })
  const [maxPhotoNumber, setMaxPhotoNumber] = useState(0)

  useEffect(() => {
    loadPhotos()
  }, [inspectionId])

  const loadPhotos = async () => {
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const { data, error } = await supabase
        .from('inspection_photos')
        .select('*')
        .eq('inspection_id', inspectionId)
        .order('photo_number', { ascending: true })

      if (error) throw error

      const sortedPhotos = data || []
      setPhotos(sortedPhotos)

      if (sortedPhotos.length > 0) {
        setMaxPhotoNumber(Math.max(...sortedPhotos.map((p) => p.photo_number)))
      }
    } catch (error) {
      console.error('Błąd podczas ładowania zdjęć:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenDialog = (photo?: Photo) => {
    if (photo) {
      setEditingId(photo.id)
      setFormData({
        photo_url: photo.photo_url || '',
        photo_number: photo.photo_number.toString(),
        description: photo.description || '',
        element_id: photo.element_id || '',
        element_name: photo.element_name || '',
      })
    } else {
      setEditingId(null)
      setFormData({
        photo_url: '',
        photo_number: (maxPhotoNumber + 1).toString(),
        description: '',
        element_id: '',
        element_name: '',
      })
    }
    setDialogOpen(true)
  }

  const handleElementChange = (elementId: string) => {
    const selected = elements.find((e) => e.id === elementId)
    setFormData({
      ...formData,
      element_id: elementId,
      element_name: selected?.name || '',
    })
  }

  const handleSavePhoto = async () => {
    if (!formData.photo_url.trim()) {
      return
    }

    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const photoData = {
        photo_url: formData.photo_url,
        photo_number: parseInt(formData.photo_number) || maxPhotoNumber + 1,
        description: formData.description || null,
        element_id: formData.element_id || null,
        element_name: formData.element_name || null,
      }

      if (editingId) {
        const { error } = await supabase
          .from('inspection_photos')
          .update(photoData)
          .eq('id', editingId)

        if (error) throw error

        setPhotos(
          photos
            .map((p) => (p.id === editingId ? { ...p, ...photoData } : p))
            .sort((a, b) => a.photo_number - b.photo_number)
        )
      } else {
        const { data, error } = await supabase
          .from('inspection_photos')
          .insert([{ inspection_id: inspectionId, ...photoData }])
          .select()
          .single()

        if (error) throw error

        const newPhotos = [...photos, data].sort(
          (a, b) => a.photo_number - b.photo_number
        )
        setPhotos(newPhotos)
        setMaxPhotoNumber(photoData.photo_number)
      }

      setDialogOpen(false)
    } catch (error) {
      console.error('Błąd przy zapisywaniu zdjęcia:', error)
    }
  }

  const handleDeletePhoto = async (id: string) => {
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )

      const { error } = await supabase
        .from('inspection_photos')
        .delete()
        .eq('id', id)

      if (error) throw error

      setPhotos(photos.filter((p) => p.id !== id))
    } catch (error) {
      console.error('Błąd przy usuwaniu zdjęcia:', error)
    }
  }

  const filteredPhotos = filterElement
    ? photos.filter((p) => p.element_id === filterElement)
    : photos

  if (isLoading) {
    return (
      <div className="text-center py-8 text-gray-500">
        Ładowanie galerii zdjęć...
      </div>
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Galeria zdjęć</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Button
              onClick={() => handleOpenDialog()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus size={18} className="mr-2" />
              Dodaj zdjęcie
            </Button>

            {elements.length > 0 && (
              <Select value={filterElement} onValueChange={setFilterElement}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filtruj po elemencie..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Wszystkie elementy</SelectItem>
                  {elements.map((el) => (
                    <SelectItem key={el.id} value={el.id}>
                      {el.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {filteredPhotos.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <ImageIcon size={48} className="mx-auto mb-3 opacity-50" />
              <p>
                {filterElement
                  ? 'Brak zdjęć dla wybranego elementu'
                  : 'Brak zdjęć. Kliknij przycisk powyżej, aby dodać nowe.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPhotos.map((photo) => (
                <div
                  key={photo.id}
                  className="border rounded-lg overflow-hidden bg-gray-50 hover:shadow-lg transition"
                >
                  {/* Photo Thumbnail */}
                  <div className="aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
                    {photo.photo_url ? (
                      <img
                        src={photo.photo_url}
                        alt={`Zdjęcie ${photo.photo_number}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <ImageIcon
                        size={48}
                        className="text-gray-400 opacity-50"
                      />
                    )}
                  </div>

                  {/* Photo Info */}
                  <div className="p-3 space-y-2">
                    <div className="font-semibold text-sm">
                      Zdjęcie nr {photo.photo_number}
                    </div>

                    {photo.description && (
                      <p className="text-xs text-gray-700 line-clamp-2">
                        {photo.description}
                      </p>
                    )}

                    {photo.element_name && (
                      <div className="text-xs bg-blue-50 text-blue-700 rounded px-2 py-1">
                        {photo.element_name}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDialog(photo)}
                        className="flex-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      >
                        <Edit2 size={14} className="mr-1" />
                        Edytuj
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeletePhoto(photo.id)}
                        className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 size={14} className="mr-1" />
                        Usuń
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Edytuj zdjęcie' : 'Dodaj nowe zdjęcie'}
            </DialogTitle>
            <DialogDescription>
              Uzupełnij szczegóły zdjęcia inspeksji.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="photo-number" className="font-medium">
                  Numer zdjęcia
                </Label>
                <Input
                  id="photo-number"
                  type="number"
                  min="1"
                  value={formData.photo_number}
                  onChange={(e) =>
                    setFormData({ ...formData, photo_number: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="photo-element" className="font-medium">
                  Przypisz do elementu
                </Label>
                <Select
                  value={formData.element_id}
                  onValueChange={handleElementChange}
                >
                  <SelectTrigger id="photo-element">
                    <SelectValue placeholder="Wybierz element (opcjonalnie)" />
                  </SelectTrigger>
                  <SelectContent>
                    {elements.map((el) => (
                      <SelectItem key={el.id} value={el.id}>
                        {el.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="photo-url" className="font-medium">
                URL zdjęcia (wymagane)
              </Label>
              <Input
                id="photo-url"
                placeholder="https://example.com/photo.jpg"
                value={formData.photo_url}
                onChange={(e) =>
                  setFormData({ ...formData, photo_url: e.target.value })
                }
              />
              <p className="text-xs text-gray-500">
                Wstaw bezpośredni adres URL do zdjęcia (jpg, png, itp.)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="photo-desc" className="font-medium">
                Opis zdjęcia
              </Label>
              <Textarea
                id="photo-desc"
                placeholder="Opis zawartości zdjęcia, istotne szczegóły..."
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
              />
            </div>

            {/* Preview */}
            {formData.photo_url && (
              <div className="space-y-2">
                <Label className="font-medium text-sm">Podgląd</Label>
                <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden border">
                  <img
                    src={formData.photo_url}
                    alt="Podgląd zdjęcia"
                    className="w-full h-full object-cover"
                    onError={() => {
                      console.error('Nie można załadować zdjęcia')
                    }}
                  />
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-end pt-4">
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Anuluj
              </Button>
              <Button
                onClick={handleSavePhoto}
                disabled={!formData.photo_url.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {editingId ? 'Zaktualizuj' : 'Dodaj'} zdjęcie
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
