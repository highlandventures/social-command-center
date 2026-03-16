-- Add new RelationshipType enum values
-- Run this against the production database before or after deploy:
--   psql $POSTGRES_URL -f prisma/add-retail-analyst-type.sql

ALTER TYPE "RelationshipType" ADD VALUE IF NOT EXISTS 'RETAIL_ANALYST';
ALTER TYPE "RelationshipType" ADD VALUE IF NOT EXISTS 'COMPANY_EXEC';
