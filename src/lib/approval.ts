import { prisma } from "@/lib/prisma";

/**
 * Find the direct approver for a given user.
 * Returns the managerId of the user's own department.
 * If the user's department has no manager, walks up the parent chain
 * to find the nearest ancestor department with a manager.
 * Returns empty array if no manager is found (only admin can approve).
 */
export async function findApproverIds(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { departmentId: true },
  });

  if (!user?.departmentId) return [];

  // First check the user's own department
  const dept = await prisma.department.findUnique({
    where: { id: user.departmentId },
    select: { managerId: true, parentId: true },
  });

  if (!dept) return [];

  // If the user's department has a manager, that's the approver
  if (dept.managerId) {
    return [dept.managerId];
  }

  // Only walk up if the user's own department has no manager
  let currentDeptId: string | null = dept.parentId;

  while (currentDeptId) {
    const parentDept = await prisma.department.findUnique({
      where: { id: currentDeptId },
      select: { managerId: true, parentId: true },
    });

    if (!parentDept) break;

    if (parentDept.managerId) {
      return [parentDept.managerId];
    }

    currentDeptId = parentDept.parentId;
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
