import { prisma } from "@/lib/prisma";

export async function getSubDepartmentIds(departmentId: string): Promise<string[]> {
  const result = await prisma.$queryRaw<{ id: string }[]>`
    WITH RECURSIVE sub_departments AS (
      SELECT id FROM "Department" WHERE "parentId" = ${departmentId}
      UNION ALL
      SELECT d.id FROM "Department" d
      INNER JOIN sub_departments sd ON d."parentId" = sd.id
    )
    SELECT id FROM sub_departments
  `;

  return result.map((r) => r.id);
}

export type DepartmentNode = {
  id: string;
  name: string;
  parentId: string | null;
  managerId: string | null;
  managerName: string | null;
  children: DepartmentNode[];
};

export async function getDepartmentTree(): Promise<DepartmentNode[]> {
  const departments = await prisma.department.findMany({
    include: { manager: { select: { name: true } } },
    orderBy: { name: "asc" },
  });

  const map = new Map<string, DepartmentNode>();
  const roots: DepartmentNode[] = [];

  for (const dept of departments) {
    map.set(dept.id, {
      id: dept.id,
      name: dept.name,
      parentId: dept.parentId,
      managerId: dept.managerId,
      managerName: dept.manager?.name ?? null,
      children: [],
    });
  }

  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}
