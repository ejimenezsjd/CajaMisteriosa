"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("alex");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Error al entrar");
      return;
    }
    router.push("/rutinas");
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <Link href="/" className="font-display mb-8 text-3xl text-accent">
        GymRival
      </Link>
      <h1 className="font-display text-5xl">Entrar</h1>
      <p className="mt-2 text-muted">Accede a tu rutina y a la de tus amigos.</p>

      <form onSubmit={onSubmit} className="panel mt-8 space-y-4 rounded-2xl p-6">
        <label className="block text-sm">
          <span className="mb-1.5 block text-muted">Usuario</span>
          <input
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block text-muted">Contraseña</span>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
        <button type="submit" className="btn btn-primary w-full" disabled={loading}>
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>

      <p className="mt-6 text-sm text-muted">
        ¿Nuevo aquí?{" "}
        <Link href="/registro" className="text-accent">
          Crear cuenta
        </Link>
      </p>
    </div>
  );
}
