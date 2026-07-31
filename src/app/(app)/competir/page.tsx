import { getCompetitionBoard } from "@/lib/competition";
import { getFriendIds, requireUser } from "@/lib/friends";
import { redirect } from "next/navigation";

export default async function CompetirPage() {
  const user = await requireUser();
  if (!user) redirect("/login");

  const friendIds = await getFriendIds(user.id);
  const board = await getCompetitionBoard(user.id, friendIds);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-accent">Ranking</p>
        <h1 className="font-display text-5xl sm:text-6xl">Competir</h1>
        <p className="mt-2 max-w-xl text-muted">
          Mejor marca (peso) por ejercicio entre tú y tus amigos. Si empatáis en
          kilos, ganan más repeticiones.
        </p>
      </div>

      {board.length === 0 ? (
        <div className="panel rounded-2xl p-8 text-center">
          <p className="font-display text-3xl">Sin levantamientos aún</p>
          <p className="mt-2 text-muted">
            Anota series en tus rutinas para aparecer en el ranking.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {board.map((item, index) => {
            const leader = item.leaderboard[0];
            const amLeader = leader?.userId === user.id;
            return (
              <section
                key={item.exerciseName}
                className="panel animate-rise rounded-2xl p-5"
                style={{ animationDelay: `${index * 0.04}s` }}
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h2 className="font-display text-3xl">{item.exerciseName}</h2>
                  {amLeader && (
                    <span className="rounded-md bg-accent/15 px-2 py-1 text-xs font-medium text-accent">
                      Tú lideras
                    </span>
                  )}
                </div>
                <ol className="mt-4 space-y-2">
                  {item.leaderboard.map((row, i) => {
                    const isMe = row.userId === user.id;
                    return (
                      <li
                        key={row.userId}
                        className={`flex items-center justify-between rounded-xl border px-3 py-2.5 ${
                          isMe
                            ? "border-accent/40 bg-accent/10"
                            : "border-line bg-bg-soft/50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-display w-6 text-xl text-muted">
                            {i + 1}
                          </span>
                          <span className={isMe ? "text-accent" : "text-ink"}>
                            {row.displayName}
                            {isMe ? " (tú)" : ""}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-display text-2xl">
                            {row.weightKg}
                          </span>
                          <span className="ml-1 text-xs text-muted">
                            kg · {row.reps} reps
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
