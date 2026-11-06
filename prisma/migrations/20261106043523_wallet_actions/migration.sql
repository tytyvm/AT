-- CreateEnum
CREATE TYPE "ActionKind" AS ENUM ('BUY', 'SELL', 'SWAP', 'SEND', 'RECEIVE', 'LP_ADD', 'LP_REMOVE');

-- CreateTable
CREATE TABLE "WalletAction" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "txHash" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "kind" "ActionKind" NOT NULL,
    "venue" TEXT,
    "counterparty" TEXT,
    "legs" JSONB NOT NULL,
    "usdValue" DECIMAL(24,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WalletAction_wallet_timestamp_idx" ON "WalletAction"("wallet", "timestamp");

-- CreateIndex
CREATE INDEX "WalletAction_chainId_blockNumber_idx" ON "WalletAction"("chainId", "blockNumber");

-- CreateIndex
CREATE UNIQUE INDEX "WalletAction_chainId_txHash_wallet_key" ON "WalletAction"("chainId", "txHash", "wallet");
