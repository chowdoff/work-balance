import { prisma } from "@/lib/prisma";
import { getCurrentUser, getUserRole } from "@/lib/auth-utils";
import { redirect } from "next/navigation";
import { WorkYearClient } from "./client";

export default async function WorkYearPage() {
  const user = await getCurrentUser();
  const role = await getUserRole(user.id);
  if (role !== "admin") redirect("/dashboard");

  const workYears = await prisma.workYear.findMany({
    orderBy: { startDate: "desc" },
  });

  return <WorkYearClient workYears={JSON.parse(JSON.stringify(workYears))} />;
}
