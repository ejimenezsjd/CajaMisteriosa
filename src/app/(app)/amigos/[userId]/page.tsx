import { getPrsForExerciseName } from "@/lib/competition";
import { areFriends, getFriendIds, requireUser } from "@/lib/friends";
import { prisma } from "@/lib/prisma";
import { ExerciseGuideCard } from "@/components/ExerciseGuideCard";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

type Props = { params: Promise<{ userId: string }> };

export default async function FriendRoutinePage({ params }: Props) {
  const me = await requireUser();
  if (!me) redirect("/login");

  const { userId } = await params;
  if (!(await areFriends(me.id, userId))) {
    redirect("/amigos");
  }

  const friend = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, displayName: true },
  });
  if (!friend) notFound();

  const routines = await prisma.routine.findMany({
    where: { userId },
    include: {
      exercises: {
        orderBy: { orderIndex: "asc" },
        include: {
          setLogs: {
            where: { userId },
            orderBy: { performedAt: "desc" },
            take: 8,
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const friendIds = await getFriendIds(me.id);
  const compareIds = [me.id, ...friendIds];
  const names = [...new Set(routines.flatMap((r) => r.exercises.map((e) => e.name)))];
  const rivals: Record<string, Awaited<ReturnType<typeof getPrsForExerciseName>>> = {};
  for (const name of names) {
    rivals[name] = await getPrsForExerciseName(name, compareIds);
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href="/amigos" className="text-sm text-muted hover:text-accent">
          ← Amigos
        </Link>
        <p className="mt-3 text-sm uppercase tracking-[0.2em] text-accent">
          @{friend.username}
        </p>
        <h1 className="font-display text-5xl sm:text-6xl">
          Rutina de {friend.displayName}
        </h1>
        <p className="mt-2 max-w-xl text-muted">
          Mira sus ejercicios y marcas. Luego ve a tus rutinas y supera su peso.
        </p>
      </div>

      {routines.length === 0 ? (
        <div className="panel rounded-2xl p-8 text-center text-muted">
          Este amigo aún no ha publicado rutinas.
        </div>
      ) : (
        routines.map((routine) => (
          <section key={routine.id} className="panel rounded-2xl p-5 sm:p-6">
            {routine.dayLabel && (
              <p className="text-xs uppercase tracking-[0.2em] text-accent">
                {routine.dayLabel}
              </p>
            )}
            <h2 className="font-display text-4xl">{routine.name}</h2>
            {routine.description && (
              <p className="mt-1 text-sm text-muted">{routine.description}</p>
            )}

            <div className="mt-5 space-y-4">
              {routine.exercises.map((ex) => {
                const board = rivals[ex.name] ?? [];
                const friendPr = board.find((r) => r.userId === friend.id);
                const myPr = board.find((r) => r.userId === me.id);
                const ahead =
                  friendPr && myPr
                    ? myPr.weightKg > friendPr.weightKg
                      ? "winning"
                      : myPr.weightKg < friendPr.weightKg
                        ? "behind"
                        : "tie"
                    : null;

                return (
                  <div
                    key={ex.id}
                    className="rounded-xl border border-line bg-bg-soft/40 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-display text-2xl">{ex.name}</h3>
                        <p className="text-sm text-muted">
                          {ex.targetSets} series × {ex.targetReps} reps
                        </p>
                      </div>
                      <div className="text-right text-sm">
                        {friendPr ? (
                          <div>
                            <span className="text-muted">Su PR </span>
                            <span className="font-display text-xl text-ink">
                              {friendPr.weightKg} kg
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted">Sin marcas aún</span>
                        )}
                        {myPr && (
                          <div className="text-muted">
                            Tú: {myPr.weightKg} kg
                            {ahead === "winning" && (
                              <span className="ml-2 text-accent">vas delante</span>
                            )}
                            {ahead === "behind" && (
                              <span className="ml-2 text-warn">te supera</span>
                            )}
                            {ahead === "tie" && (
                              <span className="ml-2 text-muted">empate</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4">
                      <ExerciseGuideCard exerciseName={ex.name} compact />
                    </div>

                    {ex.setLogs.length > 0 && (
                      <ul className="mt-3 space-y-1 text-sm text-muted">
                        {ex.setLogs.slice(0, 5).map((log) => (
                          <li key={log.id}>
                            Serie {log.setNumber}: {log.reps} reps × {log.weightKg} kg
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}

      <Link href="/rutinas" className="btn btn-primary inline-flex">
        Ir a mi rutina a superarlos
      </Link>
    </div>
  );
}
