import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getFriendIds, requireUser } from "@/lib/friends";
import { publicUser } from "@/lib/friends";

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [{ requesterId: user.id }, { addresseeId: user.id }],
    },
    include: {
      requester: {
        select: { id: true, username: true, displayName: true },
      },
      addressee: {
        select: { id: true, username: true, displayName: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const friends = friendships
    .filter((f) => f.status === "ACCEPTED")
    .map((f) =>
      publicUser(f.requesterId === user.id ? f.addressee : f.requester),
    );

  const incoming = friendships
    .filter((f) => f.status === "PENDING" && f.addresseeId === user.id)
    .map((f) => ({
      id: f.id,
      from: publicUser(f.requester),
      createdAt: f.createdAt,
    }));

  const outgoing = friendships
    .filter((f) => f.status === "PENDING" && f.requesterId === user.id)
    .map((f) => ({
      id: f.id,
      to: publicUser(f.addressee),
      createdAt: f.createdAt,
    }));

  const friendIds = await getFriendIds(user.id);
  const friendRoutines =
    friendIds.length === 0
      ? []
      : await prisma.routine.findMany({
          where: { userId: { in: friendIds } },
          include: {
            user: {
              select: { id: true, username: true, displayName: true },
            },
            exercises: { orderBy: { orderIndex: "asc" } },
          },
          orderBy: { updatedAt: "desc" },
        });

  return NextResponse.json({
    friends,
    incoming,
    outgoing,
    friendRoutines,
  });
}

const requestSchema = z.object({
  username: z.string().trim().min(1),
});

export async function POST(request: Request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Usuario requerido" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { username: parsed.data.username },
  });

  if (!target) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  if (target.id === user.id) {
    return NextResponse.json(
      { error: "No puedes añadirte a ti mismo" },
      { status: 400 },
    );
  }

  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: user.id, addresseeId: target.id },
        { requesterId: target.id, addresseeId: user.id },
      ],
    },
  });

  if (existing) {
    if (existing.status === "ACCEPTED") {
      return NextResponse.json({ error: "Ya sois amigos" }, { status: 409 });
    }
    if (existing.requesterId === user.id) {
      return NextResponse.json(
        { error: "Solicitud ya enviada" },
        { status: 409 },
      );
    }
    const accepted = await prisma.friendship.update({
      where: { id: existing.id },
      data: { status: "ACCEPTED" },
    });
    return NextResponse.json({ friendship: accepted });
  }

  const friendship = await prisma.friendship.create({
    data: {
      requesterId: user.id,
      addresseeId: target.id,
      status: "PENDING",
    },
  });

  return NextResponse.json({ friendship }, { status: 201 });
}
