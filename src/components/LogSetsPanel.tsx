"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ExerciseGuideCard } from "@/components/ExerciseGuideCard";

type Rival = {
  userId: string;
  displayName: string;
  weightKg: number;
  reps: number;
};

type Props = {
  exerciseId: string;
  exerciseName: string;
  targetSets: number;
  targetReps: number;
  recentLogs: Array<{ setNumber: number; reps: number; weightKg: number; performedAt: string }>;
  rivals?: Rival[];
  meId?: string;
};

export function LogSetsPanel({
  exerciseId,
  exerciseName,
  targetSets,
  targetReps,
  recentLogs,
  rivals = [],
  meId,
}: Props) {
  const router = useRouter();
  const [setNumber, setSetNumber] = useState(1);
  const [reps, setReps] = useState(targetReps);
  const [weightKg, setWeightKg] = useState(60);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const topRival = rivals.find((r) => r.userId !== meId);
  const myPr = rivals.find((r) => r.userId === meId);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    const res = await fetch("/api/lifts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exerciseId, setNumber, reps, weightKg }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMessage(data.error ?? "Error al guardar");
      return;
    }
    setMessage(data.challenge ?? "Serie guardada");
    if (setNumber < targetSets) setSetNumber(setNumber + 1);
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-line bg-bg-soft/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl text-ink">{exerciseName}</h3>
          <p className="text-sm text-muted">
            Objetivo: {targetSets} × {targetReps}
          </p>
        </div>
        {topRival && (
          <div className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-sm">
            <div className="text-xs uppercase tracking-wider text-accent">A superar</div>
            <div className="font-medium">
              {topRival.displayName}: {topRival.weightKg} kg × {topRival.reps}
            </div>
            {myPr && (
              <div className="text-xs text-muted">
                Tu PR: {myPr.weightKg} kg × {myPr.reps}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-4">
        <ExerciseGuideCard exerciseName={exerciseName} />
      </div>

      <form onSubmit={onSubmit} className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="text-xs text-muted">
          Serie
          <input
            className="input mt-1"
            type="number"
            min={1}
            value={setNumber}
            onChange={(e) => setSetNumber(Number(e.target.value))}
          />
        </label>
        <label className="text-xs text-muted">
          Reps
          <input
            className="input mt-1"
            type="number"
            min={1}
            value={reps}
            onChange={(e) => setReps(Number(e.target.value))}
          />
        </label>
        <label className="text-xs text-muted">
          Peso (kg)
          <input
            className="input mt-1"
            type="number"
            min={0}
            step={0.5}
            value={weightKg}
            onChange={(e) => setWeightKg(Number(e.target.value))}
          />
        </label>
        <div className="flex items-end">
          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? "…" : "Anotar"}
          </button>
        </div>
      </form>

      {message && <p className="mt-3 text-sm text-accent">{message}</p>}

      {recentLogs.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="pb-2 pr-3 font-medium">Serie</th>
                <th className="pb-2 pr-3 font-medium">Reps</th>
                <th className="pb-2 pr-3 font-medium">Peso</th>
                <th className="pb-2 font-medium">Cuándo</th>
              </tr>
            </thead>
            <tbody>
              {recentLogs.slice(0, 6).map((log, i) => (
                <tr key={i} className="border-t border-line/70">
                  <td className="py-2 pr-3">{log.setNumber}</td>
                  <td className="py-2 pr-3">{log.reps}</td>
                  <td className="py-2 pr-3">{log.weightKg} kg</td>
                  <td className="py-2 text-muted">
                    {new Date(log.performedAt).toLocaleString("es", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
