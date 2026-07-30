"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/rutinas", label: "Rutinas" },
  { href: "/amigos", label: "Amigos" },
  { href: "/competir", label: "Competir" },
];

type Props = {
  user: { displayName: string; username: string };
};

export function AppNav({ user }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/rutinas" className="font-display text-2xl tracking-wide text-accent">
          GymRival
        </Link>
        <nav className="hidden items-center gap-1 sm:flex">
          {links.map((link) => {
            const active = pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-2 text-sm transition ${
                  active
                    ? "bg-bg-soft text-accent"
                    : "text-muted hover:text-ink"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-3">
          <div className="hidden text-right text-sm sm:block">
            <div className="font-medium text-ink">{user.displayName}</div>
            <div className="text-xs text-muted">@{user.username}</div>
          </div>
          <button
            type="button"
            className="btn btn-ghost text-sm"
            onClick={logout}
            disabled={loading}
          >
            Salir
          </button>
        </div>
      </div>
      <nav className="flex border-t border-line sm:hidden">
        {links.map((link) => {
          const active = pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex-1 py-2.5 text-center text-sm ${
                active ? "text-accent" : "text-muted"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
