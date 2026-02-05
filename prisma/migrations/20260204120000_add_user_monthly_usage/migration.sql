-- CreateTable
CREATE TABLE "user_monthly_usage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "monthStart" TIMESTAMP(3) NOT NULL,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_monthly_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_monthly_usage_userId_monthStart_key" ON "user_monthly_usage"("userId", "monthStart");

-- CreateIndex
CREATE INDEX "user_monthly_usage_monthStart_idx" ON "user_monthly_usage"("monthStart");

-- AddForeignKey
ALTER TABLE "user_monthly_usage" ADD CONSTRAINT "user_monthly_usage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
