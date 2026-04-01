"use client";

import type { DepartmentNode } from "@/lib/department-tree";

function renderOptions(
  nodes: DepartmentNode[],
  depth: number = 0
): React.ReactNode[] {
  return nodes.flatMap((node) => [
    <option key={node.id} value={node.id}>
      {"　".repeat(depth)}
      {node.name}
    </option>,
    ...renderOptions(node.children, depth + 1),
  ]);
}

export function DepartmentTreeSelect({
  tree,
  value,
  onChange,
  name,
  allowEmpty,
  className,
}: {
  tree: DepartmentNode[];
  value?: string;
  onChange?: (value: string) => void;
  name?: string;
  allowEmpty?: boolean;
  className?: string;
}) {
  const selectProps = onChange !== undefined
    ? { value: value ?? "", onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value) }
    : { defaultValue: value ?? "" };

  return (
    <select
      name={name}
      {...selectProps}
      className={`flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm ${className ?? ""}`}
    >
      {allowEmpty && <option value="">全部部门</option>}
      {renderOptions(tree)}
    </select>
  );
}
