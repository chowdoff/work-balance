import { prisma } from "@/lib/prisma";

/**
 * Find the approver for a given user by walking up the department tree.
 * Returns the managerId of the user's department, or the first ancestor
 * department that has a manager. Returns null if no manager is found
 * (only admin can approve in that case).
 */
export async function findApproverIds(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { departmentId: true },
  });

  if (!user?.departmentId) return [];

  // Walk up the department chain to find a manager
  let currentDeptId: string | null = user.departmentId;

  while (currentDeptId) {
    const dept = await prisma.department.findUnique({
      where: { id: currentDeptId },
      select: { managerId: true, parentId: true },
    });

    if (!dept) break;

    if (dept.managerId) {
      return [dept.managerId];
    }

    currentDeptId = dept.parentId;
  }

  return [];
}

/**
 * Check if a user can approve a given request.
 * Rules:
 * - Admin can approve any request
 * - Department manager (or ancestor manager) can approve their subordinates' requests
 */
export async function canUserApprove(
  approverId: string,
  applicantId: string
): Promise<boolean> {
  // Check if approver is admin
  const approver = await prisma.user.findUnique({
    where: { id: approverId },
    select: { isAdmin: true },
  });

  if (approver?.isAdmin) return true;

  // Check if approver is in the applicant's manager chain
  const approverIds = await findApproverIds(applicantId);
  return approverIds.includes(approverId);
}
