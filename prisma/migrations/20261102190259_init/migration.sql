-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('NATIVE', 'ERC20', 'STOCK_TOKEN', 'LP_POSITION');

-- CreateEnum
CREATE TYPE "EventKind" AS ENUM ('TRANSFER', 'NATIVE_TRANSFER', 'SWAP', 'LP_ADD', 'LP_REMOVE', 'LP_NFT_TRANSFER', 'CONTRACT_CALL');

-- CreateEnum
CREATE TYPE "RuleType" AS ENUM ('LARGE_TRANSFER', 'NEW_TOKEN_TRADE', 'LP_CHANGE', 'NEW_CONTRACT', 'BALANCE_CHANGE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "walletAddress" TEXT,
    "telegramChatId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chain" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "explorerUrl" TEXT NOT NULL,

    CONSTRAINT "Chain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Token" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "address" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL,
    "assetType" "AssetType" NOT NULL DEFAULT 'ERC20',
    "priceFeed" TEXT,

    CONSTRAINT "Token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatchedWallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "address" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WatchedWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChainEvent" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "txHash" TEXT NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "kind" "EventKind" NOT NULL,
    "wallet" TEXT NOT NULL,
    "protocol" TEXT,
    "contract" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "usdValue" DECIMAL(24,6),
    "priceStale" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChainEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndexerCursor" (
    "chainId" INTEGER NOT NULL,
    "lastBlock" BIGINT NOT NULL,
    "headBlock" BIGINT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndexerCursor_pkey" PRIMARY KEY ("chainId")
);

-- CreateTable
CREATE TABLE "AlertRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletId" TEXT,
    "type" "RuleType" NOT NULL,
    "params" JSONB NOT NULL,
    "channels" TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "eventIds" TEXT[],
    "text" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "deliveredTo" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiCall" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "task" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "costUsd" DECIMAL(14,8) NOT NULL,
    "cached" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountUsd" DECIMAL(14,8) NOT NULL,
    "reason" TEXT NOT NULL,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Token_chainId_address_key" ON "Token"("chainId", "address");

-- CreateIndex
CREATE INDEX "WatchedWallet_chainId_address_idx" ON "WatchedWallet"("chainId", "address");

-- CreateIndex
CREATE UNIQUE INDEX "WatchedWallet_userId_chainId_address_key" ON "WatchedWallet"("userId", "chainId", "address");

-- CreateIndex
CREATE INDEX "ChainEvent_wallet_timestamp_idx" ON "ChainEvent"("wallet", "timestamp");

-- CreateIndex
CREATE INDEX "ChainEvent_chainId_blockNumber_idx" ON "ChainEvent"("chainId", "blockNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ChainEvent_chainId_txHash_logIndex_wallet_key" ON "ChainEvent"("chainId", "txHash", "logIndex", "wallet");

-- CreateIndex
CREATE INDEX "Alert_userId_createdAt_idx" ON "Alert"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiCall_createdAt_idx" ON "AiCall"("createdAt");

-- CreateIndex
CREATE INDEX "CreditEntry_userId_createdAt_idx" ON "CreditEntry"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Token" ADD CONSTRAINT "Token_chainId_fkey" FOREIGN KEY ("chainId") REFERENCES "Chain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatchedWallet" ADD CONSTRAINT "WatchedWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiCall" ADD CONSTRAINT "AiCall_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditEntry" ADD CONSTRAINT "CreditEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
