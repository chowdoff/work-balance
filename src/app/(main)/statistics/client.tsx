"use client";

import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DepartmentTreeSelect } from "@/components/department-tree-select";
import type { DepartmentNode } from "@/lib/department-tree";

type StatRow = {
  id: string;
  name: string;
  department: string;
  overtimeDays: number;
  compLeaveDays: number;
  compRemaining: number;
  annualLeaveDays: number;
  annualTotal: number;
  annualRemaining: number;
};

type WorkYear = {
  id: string;
  name: string;
  isCurrent: boolean;
};

export function StatisticsClient({
  stats,
  tree,
  workYears,
  selectedDepartmentId,
  selectedWorkYearId,
}: {
  stats: StatRow[];
  tree: DepartmentNode[];
  workYears: WorkYear[];
  selectedDepartmentId: string;
  selectedWorkYearId: string;
}) {
  const router = useRouter();

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams();
    if (key === "departmentId") {
      if (value) params.set("departmentId", value);
      params.set("workYearId", selectedWorkYearId);
    } else {
      if (selectedDepartmentId) params.set("departmentId", selectedDepartmentId);
      if (value) params.set("workYearId", value);
    }
    router.push(`/statistics?${params.toString()}`);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">统计报表</h1>

      <div className="flex flex-wrap gap-4 mb-6">
        <div className="w-48">
          <DepartmentTreeSelect
            tree={tree}
            value={selectedDepartmentId}
            onChange={(v) => updateFilter("departmentId", v)}
            allowEmpty
          />
        </div>
        <div className="w-48">
          <select
            value={selectedWorkYearId}
            onChange={(e) => updateFilter("workYearId", e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            {workYears.map((wy) => (
              <option key={wy.id} value={wy.id}>
                {wy.name}
                {wy.isCurrent ? " (当前)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>姓名</TableHead>
              <TableHead>部门</TableHead>
              <TableHead className="text-right">加班(天)</TableHead>
              <TableHead className="text-right">调休已用</TableHead>
              <TableHead className="text-right">调休余额</TableHead>
              <TableHead className="text-right">年假总计</TableHead>
              <TableHead className="text-right">年假已用</TableHead>
              <TableHead className="text-right">年假余额</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  暂无数据
                </TableCell>
              </TableRow>
            )}
            {stats.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.name}</TableCell>
                <TableCell>{s.department}</TableCell>
                <TableCell className="text-right">{s.overtimeDays}</TableCell>
                <TableCell className="text-right">{s.compLeaveDays}</TableCell>
                <TableCell className="text-right">{s.compRemaining}</TableCell>
                <TableCell className="text-right">{s.annualTotal}</TableCell>
                <TableCell className="text-right">{s.annualLeaveDays}</TableCell>
                <TableCell className="text-right">{s.annualRemaining}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
