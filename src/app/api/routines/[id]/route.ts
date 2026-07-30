import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { areFriends, requireUser } from "@/lib/friends";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const routine = await prisma.routine.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, username: true, displayName: true } },
      exercises: {
        orderBy: { orderIndex: "asc" },
        include: {
          setLogs: {
            orderBy: { performedAt: "desc" },
            take: 30,
            include: {
              user: { select: { id: true, username: true, displayName: true } },
            },
          },
        },
      },
    },
  });

  if (!routine) {
    return NextResponse.json({ error: "Rutina no encontrada" }, { status: 404 });
  }

  const allowed = await areFriends(user.id, routine.userId);
  if (!allowed) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  return NextResponse.json({ routine });
}

const updateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(280).optional().nullable(),
  dayLabel: z.string().trim().max(40).optional().nullable(),
});

export async function PATCH(request: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const routine = await prisma.routine.findUnique({ where: { id } });
  if (!routine || routine.userId !== user.id) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const updated = await prisma.routine.update({
    where: { id },
    data: parsed.data,
    include: { exercises: { orderBy: { orderIndex: "asc" } } },
  });

  return NextResponse.json({ routine: updated });
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const routine = await prisma.routine.findUnique({ where: { id } });
  if (!routine || routine.userId !== user.id) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  await prisma.routine.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
