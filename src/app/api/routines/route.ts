import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/friends";

const exerciseSchema = z.object({
  name: z.string().trim().min(1).max(80),
  targetSets: z.number().int().min(1).max(20).default(3),
  targetReps: z.number().int().min(1).max(100).default(10),
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(280).optional().nullable(),
  dayLabel: z.string().trim().max(40).optional().nullable(),
  exercises: z.array(exerciseSchema).min(1).max(30),
});

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const routines = await prisma.routine.findMany({
    where: { userId: user.id },
    include: {
      exercises: {
        orderBy: { orderIndex: "asc" },
        include: {
          setLogs: {
            where: { userId: user.id },
            orderBy: { performedAt: "desc" },
            take: 20,
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ routines });
}

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }

  const { name, description, dayLabel, exercises } = parsed.data;

  const routine = await prisma.routine.create({
    data: {
      userId: user.id,
      name,
      description: description || null,
      dayLabel: dayLabel || null,
      exercises: {
        create: exercises.map((ex, index) => ({
          name: ex.name,
          targetSets: ex.targetSets,
          targetReps: ex.targetReps,
          orderIndex: index,
        })),
      },
    },
    include: {
      exercises: { orderBy: { orderIndex: "asc" } },
    },
  });

  return NextResponse.json({ routine }, { status: 201 });
}
