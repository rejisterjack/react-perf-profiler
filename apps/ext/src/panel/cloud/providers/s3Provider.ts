/**
 * S3 provider – full implementation using AWS S3 REST API with SigV4 signing.
 *
 * Reference: https://docs.aws.amazon.com/AmazonS3/latest/API/API_Operations.html
 */

import type { CloudConfig, CloudFile } from '../types';

/** Normalize a path so it always starts with a leading slash. */
function normalizePath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

/** Build the full remote path including the optional basePath prefix. */
function fullPath(name: string, config: CloudConfig): string {
  const base = config.basePath ? normalizePath(config.basePath) : '';
  return `${base}/${name}`;
}

/** Get the endpoint URL for an S3 object or bucket operation. */
function getEndpoint(config: CloudConfig, key?: string): string {
  const bucket = config.bucket ?? '';
  const region = config.region ?? 'us-east-1';
  const objectKey = key ? `/${key}` : '';
  return `https://${bucket}.s3.${region}.amazonaws.com${objectKey}`;
}

// ---------------------------------------------------------------------------
// AWS SigV4 Signing
// ---------------------------------------------------------------------------

async function hmac(key: Uint8Array, message: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
  return new Uint8Array(sig);
}

async function sha256Hex(data: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function signRequest(
  method: string,
  url: URL,
  headers: Record<string, string>,
  body: string,
  config: CloudConfig,
): Promise<Record<string, string>> {
  const region = config.region ?? 'us-east-1';
  const service = 's3';
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const dateStamp = amzDate.slice(0, 8);

  const payloadHash = await sha256Hex(body);

  const signedHeaders: Record<string, string> = {
    ...headers,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
    host: url.host,
  };

  const canonicalHeaders = Object.keys(signedHeaders)
    .sort()
    .map((k) => `${k.toLowerCase()}:${signedHeaders[k].trim()}`)
    .join('\n');

  const signedHeaderKeys = Object.keys(signedHeaders)
    .sort()
    .map((k) => k.toLowerCase())
    .join(';');

  const canonicalRequest = [
    method,
    url.pathname,
    url.search.replace(/^\?/, ''),
    canonicalHeaders + '\n',
    signedHeaderKeys,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256Hex(canonicalRequest),
  ].join('\n');

  const kSecret = new TextEncoder().encode(`AWS4${config.secretKey}`);
  const kDate = await hmac(kSecret, dateStamp);
  const kRegion = await hmac(kDate, region);
  const kService = await hmac(kRegion, service);
  const kSigning = await hmac(kService, 'aws4_request');
  const signature = await hmac(kSigning, stringToSign);

  const sigHex = Array.from(signature).map((b) => b.toString(16).padStart(2, '0')).join('');
  const authHeader = `AWS4-HMAC-SHA256 Credential=${config.accessToken}/${credentialScope}, SignedHeaders=${signedHeaderKeys}, Signature=${sigHex}`;

  return {
    ...signedHeaders,
    Authorization: authHeader,
  };
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

export async function upload(
  name: string,
  data: unknown,
  config: CloudConfig,
): Promise<void> {
  const key = fullPath(name, config).replace(/^\//, '');
  const body = typeof data === 'string' ? data : JSON.stringify(data);
  const url = new URL(getEndpoint(config, key));

  const headers = await signRequest('PUT', url, { 'Content-Type': 'application/json' }, body, config);

  const response = await fetch(url.toString(), {
    method: 'PUT',
    headers,
    body,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`S3 upload failed (${response.status}): ${error}`);
  }
}

// ---------------------------------------------------------------------------
// Download
// ---------------------------------------------------------------------------

export async function download(
  name: string,
  config: CloudConfig,
): Promise<unknown> {
  const key = fullPath(name, config).replace(/^\//, '');
  const url = new URL(getEndpoint(config, key));

  const headers = await signRequest('GET', url, {}, '', config);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`S3 download failed (${response.status}): ${error}`);
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
  const url = new URL(getEndpoint(config));
  const prefix = config.basePath ? normalizePath(config.basePath).replace(/^\//, '') : '';
  url.searchParams.set('list-type', '2');
  if (prefix) url.searchParams.set('prefix', prefix);

  const headers = await signRequest('GET', url, {}, '', config);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`S3 list failed (${response.status}): ${error}`);
  }

  const text = await response.text();
  return parseListResponse(text, config);
}

function parseListResponse(xml: string, config: CloudConfig): CloudFile[] {
  const files: CloudFile[] = [];
  const contentsRegex = /<Contents>\s*<Key>([\s\S]*?)<\/Key>\s*<LastModified>([\s\S]*?)<\/LastModified>\s*<Size>([\s\S]*?)<\/Size>\s*<\/Contents>/g;

  let match: RegExpExecArray | null;
  while ((match = contentsRegex.exec(xml)) !== null) {
    const key = match[1]!.trim();
    const modified = match[2]!.trim();
    const size = Number.parseInt(match[3]!.trim(), 10);

    const name = key.split('/').pop() ?? key;
    const region = config.region ?? 'us-east-1';
    const bucket = config.bucket ?? '';
    const fileUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;

    files.push({ name, modified, size, url: fileUrl });
  }

  return files;
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteFile(
  name: string,
  config: CloudConfig,
): Promise<void> {
  const key = fullPath(name, config).replace(/^\//, '');
  const url = new URL(getEndpoint(config, key));

  const headers = await signRequest('DELETE', url, {}, '', config);

  const response = await fetch(url.toString(), {
    method: 'DELETE',
    headers,
  });

  if (!response.ok && response.status !== 204) {
    const error = await response.text();
    throw new Error(`S3 delete failed (${response.status}): ${error}`);
  }
}
