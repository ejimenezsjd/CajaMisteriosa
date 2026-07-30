"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type ExerciseDraft = {
  name: string;
  targetSets: number;
  targetReps: number;
};

export function CreateRoutineForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [dayLabel, setDayLabel] = useState("");
  const [description, setDescription] = useState("");
  const [exercises, setExercises] = useState<ExerciseDraft[]>([
    { name: "", targetSets: 3, targetReps: 10 },
  ]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(
    () => name.trim() && exercises.every((e) => e.name.trim()),
    [name, exercises],
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError("");
    const res = await fetch("/api/routines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        dayLabel: dayLabel || null,
        description: description || null,
        exercises,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "No se pudo crear");
      return;
    }
    setOpen(false);
    setName("");
    setDayLabel("");
    setDescription("");
    setExercises([{ name: "", targetSets: 3, targetReps: 10 }]);
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
        + Nueva rutina
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="panel animate-rise rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl">Nueva rutina</h2>
          <p className="text-sm text-muted">Añade ejercicios y objetivos.</p>
        </div>
        <button type="button" className="btn btn-ghost text-sm" onClick={() => setOpen(false)}>
          Cerrar
        </button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="text-sm sm:col-span-1">
          <span className="mb-1 block text-muted">Nombre</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted">Día (opcional)</span>
          <input
            className="input"
            placeholder="Lunes"
            value={dayLabel}
            onChange={(e) => setDayLabel(e.target.value)}
          />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-muted">Descripción</span>
          <input
            className="input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
      </div>

      <div className="mt-5 space-y-3">
        <p className="text-sm font-medium text-ink">Ejercicios</p>
        {exercises.map((ex, index) => (
          <div key={index} className="grid gap-2 rounded-xl border border-line bg-bg-soft/50 p-3 sm:grid-cols-[1fr_5rem_5rem_auto]">
            <input
              className="input"
              placeholder="Press banca"
              value={ex.name}
              onChange={(e) => {
                const next = [...exercises];
                next[index] = { ...ex, name: e.target.value };
                setExercises(next);
              }}
              required
            />
            <input
              className="input"
              type="number"
              min={1}
              value={ex.targetSets}
              onChange={(e) => {
                const next = [...exercises];
                next[index] = { ...ex, targetSets: Number(e.target.value) };
                setExercises(next);
              }}
              title="Series"
            />
            <input
              className="input"
              type="number"
              min={1}
              value={ex.targetReps}
              onChange={(e) => {
                const next = [...exercises];
                next[index] = { ...ex, targetReps: Number(e.target.value) };
                setExercises(next);
              }}
              title="Reps"
            />
            <button
              type="button"
              className="btn btn-ghost text-sm"
              disabled={exercises.length === 1}
              onClick={() => setExercises(exercises.filter((_, i) => i !== index))}
            >
              Quitar
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-ghost text-sm"
          onClick={() =>
            setExercises([...exercises, { name: "", targetSets: 3, targetReps: 10 }])
          }
        >
          + Ejercicio
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      <button type="submit" className="btn btn-primary mt-5" disabled={loading || !canSubmit}>
        {loading ? "Guardando…" : "Guardar rutina"}
      </button>
    </form>
  );
}
