import { Navbar } from "@/components/navbar";
import { getCurrentUser, getUserRole } from "@/lib/auth-utils";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const role = await getUserRole(user.id);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar userName={user.name ?? user.email ?? "用户"} role={role} />
      <main className="container mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
