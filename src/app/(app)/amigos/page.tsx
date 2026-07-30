import { FriendsClient } from "@/components/FriendsClient";
import { getFriendIds, requireUser } from "@/lib/friends";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function AmigosPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [{ requesterId: user.id }, { addresseeId: user.id }],
    },
    include: {
      requester: { select: { id: true, username: true, displayName: true } },
      addressee: { select: { id: true, username: true, displayName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const friends = friendships
    .filter((f) => f.status === "ACCEPTED")
    .map((f) => (f.requesterId === user.id ? f.addressee : f.requester));

  const incoming = friendships
    .filter((f) => f.status === "PENDING" && f.addresseeId === user.id)
    .map((f) => ({ id: f.id, from: f.requester }));

  const outgoing = friendships
    .filter((f) => f.status === "PENDING" && f.requesterId === user.id)
    .map((f) => ({ id: f.id, to: f.addressee }));

  const friendIds = await getFriendIds(user.id);
  const friendRoutines =
    friendIds.length === 0
      ? []
      : await prisma.routine.findMany({
          where: { userId: { in: friendIds } },
          include: {
            user: { select: { id: true, username: true, displayName: true } },
            exercises: {
              orderBy: { orderIndex: "asc" },
              select: { name: true, targetSets: true, targetReps: true },
            },
          },
          orderBy: { updatedAt: "desc" },
        });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-accent">Social</p>
        <h1 className="font-display text-5xl sm:text-6xl">Amigos</h1>
        <p className="mt-2 max-w-xl text-muted">
          Conecta con compañeros de gym, entra en su rutina y deja que entren en la tuya.
        </p>
      </div>
      <FriendsClient
        friends={friends}
        incoming={incoming}
        outgoing={outgoing}
        friendRoutines={friendRoutines}
      />
    </div>
  );
}
