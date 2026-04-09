import { Navbar } from "@/components/navbar";
import { getCurrentUser, getUserRole } from "@/lib/auth-utils";
import { prisma } from "@/lib/prisma";
import { ApprovalStatus } from "@prisma/client";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const role = await getUserRole(user.id);

  // Count pending approval requests for badge
  let pendingApprovalCount = 0;
  if (role !== "employee") {
    if (role === "admin") {
      pendingApprovalCount = await prisma.approvalRequest.count({
        where: {
          status: ApprovalStatus.PENDING,
          applicantId: { not: user.id },
        },
      });
    } else {
      // manager: count pending requests from direct department members only
      const directDepts = await prisma.department.findMany({
        where: { managerId: user.id },
        select: { id: true },
      });
      const directDeptIds = directDepts.map((d) => d.id);
      if (directDeptIds.length > 0) {
        const directMembers = await prisma.user.findMany({
          where: { departmentId: { in: directDeptIds } },
          select: { id: true },
        });
        const directMemberIds = directMembers
          .map((s) => s.id)
          .filter((id) => id !== user.id);
        if (directMemberIds.length > 0) {
          pendingApprovalCount = await prisma.approvalRequest.count({
            where: {
              status: ApprovalStatus.PENDING,
              applicantId: { in: directMemberIds },
            },
          });
        }
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar
        userName={user.name ?? user.email ?? "用户"}
        userEmail={user.email ?? ""}
        role={role}
        pendingApprovalCount={pendingApprovalCount}
      />
      <main className="container mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
