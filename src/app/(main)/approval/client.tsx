"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import type { UserRole } from "@/lib/auth-utils";
import {
  submitRequest,
  withdrawRequest,
  approveRequest,
  rejectRequest,
} from "./actions";

type WorkYear = {
  id: string;
  name: string;
  isCurrent: boolean;
  startDate: string;
  endDate: string;
};

type ApprovalRequestData = {
  id: string;
  type: "OVERTIME" | "LEAVE";
  status: "PENDING" | "APPROVED" | "REJECTED" | "WITHDRAWN";
  date: string;
  days: string;
  leaveType: "COMPENSATORY" | "ANNUAL" | null;
  remark: string | null;
  rejectReason: string | null;
  createdAt: string;
  updatedAt: string;
  workYear: { name: string };
  applicant?: { name: string; department: { name: string } | null };
  approver: { name: string } | null;
};

type Props = {
  role: UserRole;
  myRequests: ApprovalRequestData[];
  pendingRequests: ApprovalRequestData[];
  processedRequests: ApprovalRequestData[];
  workYears: WorkYear[];
  currentWorkYearId: string;
  defaultTab: string;
  defaultStatus: string;
};

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: { label: "待审批", variant: "outline" },
  APPROVED: { label: "已通过", variant: "default" },
  REJECTED: { label: "已拒绝", variant: "destructive" },
  WITHDRAWN: { label: "已撤回", variant: "secondary" },
};

const TYPE_LABELS: Record<string, string> = {
  OVERTIME: "加班",
  LEAVE: "请假",
};

const LEAVE_TYPE_LABELS: Record<string, string> = {
  COMPENSATORY: "调休",
  ANNUAL: "年假",
};

export function ApprovalClient({
  role,
  myRequests,
  pendingRequests,
  processedRequests,
  workYears,
  currentWorkYearId,
  defaultTab,
  defaultStatus,
}: Props) {
  const router = useRouter();
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [submitType, setSubmitType] = useState<"OVERTIME" | "LEAVE">("OVERTIME");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState(defaultStatus);
  const [formWorkYearId, setFormWorkYearId] = useState(currentWorkYearId);

  const canApprove = role !== "employee";

  function openSubmitDialog(type: "OVERTIME" | "LEAVE") {
    setSubmitType(type);
    setFormWorkYearId(currentWorkYearId);
    setSubmitDialogOpen(true);
  }

  async function handleSubmit(formData: FormData) {
    formData.set("type", submitType);
    try {
      await submitRequest(formData);
      setSubmitDialogOpen(false);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleWithdraw(id: string) {
    if (!confirm("确定要撤回此申请吗？")) return;
    try {
      await withdrawRequest(id);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleApprove(id: string) {
    if (!confirm("确定要通过此申请吗？")) return;
    try {
      await approveRequest(id);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  function openRejectDialog(id: string) {
    setRejectingId(id);
    setRejectDialogOpen(true);
  }

  async function handleReject(formData: FormData) {
    if (!rejectingId) return;
    try {
      await rejectRequest(rejectingId, formData);
      setRejectDialogOpen(false);
      setRejectingId(null);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  function updateStatusFilter(value: string) {
    setStatusFilter(value);
    const params = new URLSearchParams();
    params.set("tab", "my");
    if (value) params.set("status", value);
    router.push(`/approval?${params.toString()}`);
  }

  const filteredMyRequests = statusFilter
    ? myRequests.filter((r) => r.status === statusFilter)
    : myRequests;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">审批管理</h1>
      </div>

      <Tabs defaultValue={defaultTab === "pending" ? "pending" : defaultTab === "history" ? "history" : "my"}>
        <TabsList>
          <TabsTrigger value="my">我的申请</TabsTrigger>
          {canApprove && (
            <TabsTrigger value="pending">
              待我审批
              {pendingRequests.length > 0 && (
                <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
                  {pendingRequests.length}
                </span>
              )}
            </TabsTrigger>
          )}
          {canApprove && <TabsTrigger value="history">审批记录</TabsTrigger>}
        </TabsList>

        {/* Tab 1: My Requests */}
        <TabsContent value="my">
          <div className="flex flex-wrap items-center gap-4 mb-4 mt-4">
            <Dialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
              <div className="flex gap-2">
                <DialogTrigger
                  render={
                    <Button
                      variant="outline"
                      onClick={() => openSubmitDialog("OVERTIME")}
                    />
                  }
                >
                  发起加班申请
                </DialogTrigger>
                <DialogTrigger
                  render={
                    <Button onClick={() => openSubmitDialog("LEAVE")} />
                  }
                >
                  发起请假申请
                </DialogTrigger>
              </div>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {submitType === "OVERTIME" ? "发起加班申请" : "发起请假申请"}
                  </DialogTitle>
                </DialogHeader>
                <form key={submitType} action={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="workYearId">工作年度</Label>
                    <select
                      id="workYearId"
                      name="workYearId"
                      value={formWorkYearId}
                      onChange={(e) => setFormWorkYearId(e.target.value)}
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
                  {submitType === "LEAVE" && (
                    <div className="space-y-2">
                      <Label htmlFor="leaveType">假期类型</Label>
                      <select
                        id="leaveType"
                        name="leaveType"
                        required
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                      >
                        <option value="">请选择类型</option>
                        <option value="COMPENSATORY">调休</option>
                        <option value="ANNUAL">年假</option>
                      </select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="date">日期</Label>
                    <Input
                      id="date"
                      name="date"
                      type="date"
                      min={
                        workYears.find((w) => w.id === formWorkYearId)
                          ?.startDate
                      }
                      max={
                        workYears.find((w) => w.id === formWorkYearId)?.endDate
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="days">
                      {submitType === "OVERTIME" ? "加班天数" : "请假天数"}
                    </Label>
                    <Input
                      id="days"
                      name="days"
                      type="number"
                      step="0.5"
                      min="0.5"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="remark">备注</Label>
                    <Input id="remark" name="remark" />
                  </div>
                  <Button type="submit" className="w-full">
                    提交申请
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            <div className="ml-auto">
              <select
                value={statusFilter}
                onChange={(e) => updateStatusFilter(e.target.value)}
                className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                <option value="">全部状态</option>
                <option value="PENDING">待审批</option>
                <option value="APPROVED">已通过</option>
                <option value="REJECTED">已拒绝</option>
                <option value="WITHDRAWN">已撤回</option>
              </select>
            </div>
          </div>

          <div className="border rounded-md overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>类型</TableHead>
                  <TableHead>日期</TableHead>
                  <TableHead className="text-right">天数</TableHead>
                  <TableHead>假期类型</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>审批人</TableHead>
                  <TableHead>备注</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMyRequests.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-muted-foreground py-8"
                    >
                      暂无申请记录
                    </TableCell>
                  </TableRow>
                )}
                {filteredMyRequests.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell>{TYPE_LABELS[req.type]}</TableCell>
                    <TableCell>{req.date.slice(0, 10)}</TableCell>
                    <TableCell className="text-right">{req.days}</TableCell>
                    <TableCell>
                      {req.leaveType
                        ? LEAVE_TYPE_LABELS[req.leaveType]
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_CONFIG[req.status]?.variant}>
                        {STATUS_CONFIG[req.status]?.label}
                      </Badge>
                    </TableCell>
                    <TableCell>{req.approver?.name ?? "-"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {req.status === "REJECTED" && req.rejectReason
                        ? `拒绝原因: ${req.rejectReason}`
                        : req.remark ?? "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {req.status === "PENDING" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleWithdraw(req.id)}
                        >
                          撤回
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Tab 2: Pending Approval */}
        {canApprove && (
          <TabsContent value="pending">
            <div className="border rounded-md overflow-auto mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>申请人</TableHead>
                    <TableHead>部门</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>日期</TableHead>
                    <TableHead className="text-right">天数</TableHead>
                    <TableHead>假期类型</TableHead>
                    <TableHead>备注</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingRequests.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center text-muted-foreground py-8"
                      >
                        暂无待审批申请
                      </TableCell>
                    </TableRow>
                  )}
                  {pendingRequests.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell className="font-medium">
                        {req.applicant?.name}
                      </TableCell>
                      <TableCell>
                        {req.applicant?.department?.name ?? "-"}
                      </TableCell>
                      <TableCell>{TYPE_LABELS[req.type]}</TableCell>
                      <TableCell>{req.date.slice(0, 10)}</TableCell>
                      <TableCell className="text-right">{req.days}</TableCell>
                      <TableCell>
                        {req.leaveType
                          ? LEAVE_TYPE_LABELS[req.leaveType]
                          : "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {req.remark ?? "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            onClick={() => handleApprove(req.id)}
                          >
                            通过
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => openRejectDialog(req.id)}
                          >
                            拒绝
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Reject Dialog */}
            <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>拒绝申请</DialogTitle>
                </DialogHeader>
                <form action={handleReject} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="rejectReason">拒绝原因</Label>
                    <Input id="rejectReason" name="rejectReason" />
                  </div>
                  <Button type="submit" variant="destructive" className="w-full">
                    确认拒绝
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </TabsContent>
        )}

        {/* Tab 3: Processed History */}
        {canApprove && (
          <TabsContent value="history">
            <div className="border rounded-md overflow-auto mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>申请人</TableHead>
                    <TableHead>部门</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>日期</TableHead>
                    <TableHead className="text-right">天数</TableHead>
                    <TableHead>假期类型</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>审批人</TableHead>
                    <TableHead>处理时间</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processedRequests.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="text-center text-muted-foreground py-8"
                      >
                        暂无审批记录
                      </TableCell>
                    </TableRow>
                  )}
                  {processedRequests.map((req) => (
                    <TableRow key={req.id}>
                      <TableCell className="font-medium">
                        {req.applicant?.name}
                      </TableCell>
                      <TableCell>
                        {req.applicant?.department?.name ?? "-"}
                      </TableCell>
                      <TableCell>{TYPE_LABELS[req.type]}</TableCell>
                      <TableCell>{req.date.slice(0, 10)}</TableCell>
                      <TableCell className="text-right">{req.days}</TableCell>
                      <TableCell>
                        {req.leaveType
                          ? LEAVE_TYPE_LABELS[req.leaveType]
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_CONFIG[req.status]?.variant}>
                          {STATUS_CONFIG[req.status]?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>{req.approver?.name ?? "-"}</TableCell>
                      <TableCell>
                        {req.updatedAt.slice(0, 10)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
