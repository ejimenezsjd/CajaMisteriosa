import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { areFriends, requireUser } from "@/lib/friends";
import { getPrsForExerciseName } from "@/lib/competition";
import { getFriendIds } from "@/lib/friends";

type Params = { params: Promise<{ userId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const me = await requireUser();
  if (!me) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { userId } = await params;
  const allowed = await areFriends(me.id, userId);
  if (!allowed) {
    return NextResponse.json({ error: "Solo puedes ver amigos" }, { status: 403 });
  }

  const friend = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, displayName: true },
  });

  if (!friend) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  const routines = await prisma.routine.findMany({
    where: { userId },
    include: {
      exercises: {
        orderBy: { orderIndex: "asc" },
        include: {
          setLogs: {
            where: { userId },
            orderBy: { performedAt: "desc" },
            take: 12,
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const friendIds = await getFriendIds(me.id);
  const compareIds = [me.id, ...friendIds];

  const exerciseNames = [
    ...new Set(routines.flatMap((r) => r.exercises.map((e) => e.name))),
  ];

  const rivalMap: Record<string, Awaited<ReturnType<typeof getPrsForExerciseName>>> =
    {};

  for (const name of exerciseNames) {
    rivalMap[name] = await getPrsForExerciseName(name, compareIds);
  }

  return NextResponse.json({ friend, routines, rivalMap });
}
