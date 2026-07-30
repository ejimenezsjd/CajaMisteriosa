import { NextResponse } from "next/server";
import { getCompetitionBoard } from "@/lib/competition";
import { getFriendIds, requireUser } from "@/lib/friends";

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const friendIds = await getFriendIds(user.id);
  const board = await getCompetitionBoard(user.id, friendIds);

  return NextResponse.json({
    board,
    me: user,
  });
}
