import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/friends";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  action: z.enum(["accept", "reject"]),
});

export async function PATCH(request: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const friendship = await prisma.friendship.findUnique({ where: { id } });
  if (!friendship || friendship.addresseeId !== user.id) {
    return NextResponse.json({ error: "Solicitud no encontrada" }, { status: 404 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  }

  if (parsed.data.action === "reject") {
    await prisma.friendship.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  }

  const updated = await prisma.friendship.update({
    where: { id },
    data: { status: "ACCEPTED" },
  });

  return NextResponse.json({ friendship: updated });
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const friendship = await prisma.friendship.findUnique({ where: { id } });
  if (
    !friendship ||
    (friendship.requesterId !== user.id && friendship.addresseeId !== user.id)
  ) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  await prisma.friendship.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
