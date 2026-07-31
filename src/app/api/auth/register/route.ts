import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createSessionToken,
  hashPassword,
  setSessionCookie,
} from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Mínimo 3 caracteres")
    .max(24)
    .regex(/^[a-zA-Z0-9_]+$/, "Solo letras, números y _"),
  displayName: z.string().trim().min(2).max(40),
  password: z.string().min(4, "Mínimo 4 caracteres").max(72),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
        { status: 400 },
      );
    }

    const { username, displayName, password } = parsed.data;
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json(
        { error: "Ese usuario ya existe" },
        { status: 409 },
      );
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { username, displayName, passwordHash },
    });

    const token = await createSessionToken({
      userId: user.id,
      username: user.username,
    });
    await setSessionCookie(token);

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
      },
    });
  } catch {
    return NextResponse.json({ error: "Error al registrar" }, { status: 500 });
  }
}
