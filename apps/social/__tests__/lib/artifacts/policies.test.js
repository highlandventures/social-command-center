import { describe, it, expect } from 'vitest';
import {
  MODULE_POLICY,
  canRead,
  canWrite,
  canFlipType,
} from '@/lib/artifacts/policies';

const MODULES = ['SOCIAL', 'GTM', 'EMAIL', 'LC_REVIEW', 'HUB'];
const ROLES = ['ADMIN', 'INTERNAL', 'AGENCY'];

function mkUser(id, role) {
  return { id, role };
}
function mkArtifact(module, ownerId = null) {
  return { module, ownerId };
}

describe('MODULE_POLICY matrix', () => {
  it('defines read + write arrays for every module', () => {
    for (const m of MODULES) {
      expect(MODULE_POLICY[m]).toBeDefined();
      expect(Array.isArray(MODULE_POLICY[m].read)).toBe(true);
      expect(Array.isArray(MODULE_POLICY[m].write)).toBe(true);
    }
  });

  it('is frozen (cannot be mutated)', () => {
    expect(() => {
      MODULE_POLICY.SOCIAL.read.push('HACKER');
    }).toThrow();
  });
});

describe('canRead', () => {
  it('ADMIN can read every module', () => {
    for (const m of MODULES) {
      expect(canRead(mkUser('u', 'ADMIN'), mkArtifact(m))).toBe(true);
    }
  });

  it('INTERNAL can read every module', () => {
    for (const m of MODULES) {
      expect(canRead(mkUser('u', 'INTERNAL'), mkArtifact(m))).toBe(true);
    }
  });

  it('AGENCY can read SOCIAL / GTM / HUB but not EMAIL / LC_REVIEW', () => {
    const agency = mkUser('u', 'AGENCY');
    expect(canRead(agency, mkArtifact('SOCIAL'))).toBe(true);
    expect(canRead(agency, mkArtifact('GTM'))).toBe(true);
    expect(canRead(agency, mkArtifact('HUB'))).toBe(true);
    expect(canRead(agency, mkArtifact('EMAIL'))).toBe(false);
    expect(canRead(agency, mkArtifact('LC_REVIEW'))).toBe(false);
  });

  it('ownership override: AGENCY can read their own EMAIL / LC_REVIEW artifact', () => {
    const agency = mkUser('u1', 'AGENCY');
    expect(canRead(agency, mkArtifact('EMAIL', 'u1'))).toBe(true);
    expect(canRead(agency, mkArtifact('LC_REVIEW', 'u1'))).toBe(true);
  });

  it('returns false for invalid inputs', () => {
    expect(canRead(null, mkArtifact('SOCIAL'))).toBe(false);
    expect(canRead(mkUser('u', 'ADMIN'), null)).toBe(false);
    expect(canRead(mkUser('u', 'ADMIN'), { module: 'UNKNOWN' })).toBe(false);
  });
});

describe('canWrite', () => {
  it('ADMIN and INTERNAL can write every module', () => {
    for (const m of MODULES) {
      expect(canWrite(mkUser('u', 'ADMIN'), mkArtifact(m))).toBe(true);
      expect(canWrite(mkUser('u', 'INTERNAL'), mkArtifact(m))).toBe(true);
    }
  });

  it('AGENCY cannot write any module by role alone', () => {
    for (const m of MODULES) {
      expect(canWrite(mkUser('u', 'AGENCY'), mkArtifact(m))).toBe(false);
    }
  });

  it('ownership override: AGENCY can write their own artifact in any module', () => {
    const agency = mkUser('u1', 'AGENCY');
    for (const m of MODULES) {
      expect(canWrite(agency, mkArtifact(m, 'u1'))).toBe(true);
    }
  });

  it('ownership override only applies when user.id matches ownerId', () => {
    const agency = mkUser('u1', 'AGENCY');
    expect(canWrite(agency, mkArtifact('SOCIAL', 'u2'))).toBe(false);
  });

  it('returns false for invalid inputs', () => {
    expect(canWrite(null, mkArtifact('SOCIAL'))).toBe(false);
    expect(canWrite(mkUser('u', 'ADMIN'), null)).toBe(false);
  });
});

describe('canFlipType', () => {
  it('only ADMIN can flip type', () => {
    expect(canFlipType(mkUser('u', 'ADMIN'))).toBe(true);
    expect(canFlipType(mkUser('u', 'INTERNAL'))).toBe(false);
    expect(canFlipType(mkUser('u', 'AGENCY'))).toBe(false);
  });

  it('returns false for missing user', () => {
    expect(canFlipType(null)).toBe(false);
    expect(canFlipType(undefined)).toBe(false);
    expect(canFlipType({})).toBe(false);
  });
});
