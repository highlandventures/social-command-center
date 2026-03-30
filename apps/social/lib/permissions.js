/**
 * Role-based permissions config.
 *
 * Roles: ADMIN, INTERNAL, AGENCY
 *
 * ADMIN / INTERNAL — full access to hub + all dashboard features + all mutations
 * AGENCY           — Social module only; can post + view data/insights; no modify
 */

// Dashboard tab keys that Agency users can see
const AGENCY_DASHBOARD_TABS = [
  '/dashboard',
  '/intelligence',
  '/composer',
  '/calendar',
  '/listening',
  '/kol',
  '/competitors',
  '/reports',
];

const PERMISSIONS = {
  ADMIN: {
    canAccessHub: true,
    canModify: true,
    dashboardTabs: null, // null = all tabs
  },
  INTERNAL: {
    canAccessHub: true,
    canModify: true,
    dashboardTabs: null,
  },
  AGENCY: {
    canAccessHub: false,
    canModify: false,
    dashboardTabs: AGENCY_DASHBOARD_TABS,
  },
};

function get(role) {
  return PERMISSIONS[role] ?? PERMISSIONS.INTERNAL;
}

/** Can this role access the Marketing Hub (hub layout routes)? */
export function canAccessHub(role) {
  return get(role).canAccessHub;
}

/** Can this role perform write/modify operations (non-posting)? */
export function canModify(role) {
  return get(role).canModify;
}

/**
 * Filter dashboard tabs to only those visible for a given role.
 * @param {string} role
 * @param {Array<{key: string, label: string, icon: string}>} allTabs
 */
export function getVisibleTabs(role, allTabs) {
  const allowed = get(role).dashboardTabs;
  if (!allowed) return allTabs;
  return allTabs.filter((tab) => allowed.includes(tab.key));
}
