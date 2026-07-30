import { prisma } from "@/lib/prisma";

export type PrEntry = {
  userId: string;
  username: string;
  displayName: string;
  exerciseName: string;
  weightKg: number;
  reps: number;
  performedAt: string;
};

/** Best lift (max weight, then max reps) per user for a given exercise name. */
export async function getPrsForExerciseName(
  exerciseName: string,
  userIds: string[],
): Promise<PrEntry[]> {
  if (userIds.length === 0) return [];

  const logs = await prisma.setLog.findMany({
    where: {
      userId: { in: userIds },
      exercise: { name: { equals: exerciseName } },
    },
    include: {
      user: { select: { id: true, username: true, displayName: true } },
    },
    orderBy: [{ weightKg: "desc" }, { reps: "desc" }],
  });

  const bestByUser = new Map<string, PrEntry>();

  for (const log of logs) {
    if (bestByUser.has(log.userId)) continue;
    bestByUser.set(log.userId, {
      userId: log.user.id,
      username: log.user.username,
      displayName: log.user.displayName,
      exerciseName,
      weightKg: log.weightKg,
      reps: log.reps,
      performedAt: log.performedAt.toISOString(),
    });
  }

  return [...bestByUser.values()].sort((a, b) => {
    if (b.weightKg !== a.weightKg) return b.weightKg - a.weightKg;
    return b.reps - a.reps;
  });
}

export async function getCompetitionBoard(userId: string, friendIds: string[]) {
  const allIds = [userId, ...friendIds];

  const logs = await prisma.setLog.findMany({
    where: { userId: { in: allIds } },
    include: {
      user: { select: { id: true, username: true, displayName: true } },
      exercise: { select: { name: true } },
    },
    orderBy: [{ weightKg: "desc" }, { reps: "desc" }],
  });

  const key = (uid: string, name: string) => `${uid}::${name.toLowerCase()}`;
  const best = new Map<string, PrEntry>();

  for (const log of logs) {
    const k = key(log.userId, log.exercise.name);
    if (best.has(k)) continue;
    best.set(k, {
      userId: log.user.id,
      username: log.user.username,
      displayName: log.user.displayName,
      exerciseName: log.exercise.name,
      weightKg: log.weightKg,
      reps: log.reps,
      performedAt: log.performedAt.toISOString(),
    });
  }

  const byExercise = new Map<string, PrEntry[]>();
  for (const entry of best.values()) {
    const name = entry.exerciseName;
    const list = byExercise.get(name) ?? [];
    list.push(entry);
    byExercise.set(name, list);
  }

  return [...byExercise.entries()]
    .map(([exerciseName, entries]) => ({
      exerciseName,
      leaderboard: entries.sort((a, b) => {
        if (b.weightKg !== a.weightKg) return b.weightKg - a.weightKg;
        return b.reps - a.reps;
      }),
    }))
    .sort((a, b) => a.exerciseName.localeCompare(b.exerciseName, "es"));
}
