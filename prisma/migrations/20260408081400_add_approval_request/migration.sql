-- CreateEnum
CREATE TYPE "ApprovalType" AS ENUM ('OVERTIME', 'LEAVE');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "type" "ApprovalType" NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "applicantId" TEXT NOT NULL,
    "approverId" TEXT,
    "workYearId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "days" DECIMAL(3,1) NOT NULL,
    "leaveType" "LeaveType",
    "remark" TEXT,
    "rejectReason" TEXT,
    "overtimeRecordId" TEXT,
    "leaveRecordId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalRequest_overtimeRecordId_key" ON "ApprovalRequest"("overtimeRecordId");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalRequest_leaveRecordId_key" ON "ApprovalRequest"("leaveRecordId");

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_workYearId_fkey" FOREIGN KEY ("workYearId") REFERENCES "WorkYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_overtimeRecordId_fkey" FOREIGN KEY ("overtimeRecordId") REFERENCES "OvertimeRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_leaveRecordId_fkey" FOREIGN KEY ("leaveRecordId") REFERENCES "LeaveRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
