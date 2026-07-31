"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Friend = { id: string; username: string; displayName: string };
type Incoming = { id: string; from: Friend };
type Outgoing = { id: string; to: Friend };
type FriendRoutine = {
  id: string;
  name: string;
  dayLabel: string | null;
  user: Friend;
  exercises: Array<{ name: string; targetSets: number; targetReps: number }>;
};

type Props = {
  friends: Friend[];
  incoming: Incoming[];
  outgoing: Outgoing[];
  friendRoutines: FriendRoutine[];
};

export function FriendsClient({
  friends,
  incoming,
  outgoing,
  friendRoutines,
}: Props) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendRequest(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Error");
      return;
    }
    setUsername("");
    router.refresh();
  }

  async function respond(id: string, action: "accept" | "reject") {
    await fetch(`/api/friends/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <form onSubmit={sendRequest} className="panel rounded-2xl p-5">
        <h2 className="font-display text-3xl">Añadir amigo</h2>
        <p className="mt-1 text-sm text-muted">
          Busca por nombre de usuario. Cuando acepte, veréis vuestras rutinas.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            className="input"
            placeholder="usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <button type="submit" className="btn btn-primary shrink-0" disabled={loading}>
            {loading ? "Enviando…" : "Enviar solicitud"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </form>

      {incoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-3xl">Solicitudes</h2>
          {incoming.map((req) => (
            <div
              key={req.id}
              className="panel flex flex-wrap items-center justify-between gap-3 rounded-xl p-4"
            >
              <div>
                <div className="font-medium">{req.from.displayName}</div>
                <div className="text-sm text-muted">@{req.from.username}</div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-primary text-sm"
                  onClick={() => respond(req.id, "accept")}
                >
                  Aceptar
                </button>
                <button
                  type="button"
                  className="btn btn-ghost text-sm"
                  onClick={() => respond(req.id, "reject")}
                >
                  Rechazar
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {outgoing.length > 0 && (
        <section>
          <h2 className="font-display text-3xl">Pendientes</h2>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            {outgoing.map((req) => (
              <li key={req.id}>
                Esperando a {req.to.displayName} (@{req.to.username})
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="font-display text-3xl">Tus amigos</h2>
        {friends.length === 0 ? (
          <p className="mt-2 text-muted">
            Todavía no tienes amigos. Prueba con <span className="text-ink">maria</span> o{" "}
            <span className="text-ink">luis</span>.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {friends.map((friend) => (
              <Link
                key={friend.id}
                href={`/amigos/${friend.id}`}
                className="panel rounded-xl p-4 transition hover:border-accent/40"
              >
                <div className="font-display text-2xl">{friend.displayName}</div>
                <div className="text-sm text-muted">@{friend.username}</div>
                <div className="mt-3 text-sm text-accent">Ver rutina →</div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {friendRoutines.length > 0 && (
        <section>
          <h2 className="font-display text-3xl">Rutinas de amigos</h2>
          <div className="mt-4 space-y-3">
            {friendRoutines.map((routine) => (
              <Link
                key={routine.id}
                href={`/amigos/${routine.user.id}`}
                className="panel block rounded-xl p-4 transition hover:border-accent/40"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.15em] text-accent">
                      {routine.user.displayName}
                      {routine.dayLabel ? ` · ${routine.dayLabel}` : ""}
                    </p>
                    <h3 className="font-display text-3xl">{routine.name}</h3>
                  </div>
                  <span className="text-sm text-muted">
                    {routine.exercises.length} ejercicios
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted">
                  {routine.exercises.map((e) => e.name).join(" · ")}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
