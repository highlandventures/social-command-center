/**
 * Artifact graph type mirrors and module-table mapping helpers.
 *
 * The enum-mirror objects below are kept in sync with the Prisma enums in
 * schema.prisma (ArtifactType, ArtifactModule, ArtifactRelationshipType).
 * String values match the Prisma enum value names exactly.
 *
 * See .planning/phases/17-artifact-graph-foundation/17-01-PLAN.md
 */

export const ARTIFACT_TYPE = Object.freeze({
  CAMPAIGN: 'CAMPAIGN',
  PROJECT: 'PROJECT',
  SUB_PROJECT: 'SUB_PROJECT',
  TASK: 'TASK',
  SUBTASK: 'SUBTASK',
  MILESTONE: 'MILESTONE',
  POST: 'POST',
  EMAIL: 'EMAIL',
  ASSET: 'ASSET',
  LC_TICKET: 'LC_TICKET',
  REPORT: 'REPORT',
});

export const ARTIFACT_MODULE = Object.freeze({
  SOCIAL: 'SOCIAL',
  GTM: 'GTM',
  EMAIL: 'EMAIL',
  LC_REVIEW: 'LC_REVIEW',
  HUB: 'HUB',
});

export const RELATIONSHIP_TYPE = Object.freeze({
  PARENT_OF: 'PARENT_OF',
  CHILD_OF: 'CHILD_OF',
  DEPENDS_ON: 'DEPENDS_ON',
  RELATES_TO: 'RELATES_TO',
  DERIVED_FROM: 'DERIVED_FROM',
  REVIEWED_BY: 'REVIEWED_BY',
  PUBLISHED_AS: 'PUBLISHED_AS',
});

const PRISMA_MODEL_TO_MODULE = Object.freeze({
  post: ARTIFACT_MODULE.SOCIAL,
  report: ARTIFACT_MODULE.SOCIAL,
  gtmProject: ARTIFACT_MODULE.GTM,
  gtmTask: ARTIFACT_MODULE.GTM,
  gtmMoment: ARTIFACT_MODULE.GTM,
  emailCampaign: ARTIFACT_MODULE.EMAIL,
  notionTaskInbox: ARTIFACT_MODULE.LC_REVIEW,
  homeTask: ARTIFACT_MODULE.HUB,
  intelligenceTask: ARTIFACT_MODULE.HUB,
  weeklyBriefing: ARTIFACT_MODULE.HUB,
});

export function moduleForPrismaModel(prismaModel) {
  const module = PRISMA_MODEL_TO_MODULE[prismaModel];
  if (!module) {
    throw new Error(`Unknown prismaModel for artifact graph: ${prismaModel}`);
  }
  return module;
}

const GTM_MOMENT_CAMPAIGN_TYPES = new Set(['LAUNCH', 'TENTPOLE', 'CAMPAIGN']);

/**
 * defaultTypeForModule — derives the default ArtifactType for a given module row.
 *
 * @param {object} args
 * @param {string} args.prismaModel  Prisma delegate name ('post', 'gtmProject', etc.)
 * @param {object} [args.entity]     The module row itself (used for subtype discriminators)
 * @param {object} [args.flags]      Caller-supplied overrides (e.g. { isCampaign: true })
 * @returns {string} ArtifactType enum value
 */
export function defaultTypeForModule({ prismaModel, entity = {}, flags = {} } = {}) {
  switch (prismaModel) {
    case 'post':
      return ARTIFACT_TYPE.POST;
    case 'report':
      return ARTIFACT_TYPE.REPORT;
    case 'gtmProject':
      return flags.isCampaign ? ARTIFACT_TYPE.CAMPAIGN : ARTIFACT_TYPE.PROJECT;
    case 'gtmTask':
      return ARTIFACT_TYPE.TASK;
    case 'gtmMoment':
      return GTM_MOMENT_CAMPAIGN_TYPES.has(entity.type)
        ? ARTIFACT_TYPE.CAMPAIGN
        : ARTIFACT_TYPE.MILESTONE;
    case 'emailCampaign':
      return ARTIFACT_TYPE.EMAIL;
    case 'notionTaskInbox':
      return ARTIFACT_TYPE.LC_TICKET;
    case 'homeTask':
      return ARTIFACT_TYPE.TASK;
    case 'intelligenceTask':
      return ARTIFACT_TYPE.TASK;
    case 'weeklyBriefing':
      return ARTIFACT_TYPE.REPORT;
    default:
      throw new Error(`No default ArtifactType for prismaModel: ${prismaModel}`);
  }
}
