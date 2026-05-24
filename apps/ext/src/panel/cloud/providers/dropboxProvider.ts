/**
 * Dropbox provider – full implementation using the Dropbox Content & RPC APIs.
 *
 * Reference: https://www.dropbox.com/developers/documentation/http/documentation
 */

import type { CloudConfig, CloudFile } from '../types';

const DROPBOX_CONTENT_API = 'https://content.dropboxapi.com/2/files';
const DROPBOX_RPC_API = 'https://api.dropboxapi.com/2/files';

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
// Upload
// ---------------------------------------------------------------------------

export async function upload(
  name: string,
  data: unknown,
  config: CloudConfig,
): Promise<void> {
  const path = fullPath(name, config);
  const body = typeof data === 'string' ? data : JSON.stringify(data);

  const response = await fetch(`${DROPBOX_CONTENT_API}/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({
        path,
        mode: 'overwrite',
        autorename: false,
        mute: false,
        strict_conflict: false,
      }),
    },
    body,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Dropbox upload failed (${response.status}): ${error}`);
  }
}

// ---------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------

export async function download(
  name: string,
  config: CloudConfig,
): Promise<unknown> {
  const path = fullPath(name, config);

  const response = await fetch(`${DROPBOX_CONTENT_API}/download`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      'Dropbox-API-Arg': JSON.stringify({ path }),
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Dropbox download failed (${response.status}): ${error}`);
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
  const path = config.basePath ? normalizePath(config.basePath) : '';

  const response = await fetch(`${DROPBOX_RPC_API}/list_folder`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      path: path || '',
      recursive: false,
      include_media_info: false,
      include_deleted: false,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Dropbox list failed (${response.status}): ${error}`);
  }

  const result = await response.json();

  const entries: CloudFile[] = (result.entries ?? [])
    .filter((entry: { '.tag': string }) => entry['.tag'] === 'file')
    .map((entry: { name: string; client_modified: string; size: number; id: string; path_display: string }) => ({
      name: entry.name,
      modified: entry.client_modified,
      size: entry.size,
      url: entry.path_display ?? `/${entry.name}`,
    }));

  return entries;
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteFile(
  name: string,
  config: CloudConfig,
): Promise<void> {
  const path = fullPath(name, config);

  const response = await fetch(`${DROPBOX_RPC_API}/delete_v2`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Dropbox delete failed (${response.status}): ${error}`);
  }
}
