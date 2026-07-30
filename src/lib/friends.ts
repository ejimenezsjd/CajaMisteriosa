import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function requireUser() {
  const session = await getSession();
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      username: true,
      displayName: true,
      createdAt: true,
    },
  });

  return user;
}

export async function areFriends(userA: string, userB: string) {
  if (userA === userB) return true;

  const friendship = await prisma.friendship.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        { requesterId: userA, addresseeId: userB },
        { requesterId: userB, addresseeId: userA },
      ],
    },
  });

  return Boolean(friendship);
}

export async function getFriendIds(userId: string) {
  const friendships = await prisma.friendship.findMany({
    where: {
      status: "ACCEPTED",
      OR: [{ requesterId: userId }, { addresseeId: userId }],
    },
  });

  return friendships.map((f) =>
    f.requesterId === userId ? f.addresseeId : f.requesterId,
  );
}

export function publicUser(user: {
  id: string;
  username: string;
  displayName: string;
}) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
  };
}
