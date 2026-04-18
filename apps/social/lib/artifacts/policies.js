/**
 * Declarative authorization policy for the artifact graph.
 *
 * Today this compiles to tRPC middleware checks inside `hub.*` procedures.
 * When/if the project moves to Supabase, the same matrix + ownership-override
 * translates mechanically to `pg_policies`:
 *
 *   MODULE_POLICY.SOCIAL.read = ['ADMIN','INTERNAL','AGENCY']
 *     → USING (auth.role() IN ('admin','internal','agency'))
 *
 *   ownership override (user.id === artifact.ownerId)
 *     → OR auth.uid() = owner_id
 *
 * See .planning/phases/17-artifact-graph-foundation/17-02-PLAN.md (Task 1)
 */

export const MODULE_POLICY = Object.freeze({
  SOCIAL: Object.freeze({
    read: Object.freeze(['ADMIN', 'INTERNAL', 'AGENCY']),
    write: Object.freeze(['ADMIN', 'INTERNAL']),
  }),
  GTM: Object.freeze({
    read: Object.freeze(['ADMIN', 'INTERNAL', 'AGENCY']),
    write: Object.freeze(['ADMIN', 'INTERNAL']),
  }),
  EMAIL: Object.freeze({
    read: Object.freeze(['ADMIN', 'INTERNAL']),
    write: Object.freeze(['ADMIN', 'INTERNAL']),
  }),
  LC_REVIEW: Object.freeze({
    read: Object.freeze(['ADMIN', 'INTERNAL']),
    write: Object.freeze(['ADMIN', 'INTERNAL']),
  }),
  HUB: Object.freeze({
    read: Object.freeze(['ADMIN', 'INTERNAL', 'AGENCY']),
    write: Object.freeze(['ADMIN', 'INTERNAL']),
  }),
});

function validInputs(user, artifact) {
  return (
    user &&
    typeof user.id === 'string' &&
    typeof user.role === 'string' &&
    artifact &&
    typeof artifact.module === 'string'
  );
}

/**
 * canRead — true iff the user can read an artifact.
 * Role gate OR ownership override.
 */
export function canRead(user, artifact) {
  if (!validInputs(user, artifact)) return false;
  const rule = MODULE_POLICY[artifact.module];
  if (!rule) return false;
  if (rule.read.includes(user.role)) return true;
  if (artifact.ownerId && user.id === artifact.ownerId) return true;
  return false;
}

/**
 * canWrite — true iff the user can mutate an artifact.
 * Role gate OR ownership override.
 */
export function canWrite(user, artifact) {
  if (!validInputs(user, artifact)) return false;
  const rule = MODULE_POLICY[artifact.module];
  if (!rule) return false;
  if (rule.write.includes(user.role)) return true;
  if (artifact.ownerId && user.id === artifact.ownerId) return true;
  return false;
}

/**
 * canFlipType — only ADMIN can change an artifact's `type` after creation
 * (PRD §6.D "confirmation on destructive ops" spirit).
 */
export function canFlipType(user) {
  return Boolean(user && user.role === 'ADMIN');
}
