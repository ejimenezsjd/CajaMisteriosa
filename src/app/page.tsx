import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function HomePage() {
  const session = await getSession();
  if (session) redirect("/rutinas");

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23b8ff6f' fill-opacity='0.06'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-10 pt-8">
        <div className="flex items-center justify-between">
          <span className="font-display text-2xl text-accent">GymRival</span>
          <div className="flex gap-2">
            <Link href="/login" className="btn btn-ghost text-sm">
              Entrar
            </Link>
            <Link href="/registro" className="btn btn-primary text-sm">
              Crear cuenta
            </Link>
          </div>
        </div>

        <section className="mt-16 flex flex-1 flex-col justify-center gap-10 lg:mt-0 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="animate-rise mb-3 text-sm uppercase tracking-[0.25em] text-accent">
              Social lifting
            </p>
            <h1 className="font-display animate-rise-delay text-6xl leading-[0.95] text-ink sm:text-7xl md:text-8xl">
              GymRival
            </h1>
            <p className="animate-rise-delay-2 mt-5 max-w-xl text-lg text-muted sm:text-xl">
              Monta tu rutina, mira la de tus amigos y anota cada serie. Compite
              por superar su peso — y que ellos intenten superar el tuyo.
            </p>
            <div className="animate-rise-delay-2 mt-8 flex flex-wrap gap-3">
              <Link href="/registro" className="btn btn-primary">
                Empezar ahora
              </Link>
              <Link href="/login" className="btn btn-ghost">
                Ya tengo cuenta
              </Link>
            </div>
            <p className="mt-6 text-sm text-muted">
              Demo: <span className="text-ink">alex</span> /{" "}
              <span className="text-ink">demo1234</span>
            </p>
          </div>

          <div className="animate-rise-delay relative overflow-hidden rounded-2xl border border-line bg-bg-elevated/70 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)]">
            <div className="accent-bar mb-5" />
            <p className="text-xs uppercase tracking-[0.2em] text-muted">
              Reto activo
            </p>
            <h2 className="font-display mt-2 text-4xl text-ink">Press banca</h2>
            <div className="mt-6 space-y-3">
              {[
                { name: "Luis", kg: 105, lead: true },
                { name: "Alex", kg: 90, lead: false },
                { name: "María", kg: 50, lead: false },
              ].map((row, i) => (
                <div
                  key={row.name}
                  className="flex items-center justify-between rounded-xl border border-line bg-bg-soft/80 px-4 py-3"
                  style={{ animationDelay: `${0.3 + i * 0.08}s` }}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-display text-xl text-muted">
                      {i + 1}
                    </span>
                    <span className={row.lead ? "text-accent" : "text-ink"}>
                      {row.name}
                    </span>
                  </div>
                  <span className="font-display text-2xl">
                    {row.kg}
                    <span className="ml-1 text-sm text-muted">kg</span>
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-5 text-sm text-muted">
              Anota tus series y el ranking se actualiza al instante.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
