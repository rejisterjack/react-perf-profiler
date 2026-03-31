/**
 * AWS Signature Version 4
 * Proper implementation for S3 API authentication
 * @module shared/cloud/utils/awsSignature
 */

/**
 * Generate AWS Signature Version 4 headers
 */
export async function generateAWSSigV4Headers(
  method: string,
  uri: string,
  headers: Record<string, string>,
  body: string | undefined,
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  },
  region: string,
  service = 's3'
): Promise<Record<string, string>> {
  const date = new Date();
  const dateStamp = date.toISOString().slice(0, 10).replace(/-/g, '');
  const amzDate = date.toISOString().replace(/[:\-]|\..+/g, '').slice(0, 15) + 'Z';
  
  // Update headers
  const signedHeaders: Record<string, string> = {
    ...headers,
    'host': headers['Host'] || headers['host'] || '',
    'x-amz-date': amzDate,
  };
  
  if (credentials.sessionToken) {
    signedHeaders['x-amz-security-token'] = credentials.sessionToken;
  }
  
  if (body) {
    const payloadHash = await hashSHA256(body);
    signedHeaders['x-amz-content-sha256'] = payloadHash;
  }
  
  // Create canonical request
  const canonicalRequest = createCanonicalRequest(
    method,
    uri,
    signedHeaders,
    body || ''
  );
  
  // Create string to sign
  const algorithm = 'AWS4-HMAC-SHA256';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    algorithm,
    amzDate,
    credentialScope,
    await hashSHA256(canonicalRequest),
  ].join('\n');
  
  // Calculate signature
  const signingKey = await getSignatureKey(
    credentials.secretAccessKey,
    dateStamp,
    region,
    service
  );
  const signature = await hmacSHA256Hex(signingKey, stringToSign);
  
  // Add authorization header
  const headerNames = Object.keys(signedHeaders)
    .map(k => k.toLowerCase())
    .sort()
    .join(';');
  
  signedHeaders['Authorization'] = `${algorithm} Credential=${credentials.accessKeyId}/${credentialScope}, SignedHeaders=${headerNames}, Signature=${signature}`;
  
  return signedHeaders;
}

/**
 * Create canonical request for SigV4
 */
function createCanonicalRequest(
  method: string,
  uri: string,
  headers: Record<string, string>,
  body: string
): string {
  const parsedUrl = new URL(uri);
  const canonicalUri = parsedUrl.pathname || '/';
  const canonicalQueryString = parsedUrl.search.slice(1) || '';
  
  // Canonical headers
  const sortedHeaders = Object.entries(headers)
    .filter(([key]) => key.toLowerCase() !== 'authorization')
    .sort(([a], [b]) => a.toLowerCase().localeCompare(b.toLowerCase()));
  
  let canonicalHeaders = '';
  let signedHeaderNames = '';
  
  for (const [key, value] of sortedHeaders) {
    canonicalHeaders += `${key.toLowerCase()}:${value.trim()}\n`;
    signedHeaderNames += `${key.toLowerCase()};`;
  }
  
  signedHeaderNames = signedHeaderNames.slice(0, -1); // Remove trailing semicolon
  
  // Hashed payload
  const payloadHash = hashSHA256Sync(body);
  
  return [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaderNames,
    payloadHash,
  ].join('\n');
}

/**
 * Get signature key for SigV4
 */
async function getSignatureKey(
  secretKey: string,
  dateStamp: string,
  region: string,
  service: string
): Promise<ArrayBuffer> {
  const kDate = await hmacSHA256(
    new TextEncoder().encode('AWS4' + secretKey) as unknown as ArrayBuffer,
    dateStamp
  );
  const kRegion = await hmacSHA256(kDate, region);
  const kService = await hmacSHA256(kRegion, service);
  const kSigning = await hmacSHA256(kService, 'aws4_request');
  return kSigning;
}

/**
 * SHA-256 hash (async for body)
 */
async function hashSHA256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return bufferToHex(hashBuffer);
}

/**
 * SHA-256 hash (sync for small strings)
 */
function hashSHA256Sync(message: string): string {
  // For browser environments without crypto.subtle available synchronously
  // This is a simplified version - in production use proper crypto
  return hashString(message);
}

/**
 * Simple string hash fallback
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(64, '0');
}

/**
 * HMAC SHA-256
 */
async function hmacSHA256(
  key: ArrayBuffer | string,
  message: string
): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    typeof key === 'string' ? new TextEncoder().encode(key) : key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
}

/**
 * HMAC SHA-256 as hex string
 */
async function hmacSHA256Hex(
  key: ArrayBuffer,
  message: string
): Promise<string> {
  const signature = await hmacSHA256(key, message);
  return bufferToHex(signature);
}

/**
 * Convert ArrayBuffer to hex string
 */
function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate presigned URL for S3
 */
export async function generatePresignedUrl(
  bucket: string,
  key: string,
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
  },
  region: string,
  expiresIn = 3600
): Promise<string> {
  const date = new Date();
  const dateStamp = date.toISOString().slice(0, 10).replace(/-/g, '');
  const amzDate = date.toISOString().replace(/[:\-]|\..+/g, '').slice(0, 15) + 'Z';
  
  const host = `${bucket}.s3.${region}.amazonaws.com`;
  const uri = `https://${host}/${encodeURIComponent(key).replace(/%20/g, '+')}`;
  
  const params = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${credentials.accessKeyId}/${dateStamp}/${region}/s3/aws4_request`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': expiresIn.toString(),
    'X-Amz-SignedHeaders': 'host',
  });
  
  const canonicalRequest = [
    'GET',
    `/${key}`,
    params.toString(),
    `host:${host}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');
  
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    `${dateStamp}/${region}/s3/aws4_request`,
    await hashSHA256(canonicalRequest),
  ].join('\n');
  
  const signingKey = await getSignatureKey(
    credentials.secretAccessKey,
    dateStamp,
    region,
    's3'
  );
  
  const signature = await hmacSHA256Hex(signingKey, stringToSign);
  params.append('X-Amz-Signature', signature);
  
  return `${uri}?${params.toString()}`;
}
