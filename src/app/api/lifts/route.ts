import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getFriendIds, requireUser } from "@/lib/friends";
import { getPrsForExerciseName } from "@/lib/competition";

const schema = z.object({
  exerciseId: z.string().min(1),
  setNumber: z.number().int().min(1).max(30),
  reps: z.number().int().min(1).max(200),
  weightKg: z.number().min(0).max(1000),
});

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }

  const exercise = await prisma.exercise.findUnique({
    where: { id: parsed.data.exerciseId },
    include: { routine: true },
  });

  if (!exercise || exercise.routine.userId !== user.id) {
    return NextResponse.json(
      { error: "Solo puedes anotar series en tu propia rutina" },
      { status: 403 },
    );
  }

  const setLog = await prisma.setLog.create({
    data: {
      userId: user.id,
      exerciseId: parsed.data.exerciseId,
      setNumber: parsed.data.setNumber,
      reps: parsed.data.reps,
      weightKg: parsed.data.weightKg,
    },
  });

  const friendIds = await getFriendIds(user.id);
  const rivals = await getPrsForExerciseName(exercise.name, [
    user.id,
    ...friendIds,
  ]);

  const myPr = rivals.find((r) => r.userId === user.id);
  const topRival = rivals.find((r) => r.userId !== user.id);
  let challenge: string | null = null;

  if (topRival && myPr) {
    if (myPr.weightKg > topRival.weightKg) {
      challenge = `¡Nuevo récord! Superaste a ${topRival.displayName} (${topRival.weightKg} kg).`;
    } else if (myPr.weightKg === topRival.weightKg && myPr.reps > topRival.reps) {
      challenge = `Empate en peso con ${topRival.displayName}, pero más reps. ¡Vas ganando!`;
    } else if (myPr.weightKg < topRival.weightKg) {
      const gap = +(topRival.weightKg - myPr.weightKg).toFixed(1);
      challenge = `Te faltan ${gap} kg para superar a ${topRival.displayName}.`;
    } else {
      challenge = `Empate con ${topRival.displayName} en ${topRival.weightKg} kg.`;
    }
  }

  return NextResponse.json({ setLog, rivals, challenge }, { status: 201 });
}

export async function GET(request: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const exerciseId = searchParams.get("exerciseId");

  if (!exerciseId) {
    return NextResponse.json({ error: "exerciseId requerido" }, { status: 400 });
  }

  const exercise = await prisma.exercise.findUnique({
    where: { id: exerciseId },
    include: { routine: true },
  });

  if (!exercise) {
    return NextResponse.json({ error: "Ejercicio no encontrado" }, { status: 404 });
  }

  const friendIds = await getFriendIds(user.id);
  const canView =
    exercise.routine.userId === user.id ||
    friendIds.includes(exercise.routine.userId);

  if (!canView) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  const logs = await prisma.setLog.findMany({
    where: { exerciseId },
    orderBy: { performedAt: "desc" },
    take: 50,
    include: {
      user: { select: { id: true, username: true, displayName: true } },
    },
  });

  const rivals = await getPrsForExerciseName(exercise.name, [
    user.id,
    ...friendIds,
  ]);

  return NextResponse.json({ logs, rivals, exercise });
}
