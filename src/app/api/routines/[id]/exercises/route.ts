import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/friends";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  targetSets: z.number().int().min(1).max(20).default(3),
  targetReps: z.number().int().min(1).max(100).default(10),
});

export async function POST(request: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const routine = await prisma.routine.findUnique({
    where: { id },
    include: { exercises: true },
  });

  if (!routine || routine.userId !== user.id) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const exercise = await prisma.exercise.create({
    data: {
      routineId: id,
      name: parsed.data.name,
      targetSets: parsed.data.targetSets,
      targetReps: parsed.data.targetReps,
      orderIndex: routine.exercises.length,
    },
  });

  return NextResponse.json({ exercise }, { status: 201 });
}
