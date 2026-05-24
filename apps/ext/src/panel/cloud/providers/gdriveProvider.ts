/**
 * Google Drive provider – full implementation using the Drive REST API v3.
 *
 * Reference: https://developers.google.com/drive/api/v3/reference
 */

import type { CloudConfig, CloudFile } from '../types';

const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';

/** Normalize a path so it always starts with a leading slash. */
function normalizePath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

/** Build the full remote path including the optional basePath prefix. */
function fullPath(name: string, config: CloudConfig): string {
  const base = config.basePath ? normalizePath(config.basePath) : '';
  return `${base}/${name}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function findFileId(name: string, config: CloudConfig): Promise<string | null> {
  const path = fullPath(name, config);
  const q = `name='${name}' and trashed=false`;
  const parents = config.basePath ? await ensureFolder(config) : undefined;
  const parentQuery = parents ? ` and '${parents}' in parents` : '';

  const url = `${DRIVE_API}?q=${encodeURIComponent(q + parentQuery)}&spaces=appDataFolder&fields=files(id,name)`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${config.accessToken}` },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google Drive file lookup failed (${response.status}): ${error}`);
  }

  const result = await response.json();
  const files = result.files as Array<{ id: string; name: string }> | undefined;
  return files?.[0]?.id ?? null;
}

async function ensureFolder(config: CloudConfig): Promise<string | null> {
  if (!config.basePath) return null;

  const folderName = config.basePath.replace(/^\/+|\/+$/g, '');
  const q = `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false and 'appDataFolder' in parents`;

  const url = `${DRIVE_API}?q=${encodeURIComponent(q)}&spaces=appDataFolder&fields=files(id)`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${config.accessToken}` },
  });

  if (!response.ok) return null;

  const result = await response.json();
  const files = result.files as Array<{ id: string }> | undefined;
  if (files?.[0]?.id) return files[0].id;

  // Create folder
  const createResponse = await fetch(DRIVE_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: ['appDataFolder'],
    }),
  });

  if (!createResponse.ok) return null;
  const created = await createResponse.json();
  return (created as { id: string }).id;
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

export async function upload(
  name: string,
  data: unknown,
  config: CloudConfig,
): Promise<void> {
  const body = typeof data === 'string' ? data : JSON.stringify(data);
  const existingId = await findFileId(name, config);

  if (existingId) {
    // Update existing file — simple upload
    const url = `${DRIVE_UPLOAD_API}/${existingId}?uploadType=media`;
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google Drive update failed (${response.status}): ${error}`);
    }
  } else {
    // Create new file — multipart upload
    const parentId = await ensureFolder(config);
    const metadata = {
      name,
      parents: parentId ? [parentId] : ['appDataFolder'],
    };

    const boundary = 'react_perf_profiler_boundary';
    const multipartBody =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      `${body}\r\n` +
      `--${boundary}--`;

    const url = `${DRIVE_UPLOAD_API}?uploadType=multipart`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google Drive upload failed (${response.status}): ${error}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------

export async function download(
  name: string,
  config: CloudConfig,
): Promise<unknown> {
  const fileId = await findFileId(name, config);
  if (!fileId) {
    throw new Error(`File "${name}" not found in Google Drive.`);
  }

  const url = `${DRIVE_API}/${fileId}?alt=media`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${config.accessToken}` },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google Drive download failed (${response.status}): ${error}`);
  }

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// ---------------------------------------------------------------------------
// List files
// ---------------------------------------------------------------------------

export async function list(
  config: CloudConfig,
): Promise<CloudFile[]> {
  const parentId = await ensureFolder(config);
  const parentQuery = parentId ? ` and '${parentId}' in parents` : '';
  const q = `trashed=false${parentQuery}`;

  const url = `${DRIVE_API}?q=${encodeURIComponent(q)}&spaces=appDataFolder&fields=files(id,name,modifiedTime,size,webViewLink)`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${config.accessToken}` },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google Drive list failed (${response.status}): ${error}`);
  }

  const result = await response.json();
  const files = result.files as Array<{
    id: string;
    name: string;
    modifiedTime: string;
    size: string;
    webViewLink?: string;
  }>;

  return files.map((entry) => ({
    name: entry.name,
    modified: entry.modifiedTime,
    size: Number(entry.size) || 0,
    url: entry.webViewLink ?? `https://drive.google.com/file/d/${entry.id}/view`,
  }));
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteFile(
  name: string,
  config: CloudConfig,
): Promise<void> {
  const fileId = await findFileId(name, config);
  if (!fileId) {
    throw new Error(`File "${name}" not found in Google Drive.`);
  }

  const url = `${DRIVE_API}/${fileId}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${config.accessToken}` },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google Drive delete failed (${response.status}): ${error}`);
  }
}
