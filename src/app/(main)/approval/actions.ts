"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser, getUserRole } from "@/lib/auth-utils";
import { canUserApprove } from "@/lib/approval";
import {
  recalculateCompensatoryBalance,
  recalculateAnnualBalance,
} from "@/lib/balance";
import {
  ApprovalType,
  ApprovalStatus,
  LeaveType,
  Prisma,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

export async function submitRequest(formData: FormData) {
  const currentUser = await getCurrentUser();
  const type = formData.get("type") as string;
  const workYearId = formData.get("workYearId") as string;
  const date = formData.get("date") as string;
  const days = parseFloat(formData.get("days") as string);
  const remark = (formData.get("remark") as string) || null;
  const leaveType = formData.get("leaveType") as LeaveType | null;

  const workYear = await prisma.workYear.findUnique({
    where: { id: workYearId },
  });
  if (!workYear) throw new Error("工作年度不存在");

  const dateObj = new Date(date);
  if (dateObj < workYear.startDate || dateObj > workYear.endDate) {
    const start = workYear.startDate.toISOString().slice(0, 10);
    const end = workYear.endDate.toISOString().slice(0, 10);
    throw new Error(`日期必须在工作年度范围内（${start} ~ ${end}）`);
  }

  const approvalType =
    type === "OVERTIME" ? ApprovalType.OVERTIME : ApprovalType.LEAVE;

  if (approvalType === ApprovalType.LEAVE) {
    if (!leaveType) throw new Error("请选择假期类型");

    const balance = await prisma.leaveBalance.findUnique({
      where: {
        userId_workYearId_type: {
          userId: currentUser.id,
          workYearId,
          type: leaveType,
        },
      },
    });

    const remaining = balance?.remaining ?? new Prisma.Decimal(0);
    if (remaining.lt(new Prisma.Decimal(days))) {
      throw new Error(`额度不足，剩余 ${remaining} 天`);
    }
  }

  await prisma.approvalRequest.create({
    data: {
      type: approvalType,
      applicantId: currentUser.id,
      workYearId,
      date: new Date(date),
      days,
      leaveType: approvalType === ApprovalType.LEAVE ? leaveType : null,
      remark,
    },
  });

  if (approvalType === ApprovalType.LEAVE && leaveType) {
    if (leaveType === LeaveType.COMPENSATORY) {
      await recalculateCompensatoryBalance(currentUser.id, workYearId);
    } else {
      await recalculateAnnualBalance(currentUser.id, workYearId);
    }
  }

  revalidatePath("/approval");
  revalidatePath("/dashboard");
}

export async function withdrawRequest(id: string) {
  const currentUser = await getCurrentUser();

  const request = await prisma.approvalRequest.findUnique({
    where: { id },
  });
  if (!request) throw new Error("申请不存在");
  if (request.applicantId !== currentUser.id) throw new Error("无权操作");
  if (request.status !== ApprovalStatus.PENDING) {
    throw new Error("只能撤回待审批的申请");
  }

  await prisma.approvalRequest.update({
    where: { id },
    data: { status: ApprovalStatus.WITHDRAWN },
  });

  if (request.type === ApprovalType.LEAVE && request.leaveType) {
    if (request.leaveType === LeaveType.COMPENSATORY) {
      await recalculateCompensatoryBalance(
        request.applicantId,
        request.workYearId
      );
    } else {
      await recalculateAnnualBalance(
        request.applicantId,
        request.workYearId
      );
    }
  }

  revalidatePath("/approval");
  revalidatePath("/dashboard");
}

export async function approveRequest(id: string) {
  const currentUser = await getCurrentUser();

  const request = await prisma.approvalRequest.findUnique({
    where: { id },
  });
  if (!request) throw new Error("申请不存在");
  if (request.status !== ApprovalStatus.PENDING) {
    throw new Error("该申请已处理");
  }

  const canApprove = await canUserApprove(currentUser.id, request.applicantId);
  if (!canApprove) throw new Error("无权审批此申请");

  if (request.type === ApprovalType.OVERTIME) {
    const record = await prisma.overtimeRecord.create({
      data: {
        userId: request.applicantId,
        workYearId: request.workYearId,
        date: request.date,
        days: request.days,
        remark: request.remark,
      },
    });

    await prisma.approvalRequest.update({
      where: { id },
      data: {
        status: ApprovalStatus.APPROVED,
        approverId: currentUser.id,
        overtimeRecordId: record.id,
      },
    });

    await recalculateCompensatoryBalance(
      request.applicantId,
      request.workYearId
    );
  } else {
    const record = await prisma.leaveRecord.create({
      data: {
        userId: request.applicantId,
        workYearId: request.workYearId,
        type: request.leaveType!,
        date: request.date,
        days: request.days,
        remark: request.remark,
      },
    });

    await prisma.approvalRequest.update({
      where: { id },
      data: {
        status: ApprovalStatus.APPROVED,
        approverId: currentUser.id,
        leaveRecordId: record.id,
      },
    });

    if (request.leaveType === LeaveType.COMPENSATORY) {
      await recalculateCompensatoryBalance(
        request.applicantId,
        request.workYearId
      );
    } else {
      await recalculateAnnualBalance(
        request.applicantId,
        request.workYearId
      );
    }
  }

  revalidatePath("/approval");
  revalidatePath("/overtime");
  revalidatePath("/leave");
  revalidatePath("/dashboard");
}

export async function rejectRequest(id: string, formData: FormData) {
  const currentUser = await getCurrentUser();
  const rejectReason = (formData.get("rejectReason") as string) || null;

  const request = await prisma.approvalRequest.findUnique({
    where: { id },
  });
  if (!request) throw new Error("申请不存在");
  if (request.status !== ApprovalStatus.PENDING) {
    throw new Error("该申请已处理");
  }

  const canApprove = await canUserApprove(currentUser.id, request.applicantId);
  if (!canApprove) throw new Error("无权审批此申请");

  await prisma.approvalRequest.update({
    where: { id },
    data: {
      status: ApprovalStatus.REJECTED,
      approverId: currentUser.id,
      rejectReason,
    },
  });

  if (request.type === ApprovalType.LEAVE && request.leaveType) {
    if (request.leaveType === LeaveType.COMPENSATORY) {
      await recalculateCompensatoryBalance(
        request.applicantId,
        request.workYearId
      );
    } else {
      await recalculateAnnualBalance(
        request.applicantId,
        request.workYearId
      );
    }
  }

  revalidatePath("/approval");
  revalidatePath("/dashboard");
}
