"use client";

import { useRouter } from "next/navigation";

export function DeleteRoutineButton({ routineId }: { routineId: string }) {
  const router = useRouter();

  async function onDelete() {
    if (!confirm("¿Eliminar esta rutina y sus series?")) return;
    await fetch(`/api/routines/${routineId}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <button type="button" className="btn btn-danger text-xs" onClick={onDelete}>
      Eliminar
    </button>
  );
}
