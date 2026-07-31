"use client";

import Image from "next/image";
import { useState } from "react";
import { findExerciseGuide } from "@/lib/exerciseCatalog";

type Props = {
  exerciseName: string;
  compact?: boolean;
};

export function ExerciseGuideCard({ exerciseName, compact = false }: Props) {
  const guide = findExerciseGuide(exerciseName);
  const [open, setOpen] = useState(!compact);

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-bg/50">
      <div className={`grid gap-0 ${open ? "sm:grid-cols-[minmax(0,220px)_1fr]" : ""}`}>
        <div className="relative aspect-[4/3] bg-bg-soft sm:min-h-[140px]">
          <Image
            src={guide.image}
            alt={`Demostración: ${guide.name}`}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 220px"
          />
        </div>

        {open && (
          <div className="flex flex-col justify-center gap-2 p-3 sm:p-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-accent">
                Cómo ejecutarlo
              </p>
              <p className="mt-1 text-sm text-ink">{guide.summary}</p>
              <p className="mt-1 text-xs text-muted">Músculos: {guide.muscles}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium text-accent">Claves</p>
                <ul className="mt-1 space-y-1 text-xs text-muted">
                  {guide.cues.map((cue) => (
                    <li key={cue} className="flex gap-2">
                      <span className="text-accent">▸</span>
                      <span>{cue}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-medium text-warn">Evita</p>
                <ul className="mt-1 space-y-1 text-xs text-muted">
                  {guide.avoid.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="text-warn">▸</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        className="flex w-full items-center justify-between border-t border-line px-3 py-2 text-left text-xs text-muted transition hover:text-accent"
        onClick={() => setOpen((v) => !v)}
      >
        <span>{open ? "Ocultar técnica" : "Ver imagen y técnica"}</span>
        <span className="text-accent">{open ? "−" : "+"}</span>
      </button>
    </div>
  );
}
