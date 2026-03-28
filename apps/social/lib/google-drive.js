/**
 * Google Drive API helpers using native fetch.
 * Follows the same pattern as lib/google-apis.js (Gmail + Calendar).
 */

const DRIVE_API = 'https://www.googleapis.com/drive/v3';

/**
 * List recent files the user has access to.
 *
 * @param {string} accessToken - Valid Google OAuth access token
 * @param {Object} opts
 * @param {number}  [opts.pageSize=10]   - Max files to return
 * @param {string}  [opts.orderBy='modifiedByMeTime desc'] - Sort order
 * @param {string}  [opts.query]         - Optional Drive search query (q param)
 * @param {string}  [opts.pageToken]     - Pagination token for next page
 * @returns {{ files: Array, nextPageToken: string|null }}
 */
export async function listDriveFiles(accessToken, {
  pageSize = 10,
  orderBy = 'modifiedTime desc',
  query,
  pageToken,
} = {}) {
  const params = new URLSearchParams({
    pageSize: String(pageSize),
    orderBy,
    fields: 'nextPageToken,files(id,name,mimeType,modifiedTime,webViewLink,iconLink,thumbnailLink,owners,shared,starred)',
  });

  // Exclude trashed files by default
  const baseQuery = query ? `${query} and trashed = false` : 'trashed = false';
  params.set('q', baseQuery);
  if (pageToken) params.set('pageToken', pageToken);

  const res = await fetch(`${DRIVE_API}/files?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Drive list failed: ${res.status} ${err}`);
  }

  const data = await res.json();

  return {
    files: (data.files || []).map(normalizeDriveFile),
    nextPageToken: data.nextPageToken || null,
  };
}

/**
 * Search Drive files by name or content.
 *
 * @param {string} accessToken
 * @param {string} searchTerm  - Text to search for
 * @param {Object} opts
 * @param {number}  [opts.pageSize=10]
 * @param {string}  [opts.mimeType] - Optional MIME filter (e.g. 'application/vnd.google-apps.document')
 * @returns {{ files: Array, nextPageToken: string|null }}
 */
export async function searchDriveFiles(accessToken, searchTerm, { pageSize = 10, mimeType } = {}) {
  const queryParts = [`fullText contains '${searchTerm.replace(/'/g, "\\'")}'`];

  if (mimeType) {
    queryParts.push(`mimeType = '${mimeType}'`);
  }

  // Exclude trashed files
  queryParts.push('trashed = false');

  return listDriveFiles(accessToken, {
    pageSize,
    query: queryParts.join(' and '),
    orderBy: 'relevance',
  });
}

/**
 * Get metadata for a single file.
 *
 * @param {string} accessToken
 * @param {string} fileId
 * @returns {Object} Normalized file metadata
 */
export async function getDriveFile(accessToken, fileId) {
  const fields = 'id,name,mimeType,modifiedTime,createdTime,webViewLink,iconLink,thumbnailLink,owners,shared,starred,description,size';

  const res = await fetch(`${DRIVE_API}/files/${fileId}?fields=${fields}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Drive file fetch failed: ${res.status} ${err}`);
  }

  const file = await res.json();
  return normalizeDriveFile(file);
}

/**
 * List files in a specific Drive folder.
 *
 * @param {string} accessToken
 * @param {string} folderId
 * @param {Object} opts
 * @param {number}  [opts.pageSize=20]
 * @returns {{ files: Array, nextPageToken: string|null }}
 */
export async function listFolderContents(accessToken, folderId, { pageSize = 20 } = {}) {
  return listDriveFiles(accessToken, {
    pageSize,
    query: `'${folderId}' in parents and trashed = false`,
    orderBy: 'folder,modifiedTime desc',
  });
}

// ---- Google Workspace MIME type helpers ----

export const DRIVE_MIME_TYPES = {
  FOLDER: 'application/vnd.google-apps.folder',
  DOCUMENT: 'application/vnd.google-apps.document',
  SPREADSHEET: 'application/vnd.google-apps.spreadsheet',
  PRESENTATION: 'application/vnd.google-apps.presentation',
  FORM: 'application/vnd.google-apps.form',
  DRAWING: 'application/vnd.google-apps.drawing',
};

/**
 * Map a MIME type to a human-friendly file type label.
 */
export function getFileTypeLabel(mimeType) {
  const map = {
    [DRIVE_MIME_TYPES.FOLDER]: 'Folder',
    [DRIVE_MIME_TYPES.DOCUMENT]: 'Google Doc',
    [DRIVE_MIME_TYPES.SPREADSHEET]: 'Google Sheet',
    [DRIVE_MIME_TYPES.PRESENTATION]: 'Google Slides',
    [DRIVE_MIME_TYPES.FORM]: 'Google Form',
    [DRIVE_MIME_TYPES.DRAWING]: 'Google Drawing',
    'application/pdf': 'PDF',
    'image/png': 'PNG Image',
    'image/jpeg': 'JPEG Image',
    'text/plain': 'Text File',
    'text/csv': 'CSV',
  };
  return map[mimeType] || mimeType?.split('/').pop() || 'File';
}

// ---- Internal ----

function normalizeDriveFile(file) {
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    typeLabel: getFileTypeLabel(file.mimeType),
    isFolder: file.mimeType === DRIVE_MIME_TYPES.FOLDER,
    modifiedTime: file.modifiedTime || null,
    createdTime: file.createdTime || null,
    webViewLink: file.webViewLink || null,
    iconLink: file.iconLink || null,
    thumbnailLink: file.thumbnailLink || null,
    owner: file.owners?.[0]?.displayName || null,
    shared: file.shared || false,
    starred: file.starred || false,
    description: file.description || null,
    size: file.size ? Number(file.size) : null,
  };
}
