"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { createClient } from "@/lib/supabase/client";
import { CONDITION_RATINGS_ACTIVE } from "@/lib/constants";
import type { DefectRow } from "@/app/(protected)/biblioteka-defektow/page";

const URGENCY_OPTIONS = [
  { value: "I", label: "I — Najwyższa (krytyczna)" },
  { value: "II", label: "II — Wysoka" },
  { value: "III", label: "III — Średnia" },
  { value: "IV", label: "IV — Niska" },
];

const CATEGORY_NEW = "__new__";

interface DefectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defect: DefectRow | null;
  existingCategories: string[];
  onSaved: (defect: DefectRow, isNew: boolean) => void;
}

export function DefectFormDialog({
  open,
  onOpenChange,
  defect,
  existingCategories,
  onSaved,
}: DefectFormDialogProps) {
  const isEditing = defect !== null;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [categoryMode, setCategoryMode] = useState<"existing" | "new">(
    existingCategories.length > 0 ? "existing" : "new"
  );
  const [category, setCategory] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [namePl, setNamePl] = useState("");
  const [description, setDescription] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [typicalRating, setTypicalRating] = useState<string>("none");
  const [typicalUrgency, setTypicalUrgency] = useState<string>("none");
  const [elementSection, setElementSection] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (defect) {
      setCode(defect.code);
      setCategoryMode("existing");
      setCategory(defect.category);
      setNewCategory("");
      setNamePl(defect.name_pl);
      setDescription(defect.description_template || "");
      setRecommendation(defect.recommendation_template || "");
      setTypicalRating(defect.typical_rating || "none");
      setTypicalUrgency(defect.typical_urgency || "none");
      setElementSection(defect.element_section || "");
      setIsActive(defect.is_active);
    } else {
      setCode(suggestNextCode(existingCategories));
      setCategoryMode(existingCategories.length > 0 ? "existing" : "new");
      setCategory(existingCategories[0] || "");
      setNewCategory("");
      setNamePl("");
      setDescription("");
      setRecommendation("");
      setTypicalRating("none");
      setTypicalUrgency("none");
      setElementSection("");
      setIsActive(true);
    }
    setError(null);
  }, [defect, open, existingCategories]);

  const handleSave = async () => {
    setError(null);

    const trimmedCode = code.trim().toUpperCase();
    const finalCategory =
      categoryMode === "new" ? newCategory.trim() : category.trim();

    if (!trimmedCode) {
      setError("Kod defektu jest wymagany.");
      return;
    }
    if (!finalCategory) {
      setError("Kategoria jest wymagana.");
      return;
    }
    if (!namePl.trim()) {
      setError("Nazwa defektu jest wymagana.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const now = new Date().toISOString();

    const payload = {
      code: trimmedCode,
      category: finalCategory,
      name_pl: namePl.trim(),
      description_template: description.trim() || null,
      recommendation_template: recommendation.trim() || null,
      typical_rating: typicalRating === "none" ? null : typicalRating,
      typical_urgency: typicalUrgency === "none" ? null : typicalUrgency,
      element_section: elementSection.trim() || null,
      is_active: isActive,
      updated_at: now,
    };

    if (isEditing && defect) {
      const { data, error: err } = await supabase
        .from("defect_library")
        .update(payload)
        .eq("id", defect.id)
        .select()
        .single();
      setSaving(false);
      if (err) {
        setError(err.message);
        return;
      }
      if (data) onSaved(data as DefectRow, false);
    } else {
      const { data, error: err } = await supabase
        .from("defect_library")
        .insert(payload)
        .select()
        .single();
      setSaving(false);
      if (err) {
        // Częsty błąd: duplikat kodu (UNIQUE constraint)
        if (err.code === "23505") {
          setError(`Defekt o kodzie "${trimmedCode}" już istnieje.`);
        } else {
          setError(err.message);
        }
        return;
      }
      if (data) onSaved(data as DefectRow, true);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edytuj defekt" : "Dodaj nowy defekt"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? `Modyfikujesz wpis ${defect?.code}.`
              : "Defekt pojawi się w pickerze formularza inspekcji."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Kod */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <Label htmlFor="code">Kod *</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="REC-245"
                className="font-mono"
                disabled={isEditing}
              />
              {isEditing && (
                <p className="text-xs text-graphite-500 mt-1">
                  Kod nie podlega edycji.
                </p>
              )}
            </div>
            <div className="col-span-2">
              <Label htmlFor="element-section">Sekcja elementu (opcjonalnie)</Label>
              <Input
                id="element-section"
                value={elementSection}
                onChange={(e) => setElementSection(e.target.value)}
                placeholder="np. Łopaty, Gondola, Wieża"
              />
            </div>
          </div>

          {/* Kategoria */}
          <div>
            <Label>Kategoria *</Label>
            <div className="flex gap-2">
              <Select
                value={categoryMode === "existing" ? category : CATEGORY_NEW}
                onValueChange={(v) => {
                  if (v === CATEGORY_NEW) {
                    setCategoryMode("new");
                  } else {
                    setCategoryMode("existing");
                    setCategory(v);
                  }
                }}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Wybierz kategorię" />
                </SelectTrigger>
                <SelectContent>
                  {existingCategories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                  <SelectItem value={CATEGORY_NEW}>
                    + Nowa kategoria
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {categoryMode === "new" && (
              <Input
                className="mt-2"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="Wpisz nazwę nowej kategorii"
              />
            )}
          </div>

          {/* Nazwa */}
          <div>
            <Label htmlFor="name-pl">Nazwa defektu *</Label>
            <Input
              id="name-pl"
              value={namePl}
              onChange={(e) => setNamePl(e.target.value)}
              placeholder="np. Pęknięcie powłoki łopaty"
            />
          </div>

          {/* Opis */}
          <div>
            <Label htmlFor="description">Opis (szablon)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Standardowy opis defektu, który pojawi się w protokole. Można edytować w trakcie inspekcji."
              rows={3}
            />
          </div>

          {/* Zalecenie */}
          <div>
            <Label htmlFor="recommendation">Zalecenie (szablon)</Label>
            <Textarea
              id="recommendation"
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value)}
              placeholder="Standardowe zalecenie remontowe. Można edytować w trakcie inspekcji."
              rows={3}
            />
          </div>

          {/* Typowa ocena + pilność */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Typowa ocena</Label>
              <Select value={typicalRating} onValueChange={setTypicalRating}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— brak —</SelectItem>
                  {CONDITION_RATINGS_ACTIVE.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Typowa pilność</Label>
              <Select value={typicalUrgency} onValueChange={setTypicalUrgency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— brak —</SelectItem>
                  {URGENCY_OPTIONS.map((u) => (
                    <SelectItem key={u.value} value={u.value}>
                      {u.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Aktywny */}
          <div className="flex items-center gap-2 pt-2">
            <Checkbox
              id="is-active"
              checked={isActive}
              onCheckedChange={(v) => setIsActive(v === true)}
            />
            <Label htmlFor="is-active" className="cursor-pointer font-normal">
              Aktywny — pokaż w pickerze formularza inspekcji
            </Label>
          </div>

          {error && (
            <div className="rounded-lg border border-danger-100 bg-danger-50 p-3 text-sm text-danger-800">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Anuluj
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? "Zapisz zmiany" : "Dodaj defekt"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function suggestNextCode(_categories: string[]): string {
  // Fallback — w UI uzupełni się tylko jeśli user kliknie "Dodaj" bez znajomości najwyższego kodu.
  // Numerację REC-NNN robimy od ręki — niech UI to zasugeruje, ale user może zmienić.
  return "REC-";
}
