import { prisma } from "@/lib/prisma";
import { getCurrentUser, getUserRole, getAccessibleUserIds } from "@/lib/auth-utils";
import { LeaveClient } from "./client";

export default async function LeavePage() {
  const user = await getCurrentUser();
  const role = await getUserRole(user.id);

  const currentWorkYear = await prisma.workYear.findFirst({
    where: { isCurrent: true },
  });

  if (!currentWorkYear) {
    return <div className="text-center py-12 text-muted-foreground">暂未设置当前工作年度</div>;
  }

  const accessible = await getAccessibleUserIds(user.id, role);
  const whereClause = accessible === "all"
    ? { workYearId: currentWorkYear.id }
    : role === "employee"
      ? { workYearId: currentWorkYear.id, userId: user.id }
      : { workYearId: currentWorkYear.id, userId: { in: accessible as string[] } };

  const records = await prisma.leaveRecord.findMany({
    where: whereClause,
    include: { user: { select: { name: true } } },
    orderBy: { date: "desc" },
  });

  let manageableUsers: { id: string; name: string }[] = [];
  if (role !== "employee") {
    const userWhere = accessible === "all" ? {} : { id: { in: accessible as string[] } };
    manageableUsers = await prisma.user.findMany({
      where: userWhere,
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  return (
    <LeaveClient
      records={JSON.parse(JSON.stringify(records))}
      role={role}
      currentWorkYearId={currentWorkYear.id}
      currentWorkYearName={currentWorkYear.name}
      manageableUsers={manageableUsers}
    />
  );
}
