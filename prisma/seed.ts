import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const raw = (process.env.DATABASE_URL ?? "file:./prisma/dev.db").replace(
  /^file:/,
  "",
);
const filePath = path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
const adapter = new PrismaBetterSqlite3({ url: `file:${filePath}` });
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.setLog.deleteMany();
  await prisma.exercise.deleteMany();
  await prisma.routine.deleteMany();
  await prisma.friendship.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("demo1234", 10);

  const alex = await prisma.user.create({
    data: {
      username: "alex",
      displayName: "Alex",
      passwordHash,
    },
  });

  const maria = await prisma.user.create({
    data: {
      username: "maria",
      displayName: "María",
      passwordHash,
    },
  });

  const luis = await prisma.user.create({
    data: {
      username: "luis",
      displayName: "Luis",
      passwordHash,
    },
  });

  await prisma.friendship.createMany({
    data: [
      { requesterId: alex.id, addresseeId: maria.id, status: "ACCEPTED" },
      { requesterId: alex.id, addresseeId: luis.id, status: "ACCEPTED" },
      { requesterId: maria.id, addresseeId: luis.id, status: "ACCEPTED" },
    ],
  });

  const alexPush = await prisma.routine.create({
    data: {
      userId: alex.id,
      name: "Push Day",
      dayLabel: "Lunes",
      description: "Pecho, hombros y tríceps",
      exercises: {
        create: [
          { name: "Press banca", targetSets: 4, targetReps: 8, orderIndex: 0 },
          { name: "Press militar", targetSets: 3, targetReps: 10, orderIndex: 1 },
          { name: "Fondos", targetSets: 3, targetReps: 12, orderIndex: 2 },
        ],
      },
    },
    include: { exercises: true },
  });

  const alexPull = await prisma.routine.create({
    data: {
      userId: alex.id,
      name: "Pull Day",
      dayLabel: "Miércoles",
      description: "Espalda y bíceps",
      exercises: {
        create: [
          { name: "Peso muerto", targetSets: 4, targetReps: 5, orderIndex: 0 },
          { name: "Dominadas", targetSets: 3, targetReps: 8, orderIndex: 1 },
          { name: "Remo con barra", targetSets: 3, targetReps: 10, orderIndex: 2 },
        ],
      },
    },
    include: { exercises: true },
  });

  const mariaLegs = await prisma.routine.create({
    data: {
      userId: maria.id,
      name: "Piernas",
      dayLabel: "Martes",
      description: "Cuádriceps, glúteos y femoral",
      exercises: {
        create: [
          { name: "Sentadilla", targetSets: 4, targetReps: 6, orderIndex: 0 },
          { name: "Peso muerto rumano", targetSets: 3, targetReps: 8, orderIndex: 1 },
          { name: "Prensa", targetSets: 3, targetReps: 12, orderIndex: 2 },
        ],
      },
    },
    include: { exercises: true },
  });

  const mariaPush = await prisma.routine.create({
    data: {
      userId: maria.id,
      name: "Torso",
      dayLabel: "Jueves",
      description: "Fuerza de empuje",
      exercises: {
        create: [
          { name: "Press banca", targetSets: 4, targetReps: 8, orderIndex: 0 },
          { name: "Press militar", targetSets: 3, targetReps: 10, orderIndex: 1 },
        ],
      },
    },
    include: { exercises: true },
  });

  const luisFull = await prisma.routine.create({
    data: {
      userId: luis.id,
      name: "Full Body",
      dayLabel: "Viernes",
      description: "Sesión completa",
      exercises: {
        create: [
          { name: "Sentadilla", targetSets: 5, targetReps: 5, orderIndex: 0 },
          { name: "Press banca", targetSets: 4, targetReps: 6, orderIndex: 1 },
          { name: "Peso muerto", targetSets: 3, targetReps: 5, orderIndex: 2 },
        ],
      },
    },
    include: { exercises: true },
  });

  const pressAlex = alexPush.exercises.find((e) => e.name === "Press banca")!;
  const pressMaria = mariaPush.exercises.find((e) => e.name === "Press banca")!;
  const pressLuis = luisFull.exercises.find((e) => e.name === "Press banca")!;
  const squatMaria = mariaLegs.exercises.find((e) => e.name === "Sentadilla")!;
  const squatLuis = luisFull.exercises.find((e) => e.name === "Sentadilla")!;
  const deadAlex = alexPull.exercises.find((e) => e.name === "Peso muerto")!;
  const deadLuis = luisFull.exercises.find((e) => e.name === "Peso muerto")!;

  await prisma.setLog.createMany({
    data: [
      { userId: alex.id, exerciseId: pressAlex.id, setNumber: 1, reps: 8, weightKg: 80 },
      { userId: alex.id, exerciseId: pressAlex.id, setNumber: 2, reps: 6, weightKg: 85 },
      { userId: alex.id, exerciseId: pressAlex.id, setNumber: 3, reps: 5, weightKg: 90 },
      { userId: maria.id, exerciseId: pressMaria.id, setNumber: 1, reps: 8, weightKg: 45 },
      { userId: maria.id, exerciseId: pressMaria.id, setNumber: 2, reps: 6, weightKg: 50 },
      { userId: luis.id, exerciseId: pressLuis.id, setNumber: 1, reps: 6, weightKg: 100 },
      { userId: luis.id, exerciseId: pressLuis.id, setNumber: 2, reps: 4, weightKg: 105 },
      { userId: maria.id, exerciseId: squatMaria.id, setNumber: 1, reps: 6, weightKg: 70 },
      { userId: maria.id, exerciseId: squatMaria.id, setNumber: 2, reps: 5, weightKg: 75 },
      { userId: luis.id, exerciseId: squatLuis.id, setNumber: 1, reps: 5, weightKg: 120 },
      { userId: luis.id, exerciseId: squatLuis.id, setNumber: 2, reps: 3, weightKg: 130 },
      { userId: alex.id, exerciseId: deadAlex.id, setNumber: 1, reps: 5, weightKg: 120 },
      { userId: alex.id, exerciseId: deadAlex.id, setNumber: 2, reps: 3, weightKg: 140 },
      { userId: luis.id, exerciseId: deadLuis.id, setNumber: 1, reps: 5, weightKg: 150 },
      { userId: luis.id, exerciseId: deadLuis.id, setNumber: 2, reps: 2, weightKg: 160 },
    ],
  });

  console.log("Seed OK");
  console.log("Usuarios demo (password: demo1234): alex, maria, luis");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
