import { CreateRoutineForm } from "@/components/CreateRoutineForm";
import { DeleteRoutineButton } from "@/components/DeleteRoutineButton";
import { LogSetsPanel } from "@/components/LogSetsPanel";
import { getCompetitionBoard } from "@/lib/competition";
import { getFriendIds, requireUser } from "@/lib/friends";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function RutinasPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const routines = await prisma.routine.findMany({
    where: { userId: user.id },
    include: {
      exercises: {
        orderBy: { orderIndex: "asc" },
        include: {
          setLogs: {
            where: { userId: user.id },
            orderBy: { performedAt: "desc" },
            take: 12,
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const friendIds = await getFriendIds(user.id);
  const board = await getCompetitionBoard(user.id, friendIds);
  const rivalByExercise = Object.fromEntries(
    board.map((b) => [b.exerciseName, b.leaderboard]),
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-accent">Tu entrenamiento</p>
          <h1 className="font-display text-5xl sm:text-6xl">Mis rutinas</h1>
          <p className="mt-2 max-w-xl text-muted">
            Crea tu plan, anota series y peso, y mira cuánto te falta para superar a tus amigos.
          </p>
        </div>
        <CreateRoutineForm />
      </div>

      {routines.length === 0 ? (
        <div className="panel rounded-2xl p-8 text-center">
          <p className="font-display text-3xl">Aún no tienes rutinas</p>
          <p className="mt-2 text-muted">Crea la primera y empieza a competir.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {routines.map((routine) => (
            <section key={routine.id} className="panel animate-rise rounded-2xl p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  {routine.dayLabel && (
                    <p className="text-xs uppercase tracking-[0.2em] text-accent">
                      {routine.dayLabel}
                    </p>
                  )}
                  <h2 className="font-display text-4xl">{routine.name}</h2>
                  {routine.description && (
                    <p className="mt-1 text-sm text-muted">{routine.description}</p>
                  )}
                </div>
                <DeleteRoutineButton routineId={routine.id} />
              </div>

              <div className="mt-5 space-y-4">
                {routine.exercises.map((ex) => (
                  <LogSetsPanel
                    key={ex.id}
                    exerciseId={ex.id}
                    exerciseName={ex.name}
                    targetSets={ex.targetSets}
                    targetReps={ex.targetReps}
                    recentLogs={ex.setLogs.map((l) => ({
                      setNumber: l.setNumber,
                      reps: l.reps,
                      weightKg: l.weightKg,
                      performedAt: l.performedAt.toISOString(),
                    }))}
                    rivals={rivalByExercise[ex.name] ?? []}
                    meId={user.id}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
