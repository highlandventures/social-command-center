-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'INTERNAL', 'AGENCY');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('X', 'REDDIT');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('POST', 'THREAD', 'ARTICLE', 'COMMENT');

-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PENDING_APPROVAL', 'APPROVED', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "MentionType" AS ENUM ('MENTION', 'REPLY', 'QUOTE', 'DM');

-- CreateEnum
CREATE TYPE "InboxType" AS ENUM ('COMMENT', 'DM', 'MENTION');

-- CreateEnum
CREATE TYPE "EntityKind" AS ENUM ('BRAND', 'PRODUCT', 'PERSON', 'SUBSIDIARY', 'TOKEN');

-- CreateEnum
CREATE TYPE "AlgoTermKind" AS ENUM ('HIGH_CONFIDENCE', 'ECOSYSTEM');

-- CreateEnum
CREATE TYPE "PollingTier" AS ENUM ('HOT', 'WARM', 'COOL', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "Relevance" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'SPAM');

-- CreateEnum
CREATE TYPE "Sentiment" AS ENUM ('POSITIVE', 'NEUTRAL', 'NEGATIVE');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('RESPOND', 'INTEL', 'OPPORTUNITY', 'CRISIS', 'FYI');

-- CreateEnum
CREATE TYPE "RelationshipType" AS ENUM ('PAID_PARTNER', 'ORGANIC_ADVOCATE', 'ADVISOR', 'PORTFOLIO_FOUNDER', 'RETAIL_ANALYST', 'COMPANY_EXEC');

-- CreateEnum
CREATE TYPE "ActivationType" AS ENUM ('DIRECT_MENTION', 'RETWEET', 'QUOTE_TWEET', 'REPLY', 'THREAD', 'SUBREDDIT_POST', 'COMMENT', 'ORGANIC_ADVOCACY');

-- CreateEnum
CREATE TYPE "InsightType" AS ENUM ('POST_DEBRIEF', 'WEEKLY_SUMMARY', 'DAILY_LISTENING_DIGEST', 'WEEKLY_LANDSCAPE_REPORT', 'OPTIMAL_SCHEDULE', 'AUDIENCE_INSIGHT', 'CONTENT_SUGGESTION', 'PERFORMANCE_PATTERN', 'COMPETITOR_STRATEGY', 'AUDIENCE_QUESTION', 'X_ANALYST_REPORT', 'X_COCREATOR_CONTEXT', 'X_COMPETITOR_AUDIT');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('WEEKLY_PERFORMANCE', 'MONTHLY_SUMMARY', 'COMPETITIVE_ANALYSIS', 'KOL_REPORT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('GENERATING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "TicketType" AS ENUM ('BUG', 'FEATURE_REQUEST');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'AI_REVIEWING', 'RESOLVED', 'WONT_FIX', 'DEFERRED');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "Cadence" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "HomeTaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');

-- CreateEnum
CREATE TYPE "HomeTaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'DISMISSED', 'SNOOZED');

-- CreateEnum
CREATE TYPE "TaskSourceType" AS ENUM ('LISTENING', 'EMAIL', 'CALENDAR', 'CAMPAIGN', 'REPORT', 'MANUAL');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CMO', 'CONTENT_STRATEGIST', 'SOCIAL_MANAGER', 'GROWTH_ANALYST', 'KOL_MANAGER', 'GENERAL');

-- CreateEnum
CREATE TYPE "SubscriberStatus" AS ENUM ('ACTIVE', 'UNSUBSCRIBED', 'BOUNCED', 'COMPLAINED');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "EmailEventType" AS ENUM ('DELIVERED', 'OPENED', 'CLICKED', 'BOUNCED', 'COMPLAINED', 'UNSUBSCRIBED');

-- CreateEnum
CREATE TYPE "GtmCategory" AS ENUM ('GTM', 'EVERGREEN', 'OPERATIONS');

-- CreateEnum
CREATE TYPE "GtmProjectStatus" AS ENUM ('PLANNING', 'ACTIVE', 'COMPLETED', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "GtmHealth" AS ENUM ('ON_TRACK', 'AT_RISK', 'BEHIND');

-- CreateEnum
CREATE TYPE "GtmTaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE');

-- CreateEnum
CREATE TYPE "GtmPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "GtmMomentType" AS ENUM ('LAUNCH', 'TENTPOLE', 'EVENT', 'CAMPAIGN', 'MILESTONE', 'ACTIVATION');

-- CreateEnum
CREATE TYPE "ArtifactType" AS ENUM ('CAMPAIGN', 'PROJECT', 'SUB_PROJECT', 'TASK', 'SUBTASK', 'MILESTONE', 'POST', 'EMAIL', 'ASSET', 'LC_TICKET', 'REPORT');

-- CreateEnum
CREATE TYPE "ArtifactModule" AS ENUM ('SOCIAL', 'GTM', 'EMAIL', 'LC_REVIEW', 'HUB');

-- CreateEnum
CREATE TYPE "ArtifactRelationshipType" AS ENUM ('PARENT_OF', 'CHILD_OF', 'DEPENDS_ON', 'RELATES_TO', 'DERIVED_FROM', 'REVIEWED_BY', 'PUBLISHED_AS');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "role" "Role" NOT NULL DEFAULT 'INTERNAL',
    "invitedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "platformUserId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "subscriptionTier" TEXT NOT NULL DEFAULT 'free',
    "followerCount" INTEGER,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastMentionId" TEXT,
    "lastMentionSyncAt" TIMESTAMP(3),

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_account_access" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "grantedBy" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_account_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "platformPostId" TEXT,
    "content" TEXT NOT NULL,
    "contentType" "ContentType" NOT NULL DEFAULT 'POST',
    "threadId" TEXT,
    "threadPosition" INTEGER,
    "status" "PostStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledFor" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "subreddit" TEXT,
    "flairId" TEXT,
    "articleTitle" TEXT,
    "notionPageId" TEXT,
    "artifactId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_media" (
    "id" TEXT NOT NULL,
    "postId" TEXT,
    "platform" "Platform" NOT NULL,
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "post_metrics" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "engagements" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "retweets" INTEGER NOT NULL DEFAULT 0,
    "replies" INTEGER NOT NULL DEFAULT 0,
    "bookmarks" INTEGER NOT NULL DEFAULT 0,
    "quotes" INTEGER NOT NULL DEFAULT 0,
    "linkClicks" INTEGER NOT NULL DEFAULT 0,
    "profileClicks" INTEGER NOT NULL DEFAULT 0,
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "downvotes" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "awards" INTEGER NOT NULL DEFAULT 0,
    "engagementRate" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "post_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_metrics" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "followers" INTEGER NOT NULL DEFAULT 0,
    "following" INTEGER NOT NULL DEFAULT 0,
    "totalPosts" INTEGER NOT NULL DEFAULT 0,
    "karma" INTEGER,

    CONSTRAINT "account_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mentions" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "platformMentionId" TEXT,
    "authorUsername" TEXT NOT NULL,
    "authorDisplayName" TEXT,
    "content" TEXT NOT NULL,
    "mentionType" "MentionType" NOT NULL,
    "sourceUrl" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "responded" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "mentions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbox_items" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "itemType" "InboxType" NOT NULL,
    "fromUsername" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "threadContext" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "replied" BOOLEAN NOT NULL DEFAULT false,
    "assignedTo" TEXT,
    "internalNotes" TEXT,

    CONSTRAINT "inbox_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listening_topics" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "pollingTier" "PollingTier" NOT NULL DEFAULT 'WARM',
    "pollingTierOverride" "PollingTier",
    "strictRelevance" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "listening_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_entities" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "kind" "EntityKind" NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tickers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "xHandles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "redditUsers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "hashtags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isAmbiguous" BOOLEAN NOT NULL DEFAULT false,
    "qualifiers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "negativeTerms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "minFaves" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_algo_terms" (
    "id" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "kind" "AlgoTermKind" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "addedFromLogId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "global_algo_terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnose_logs" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "url" TEXT,
    "tweetId" TEXT,
    "content" TEXT,
    "authorUsername" TEXT,
    "outcome" TEXT NOT NULL,
    "matchedCount" INTEGER NOT NULL DEFAULT 0,
    "blockedCount" INTEGER NOT NULL DEFAULT 0,
    "resultJson" JSONB,
    "resolvedEntityId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,

    CONSTRAINT "diagnose_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listening_queries" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "queryString" TEXT NOT NULL,
    "negativeKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "subreddits" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "generatedBy" TEXT NOT NULL DEFAULT 'manual',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "estDailyVolume" INTEGER,
    "estMonthlyCost" DOUBLE PRECISION,
    "totalHits" INTEGER NOT NULL DEFAULT 0,
    "actionableHits" INTEGER NOT NULL DEFAULT 0,
    "spamHits" INTEGER NOT NULL DEFAULT 0,
    "dismissedHits" INTEGER NOT NULL DEFAULT 0,
    "avgHeuristic" DOUBLE PRECISION,
    "lastEvaluatedAt" TIMESTAMP(3),
    "lastHitPlatformId" TEXT,
    "lastHitSyncAt" TIMESTAMP(3),
    "sourceEntityId" TEXT,
    "sourceTemplate" TEXT,

    CONSTRAINT "listening_queries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listening_hits" (
    "id" TEXT NOT NULL,
    "queryId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "accountId" TEXT,
    "platform" "Platform" NOT NULL,
    "platformPostId" TEXT,
    "authorUsername" TEXT NOT NULL,
    "authorDisplayName" TEXT,
    "authorProfileImageUrl" TEXT,
    "authorFollowersOrKarma" INTEGER,
    "content" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "subreddit" TEXT,
    "parentThreadTitle" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "engagementCount" INTEGER NOT NULL DEFAULT 0,
    "heuristicScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "aiRelevance" "Relevance",
    "sentiment" "Sentiment",
    "sentimentConfidence" DOUBLE PRECISION,
    "isActionable" BOOLEAN NOT NULL DEFAULT false,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "dismissedBy" TEXT,
    "dismissReason" TEXT,
    "routedToInboxItemId" TEXT,
    "actionType" "ActionType",
    "authorTrustScore" DOUBLE PRECISION,
    "authorEngagementRate" DOUBLE PRECISION,
    "authorAccountAgeDays" INTEGER,
    "authorIsVerified" BOOLEAN NOT NULL DEFAULT false,
    "semanticRelevance" DOUBLE PRECISION,

    CONSTRAINT "listening_hits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monitored_subreddits" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "subredditName" TEXT NOT NULL,
    "suggestedBy" TEXT NOT NULL DEFAULT 'manual',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "avgDailyPosts" INTEGER,
    "avgEngagement" DOUBLE PRECISION,

    CONSTRAINT "monitored_subreddits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subreddit_metrics" (
    "id" TEXT NOT NULL,
    "subredditId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "subscribers" INTEGER NOT NULL DEFAULT 0,
    "postsCount" INTEGER NOT NULL DEFAULT 0,
    "commentsCount" INTEGER NOT NULL DEFAULT 0,
    "avgUpvotes" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgComments" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "topPostScore" INTEGER NOT NULL DEFAULT 0,
    "topPostTitle" TEXT,

    CONSTRAINT "subreddit_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitor_accounts" (
    "id" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "username" TEXT NOT NULL,
    "platformUserId" TEXT,

    CONSTRAINT "competitor_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitor_keywords" (
    "id" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,

    CONSTRAINT "competitor_keywords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitor_metrics" (
    "id" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "followersX" INTEGER NOT NULL DEFAULT 0,
    "followersReddit" INTEGER NOT NULL DEFAULT 0,
    "karmaReddit" INTEGER NOT NULL DEFAULT 0,
    "postsCount" INTEGER NOT NULL DEFAULT 0,
    "avgEngagementRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mentionCount" INTEGER NOT NULL DEFAULT 0,
    "sentimentPositivePct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "shareOfVoicePct" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "competitor_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitor_posts" (
    "id" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "platformPostId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'POST',
    "authorUsername" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "retweets" INTEGER NOT NULL DEFAULT 0,
    "replies" INTEGER NOT NULL DEFAULT 0,
    "quotes" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "engagementRate" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "competitor_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitor_amplifiers" (
    "id" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "username" TEXT NOT NULL,
    "platformUserId" TEXT,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "followersCount" INTEGER NOT NULL DEFAULT 0,
    "amplificationType" TEXT NOT NULL,
    "interactionCount" INTEGER NOT NULL DEFAULT 0,
    "engagementContribution" INTEGER NOT NULL DEFAULT 0,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competitor_amplifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kols" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "username" TEXT NOT NULL,
    "platformUserId" TEXT,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "location" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "followingCount" INTEGER,
    "accountCreatedAt" TIMESTAMP(3),
    "websiteUrl" TEXT,
    "profileSummary" TEXT,
    "profileSummaryUpdatedAt" TIMESTAMP(3),
    "profileEnrichedAt" TIMESTAMP(3),
    "relationshipType" "RelationshipType" NOT NULL,
    "cohortId" TEXT,
    "compensationMonthly" DOUBLE PRECISION,
    "campaignDeliverables" JSONB,
    "baselineFollowers" INTEGER,
    "baselineEngRate" DOUBLE PRECISION,
    "aiScore" TEXT,
    "aiScoreRationale" TEXT,
    "aiScoreUpdatedAt" TIMESTAMP(3),
    "addedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "kols_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kol_cohorts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kol_cohorts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kol_activations" (
    "id" TEXT NOT NULL,
    "kolId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "activationType" "ActivationType" NOT NULL,
    "platformPostId" TEXT,
    "content" TEXT,
    "sourceUrl" TEXT,
    "postedAt" TIMESTAMP(3),
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detectionMethod" TEXT,
    "campaignId" TEXT,
    "sentiment" "Sentiment",
    "metricsAtDetection" JSONB,
    "metricsAt24h" JSONB,
    "metricsAt48h" JSONB,
    "metricsAt7d" JSONB,

    CONSTRAINT "kol_activations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kol_metrics" (
    "id" TEXT NOT NULL,
    "kolId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "followers" INTEGER NOT NULL DEFAULT 0,
    "engagementRateBrand" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "engagementRateBaseline" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "activationsCount" INTEGER NOT NULL DEFAULT 0,
    "totalImpressionsEst" INTEGER NOT NULL DEFAULT 0,
    "avgEngagementPerActivation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sentimentPositivePct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "followerGrowthCorrelation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "aiScore" TEXT,
    "costPerEngagement" DOUBLE PRECISION,

    CONSTRAINT "kol_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_rules" (
    "id" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "conditions" JSONB NOT NULL,
    "actions" JSONB NOT NULL,

    CONSTRAINT "alert_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_insights" (
    "id" TEXT NOT NULL,
    "accountId" TEXT,
    "userId" TEXT,
    "insightType" "InsightType" NOT NULL,
    "content" JSONB NOT NULL,
    "dataRangeStart" TIMESTAMP(3),
    "dataRangeEnd" TIMESTAMP(3),
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "dismissedBy" TEXT,

    CONSTRAINT "ai_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerComment" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_comments" (
    "id" TEXT NOT NULL,
    "approvalRequestId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'app',
    "notionCommentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "reportType" "ReportType" NOT NULL,
    "prompt" TEXT,
    "content" JSONB NOT NULL,
    "aiPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "status" "ReportStatus" NOT NULL DEFAULT 'READY',
    "chartUrls" JSONB,
    "coveragePeriod" JSONB,
    "benchmarkPeriod" JSONB,
    "artifactId" TEXT,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_deliveries" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "recipients" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "copilot_threads" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "copilot_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "copilot_messages" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "copilot_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_call_logs" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "responseTime" INTEGER NOT NULL,
    "tokensUsed" INTEGER,
    "estimatedCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "accountId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cache_entries" (
    "id" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "dataType" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cache_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "type" "TicketType" NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "screenshots" JSONB,
    "createdById" TEXT NOT NULL,
    "aiAnalysis" JSONB,
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_comments" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_schedules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cadence" "Cadence" NOT NULL,
    "reportType" "ReportType" NOT NULL DEFAULT 'WEEKLY_PERFORMANCE',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "recipients" JSONB NOT NULL DEFAULT '[]',
    "createdById" TEXT NOT NULL,
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "lastReportId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adhoc_reports" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "reportId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCOPING',
    "reportParams" JSONB,
    "snapshotIntervals" JSONB,
    "nextSnapshotAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adhoc_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adhoc_report_messages" (
    "id" TEXT NOT NULL,
    "adHocId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "adhoc_report_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestones" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_oauth_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT NOT NULL,
    "googleEmail" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_oauth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "home_tasks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "HomeTaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "HomeTaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "contactId" TEXT,
    "artifactId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "home_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "intelligence_tasks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sourceType" "TaskSourceType" NOT NULL,
    "sourceId" TEXT,
    "sourceUrl" TEXT,
    "actionType" TEXT,
    "suggestedAction" TEXT,
    "priorityScore" INTEGER NOT NULL DEFAULT 50,
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "assignedRole" "UserRole" NOT NULL DEFAULT 'GENERAL',
    "dueDate" TIMESTAMP(3),
    "context" JSONB,
    "snoozedUntil" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "dismissReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "briefingId" TEXT,
    "artifactId" TEXT,

    CONSTRAINT "intelligence_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_briefings" (
    "id" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'GENERAL',
    "summary" TEXT NOT NULL,
    "topPriorities" JSONB NOT NULL,
    "meetingsContext" JSONB,
    "signalsSummary" JSONB,
    "campaignStatus" JSONB,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedBy" TEXT NOT NULL DEFAULT 'system',
    "artifactId" TEXT,

    CONSTRAINT "weekly_briefings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_lists" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_subscribers" (
    "id" TEXT NOT NULL,
    "listId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "status" "SubscriberStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_subscribers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT,
    "htmlBody" TEXT NOT NULL,
    "category" TEXT,
    "isStarter" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "fromName" TEXT,
    "fromEmail" TEXT,
    "replyTo" TEXT,
    "listId" TEXT NOT NULL,
    "templateId" TEXT,
    "htmlContent" TEXT,
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledFor" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "artifactId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_sends" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "messageId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_sends_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_events" (
    "id" TEXT NOT NULL,
    "sendId" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "eventType" "EmailEventType" NOT NULL,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notion_task_inbox" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Not Started',
    "flllcComplianceStatus" TEXT NOT NULL DEFAULT 'Not Needed',
    "fmComplianceStatus" TEXT NOT NULL DEFAULT 'Not Needed',
    "legalStatus" TEXT,
    "reviewPriority" TEXT,
    "due" TIMESTAMP(3),
    "lcDueDate" TIMESTAMP(3),
    "publishDate" TIMESTAMP(3),
    "product" TEXT[],
    "channel" TEXT[],
    "audience" TEXT[],
    "socialChannel" TEXT[],
    "company" TEXT[],
    "geo" TEXT[],
    "editorialReviewStage" TEXT,
    "needComplianceApproval" BOOLEAN NOT NULL DEFAULT false,
    "archivedForCompliance" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "summary" TEXT,
    "lexionUrl" TEXT,
    "shortcutTicketUrl" TEXT,
    "filedBy" TEXT NOT NULL,
    "notionPageId" TEXT,
    "syncedAt" TIMESTAMP(3),
    "artifactId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notion_task_inbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gtm_projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "GtmCategory" NOT NULL DEFAULT 'GTM',
    "aiCategory" "GtmCategory",
    "status" "GtmProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "healthStatus" "GtmHealth" NOT NULL DEFAULT 'ON_TRACK',
    "ownerId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "googleDocUrl" TEXT,
    "artifactId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gtm_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gtm_tasks" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "GtmTaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "GtmPriority" NOT NULL DEFAULT 'MEDIUM',
    "ownerId" TEXT,
    "contactId" TEXT,
    "dueDate" TIMESTAMP(3),
    "artifactId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gtm_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gtm_moments" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "parentMomentId" TEXT,
    "label" TEXT NOT NULL,
    "type" "GtmMomentType" NOT NULL DEFAULT 'MILESTONE',
    "category" TEXT,
    "date" TIMESTAMP(3),
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "artifactId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gtm_moments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gtm_category_corrections" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "aiCategory" "GtmCategory" NOT NULL,
    "userCategory" "GtmCategory" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gtm_category_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gtm_okrs" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "quarter" TEXT NOT NULL,
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gtm_okrs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gtm_key_results" (
    "id" TEXT NOT NULL,
    "okrId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "target" DOUBLE PRECISION NOT NULL,
    "current" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'percent',

    CONSTRAINT "gtm_key_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gtm_products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "positioning" TEXT,
    "messaging" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gtm_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artifacts" (
    "id" TEXT NOT NULL,
    "type" "ArtifactType" NOT NULL,
    "title" TEXT NOT NULL,
    "parentId" TEXT,
    "ownerId" TEXT,
    "status" TEXT,
    "module" "ArtifactModule" NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artifact_relationships" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "relationshipType" "ArtifactRelationshipType" NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMP(3),

    CONSTRAINT "artifact_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_platform_platformUserId_key" ON "accounts"("platform", "platformUserId");

-- CreateIndex
CREATE UNIQUE INDEX "user_account_access_userId_accountId_key" ON "user_account_access"("userId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "posts_artifactId_key" ON "posts"("artifactId");

-- CreateIndex
CREATE INDEX "posts_accountId_status_idx" ON "posts"("accountId", "status");

-- CreateIndex
CREATE INDEX "posts_scheduledFor_idx" ON "posts"("scheduledFor");

-- CreateIndex
CREATE INDEX "posts_platformPostId_idx" ON "posts"("platformPostId");

-- CreateIndex
CREATE INDEX "posts_artifactId_idx" ON "posts"("artifactId");

-- CreateIndex
CREATE INDEX "post_media_postId_idx" ON "post_media"("postId");

-- CreateIndex
CREATE INDEX "post_metrics_postId_fetchedAt_idx" ON "post_metrics"("postId", "fetchedAt");

-- CreateIndex
CREATE INDEX "post_metrics_accountId_fetchedAt_idx" ON "post_metrics"("accountId", "fetchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "account_metrics_accountId_date_key" ON "account_metrics"("accountId", "date");

-- CreateIndex
CREATE INDEX "mentions_accountId_detectedAt_idx" ON "mentions"("accountId", "detectedAt");

-- CreateIndex
CREATE INDEX "inbox_items_accountId_receivedAt_idx" ON "inbox_items"("accountId", "receivedAt");

-- CreateIndex
CREATE INDEX "inbox_items_read_archived_idx" ON "inbox_items"("read", "archived");

-- CreateIndex
CREATE INDEX "brand_entities_topicId_idx" ON "brand_entities"("topicId");

-- CreateIndex
CREATE INDEX "global_algo_terms_kind_enabled_idx" ON "global_algo_terms"("kind", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "global_algo_terms_term_kind_key" ON "global_algo_terms"("term", "kind");

-- CreateIndex
CREATE INDEX "diagnose_logs_createdAt_idx" ON "diagnose_logs"("createdAt");

-- CreateIndex
CREATE INDEX "diagnose_logs_outcome_createdAt_idx" ON "diagnose_logs"("outcome", "createdAt");

-- CreateIndex
CREATE INDEX "listening_queries_sourceEntityId_idx" ON "listening_queries"("sourceEntityId");

-- CreateIndex
CREATE INDEX "listening_hits_topicId_detectedAt_idx" ON "listening_hits"("topicId", "detectedAt");

-- CreateIndex
CREATE INDEX "listening_hits_sentiment_detectedAt_idx" ON "listening_hits"("sentiment", "detectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "monitored_subreddits_topicId_subredditName_key" ON "monitored_subreddits"("topicId", "subredditName");

-- CreateIndex
CREATE UNIQUE INDEX "subreddit_metrics_subredditId_date_key" ON "subreddit_metrics"("subredditId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "competitor_metrics_competitorId_date_key" ON "competitor_metrics"("competitorId", "date");

-- CreateIndex
CREATE INDEX "competitor_posts_competitorId_postedAt_idx" ON "competitor_posts"("competitorId", "postedAt");

-- CreateIndex
CREATE UNIQUE INDEX "competitor_posts_competitorId_platformPostId_key" ON "competitor_posts"("competitorId", "platformPostId");

-- CreateIndex
CREATE INDEX "competitor_amplifiers_competitorId_interactionCount_idx" ON "competitor_amplifiers"("competitorId", "interactionCount");

-- CreateIndex
CREATE UNIQUE INDEX "competitor_amplifiers_competitorId_platform_username_key" ON "competitor_amplifiers"("competitorId", "platform", "username");

-- CreateIndex
CREATE INDEX "kol_activations_kolId_detectedAt_idx" ON "kol_activations"("kolId", "detectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "kol_metrics_kolId_weekStart_key" ON "kol_metrics"("kolId", "weekStart");

-- CreateIndex
CREATE INDEX "ai_insights_insightType_generatedAt_idx" ON "ai_insights"("insightType", "generatedAt");

-- CreateIndex
CREATE INDEX "approval_requests_status_idx" ON "approval_requests"("status");

-- CreateIndex
CREATE INDEX "approval_comments_approvalRequestId_idx" ON "approval_comments"("approvalRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "reports_artifactId_key" ON "reports"("artifactId");

-- CreateIndex
CREATE INDEX "reports_artifactId_idx" ON "reports"("artifactId");

-- CreateIndex
CREATE INDEX "copilot_threads_userId_updatedAt_idx" ON "copilot_threads"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "copilot_messages_threadId_createdAt_idx" ON "copilot_messages"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_userId_timestamp_idx" ON "audit_logs"("userId", "timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_action_timestamp_idx" ON "audit_logs"("action", "timestamp");

-- CreateIndex
CREATE INDEX "api_call_logs_provider_timestamp_idx" ON "api_call_logs"("provider", "timestamp");

-- CreateIndex
CREATE INDEX "api_call_logs_accountId_timestamp_idx" ON "api_call_logs"("accountId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "cache_entries_cacheKey_key" ON "cache_entries"("cacheKey");

-- CreateIndex
CREATE INDEX "cache_entries_expiresAt_idx" ON "cache_entries"("expiresAt");

-- CreateIndex
CREATE INDEX "tickets_type_status_idx" ON "tickets"("type", "status");

-- CreateIndex
CREATE INDEX "tickets_createdById_idx" ON "tickets"("createdById");

-- CreateIndex
CREATE INDEX "ticket_comments_ticketId_idx" ON "ticket_comments"("ticketId");

-- CreateIndex
CREATE INDEX "report_schedules_enabled_nextRunAt_idx" ON "report_schedules"("enabled", "nextRunAt");

-- CreateIndex
CREATE INDEX "adhoc_reports_createdById_updatedAt_idx" ON "adhoc_reports"("createdById", "updatedAt");

-- CreateIndex
CREATE INDEX "adhoc_report_messages_adHocId_createdAt_idx" ON "adhoc_report_messages"("adHocId", "createdAt");

-- CreateIndex
CREATE INDEX "milestones_startDate_endDate_idx" ON "milestones"("startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "google_oauth_tokens_userId_key" ON "google_oauth_tokens"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "home_tasks_artifactId_key" ON "home_tasks"("artifactId");

-- CreateIndex
CREATE INDEX "home_tasks_userId_status_idx" ON "home_tasks"("userId", "status");

-- CreateIndex
CREATE INDEX "home_tasks_userId_dueDate_idx" ON "home_tasks"("userId", "dueDate");

-- CreateIndex
CREATE INDEX "home_tasks_artifactId_idx" ON "home_tasks"("artifactId");

-- CreateIndex
CREATE UNIQUE INDEX "intelligence_tasks_artifactId_key" ON "intelligence_tasks"("artifactId");

-- CreateIndex
CREATE INDEX "intelligence_tasks_status_priorityScore_idx" ON "intelligence_tasks"("status", "priorityScore");

-- CreateIndex
CREATE INDEX "intelligence_tasks_assignedRole_status_idx" ON "intelligence_tasks"("assignedRole", "status");

-- CreateIndex
CREATE INDEX "intelligence_tasks_sourceType_sourceId_idx" ON "intelligence_tasks"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "intelligence_tasks_artifactId_idx" ON "intelligence_tasks"("artifactId");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_briefings_artifactId_key" ON "weekly_briefings"("artifactId");

-- CreateIndex
CREATE INDEX "weekly_briefings_artifactId_idx" ON "weekly_briefings"("artifactId");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_briefings_weekStart_role_key" ON "weekly_briefings"("weekStart", "role");

-- CreateIndex
CREATE INDEX "email_lists_createdById_idx" ON "email_lists"("createdById");

-- CreateIndex
CREATE INDEX "email_subscribers_listId_status_idx" ON "email_subscribers"("listId", "status");

-- CreateIndex
CREATE INDEX "email_subscribers_email_idx" ON "email_subscribers"("email");

-- CreateIndex
CREATE UNIQUE INDEX "email_subscribers_listId_email_key" ON "email_subscribers"("listId", "email");

-- CreateIndex
CREATE INDEX "email_templates_createdById_idx" ON "email_templates"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "email_campaigns_artifactId_key" ON "email_campaigns"("artifactId");

-- CreateIndex
CREATE INDEX "email_campaigns_status_idx" ON "email_campaigns"("status");

-- CreateIndex
CREATE INDEX "email_campaigns_listId_idx" ON "email_campaigns"("listId");

-- CreateIndex
CREATE INDEX "email_campaigns_artifactId_idx" ON "email_campaigns"("artifactId");

-- CreateIndex
CREATE INDEX "email_sends_campaignId_status_idx" ON "email_sends"("campaignId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "email_sends_campaignId_subscriberId_key" ON "email_sends"("campaignId", "subscriberId");

-- CreateIndex
CREATE INDEX "email_events_sendId_idx" ON "email_events"("sendId");

-- CreateIndex
CREATE INDEX "email_events_subscriberId_eventType_idx" ON "email_events"("subscriberId", "eventType");

-- CreateIndex
CREATE INDEX "email_events_occurredAt_idx" ON "email_events"("occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "notion_task_inbox_artifactId_key" ON "notion_task_inbox"("artifactId");

-- CreateIndex
CREATE INDEX "notion_task_inbox_userId_idx" ON "notion_task_inbox"("userId");

-- CreateIndex
CREATE INDEX "notion_task_inbox_syncedAt_idx" ON "notion_task_inbox"("syncedAt");

-- CreateIndex
CREATE INDEX "notion_task_inbox_createdAt_idx" ON "notion_task_inbox"("createdAt");

-- CreateIndex
CREATE INDEX "notion_task_inbox_artifactId_idx" ON "notion_task_inbox"("artifactId");

-- CreateIndex
CREATE UNIQUE INDEX "gtm_projects_artifactId_key" ON "gtm_projects"("artifactId");

-- CreateIndex
CREATE INDEX "gtm_projects_ownerId_idx" ON "gtm_projects"("ownerId");

-- CreateIndex
CREATE INDEX "gtm_projects_status_idx" ON "gtm_projects"("status");

-- CreateIndex
CREATE INDEX "gtm_projects_artifactId_idx" ON "gtm_projects"("artifactId");

-- CreateIndex
CREATE UNIQUE INDEX "gtm_tasks_artifactId_key" ON "gtm_tasks"("artifactId");

-- CreateIndex
CREATE INDEX "gtm_tasks_projectId_idx" ON "gtm_tasks"("projectId");

-- CreateIndex
CREATE INDEX "gtm_tasks_ownerId_idx" ON "gtm_tasks"("ownerId");

-- CreateIndex
CREATE INDEX "gtm_tasks_dueDate_idx" ON "gtm_tasks"("dueDate");

-- CreateIndex
CREATE INDEX "gtm_tasks_artifactId_idx" ON "gtm_tasks"("artifactId");

-- CreateIndex
CREATE UNIQUE INDEX "gtm_moments_artifactId_key" ON "gtm_moments"("artifactId");

-- CreateIndex
CREATE INDEX "gtm_moments_projectId_idx" ON "gtm_moments"("projectId");

-- CreateIndex
CREATE INDEX "gtm_moments_parentMomentId_idx" ON "gtm_moments"("parentMomentId");

-- CreateIndex
CREATE INDEX "gtm_moments_date_idx" ON "gtm_moments"("date");

-- CreateIndex
CREATE INDEX "gtm_moments_artifactId_idx" ON "gtm_moments"("artifactId");

-- CreateIndex
CREATE INDEX "gtm_category_corrections_createdAt_idx" ON "gtm_category_corrections"("createdAt");

-- CreateIndex
CREATE INDEX "gtm_key_results_okrId_idx" ON "gtm_key_results"("okrId");

-- CreateIndex
CREATE INDEX "artifacts_type_idx" ON "artifacts"("type");

-- CreateIndex
CREATE INDEX "artifacts_module_type_idx" ON "artifacts"("module", "type");

-- CreateIndex
CREATE INDEX "artifacts_parentId_idx" ON "artifacts"("parentId");

-- CreateIndex
CREATE INDEX "artifacts_ownerId_idx" ON "artifacts"("ownerId");

-- CreateIndex
CREATE INDEX "artifacts_archivedAt_idx" ON "artifacts"("archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "artifacts_module_entityId_key" ON "artifacts"("module", "entityId");

-- CreateIndex
CREATE INDEX "artifact_relationships_sourceId_relationshipType_idx" ON "artifact_relationships"("sourceId", "relationshipType");

-- CreateIndex
CREATE INDEX "artifact_relationships_targetId_relationshipType_idx" ON "artifact_relationships"("targetId", "relationshipType");

-- CreateIndex
CREATE INDEX "artifact_relationships_archivedAt_idx" ON "artifact_relationships"("archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "artifact_relationships_sourceId_targetId_relationshipType_key" ON "artifact_relationships"("sourceId", "targetId", "relationshipType");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_account_access" ADD CONSTRAINT "user_account_access_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_account_access" ADD CONSTRAINT "user_account_access_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_media" ADD CONSTRAINT "post_media_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_metrics" ADD CONSTRAINT "post_metrics_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_metrics" ADD CONSTRAINT "post_metrics_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_metrics" ADD CONSTRAINT "account_metrics_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mentions" ADD CONSTRAINT "mentions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbox_items" ADD CONSTRAINT "inbox_items_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_entities" ADD CONSTRAINT "brand_entities_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "listening_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listening_queries" ADD CONSTRAINT "listening_queries_sourceEntityId_fkey" FOREIGN KEY ("sourceEntityId") REFERENCES "brand_entities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listening_queries" ADD CONSTRAINT "listening_queries_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "listening_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listening_hits" ADD CONSTRAINT "listening_hits_queryId_fkey" FOREIGN KEY ("queryId") REFERENCES "listening_queries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listening_hits" ADD CONSTRAINT "listening_hits_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "listening_topics"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listening_hits" ADD CONSTRAINT "listening_hits_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitored_subreddits" ADD CONSTRAINT "monitored_subreddits_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "listening_topics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subreddit_metrics" ADD CONSTRAINT "subreddit_metrics_subredditId_fkey" FOREIGN KEY ("subredditId") REFERENCES "monitored_subreddits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitor_accounts" ADD CONSTRAINT "competitor_accounts_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "competitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitor_keywords" ADD CONSTRAINT "competitor_keywords_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "competitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitor_metrics" ADD CONSTRAINT "competitor_metrics_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "competitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitor_posts" ADD CONSTRAINT "competitor_posts_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "competitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitor_amplifiers" ADD CONSTRAINT "competitor_amplifiers_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "competitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kols" ADD CONSTRAINT "kols_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "kol_cohorts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kol_activations" ADD CONSTRAINT "kol_activations_kolId_fkey" FOREIGN KEY ("kolId") REFERENCES "kols"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kol_metrics" ADD CONSTRAINT "kol_metrics_kolId_fkey" FOREIGN KEY ("kolId") REFERENCES "kols"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_rules" ADD CONSTRAINT "alert_rules_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_insights" ADD CONSTRAINT "ai_insights_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_insights" ADD CONSTRAINT "ai_insights_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_comments" ADD CONSTRAINT "approval_comments_approvalRequestId_fkey" FOREIGN KEY ("approvalRequestId") REFERENCES "approval_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_deliveries" ADD CONSTRAINT "report_deliveries_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copilot_threads" ADD CONSTRAINT "copilot_threads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copilot_messages" ADD CONSTRAINT "copilot_messages_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "copilot_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_comments" ADD CONSTRAINT "ticket_comments_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adhoc_report_messages" ADD CONSTRAINT "adhoc_report_messages_adHocId_fkey" FOREIGN KEY ("adHocId") REFERENCES "adhoc_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_oauth_tokens" ADD CONSTRAINT "google_oauth_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_tasks" ADD CONSTRAINT "home_tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_tasks" ADD CONSTRAINT "home_tasks_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "home_tasks" ADD CONSTRAINT "home_tasks_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_tasks" ADD CONSTRAINT "intelligence_tasks_briefingId_fkey" FOREIGN KEY ("briefingId") REFERENCES "weekly_briefings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intelligence_tasks" ADD CONSTRAINT "intelligence_tasks_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_briefings" ADD CONSTRAINT "weekly_briefings_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_subscribers" ADD CONSTRAINT "email_subscribers_listId_fkey" FOREIGN KEY ("listId") REFERENCES "email_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_listId_fkey" FOREIGN KEY ("listId") REFERENCES "email_lists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "email_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_sends" ADD CONSTRAINT "email_sends_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "email_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_sends" ADD CONSTRAINT "email_sends_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "email_subscribers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_sendId_fkey" FOREIGN KEY ("sendId") REFERENCES "email_sends"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "email_subscribers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notion_task_inbox" ADD CONSTRAINT "notion_task_inbox_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notion_task_inbox" ADD CONSTRAINT "notion_task_inbox_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gtm_projects" ADD CONSTRAINT "gtm_projects_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gtm_projects" ADD CONSTRAINT "gtm_projects_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gtm_tasks" ADD CONSTRAINT "gtm_tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "gtm_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gtm_tasks" ADD CONSTRAINT "gtm_tasks_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gtm_tasks" ADD CONSTRAINT "gtm_tasks_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gtm_tasks" ADD CONSTRAINT "gtm_tasks_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gtm_moments" ADD CONSTRAINT "gtm_moments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "gtm_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gtm_moments" ADD CONSTRAINT "gtm_moments_parentMomentId_fkey" FOREIGN KEY ("parentMomentId") REFERENCES "gtm_moments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gtm_moments" ADD CONSTRAINT "gtm_moments_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gtm_category_corrections" ADD CONSTRAINT "gtm_category_corrections_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "gtm_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gtm_key_results" ADD CONSTRAINT "gtm_key_results_okrId_fkey" FOREIGN KEY ("okrId") REFERENCES "gtm_okrs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifact_relationships" ADD CONSTRAINT "artifact_relationships_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifact_relationships" ADD CONSTRAINT "artifact_relationships_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifact_relationships" ADD CONSTRAINT "artifact_relationships_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

