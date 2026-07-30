import { redirect } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { requireUser } from "@/lib/friends";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      <AppNav user={user} />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
