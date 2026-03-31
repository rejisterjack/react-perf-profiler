/**
 * AWS Signature Version 4 Tests
 * @module tests/unit/cloud/awsSignature
 */

import { describe, it, expect } from 'vitest';
import { generateAWSSigV4Headers, generatePresignedUrl } from '@/shared/cloud/utils/awsSignature';

describe('AWS SigV4', () => {
  const mockCredentials = {
    accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
    secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
  };

  describe('generateAWSSigV4Headers', () => {
    it('should generate required headers', async () => {
      const headers = await generateAWSSigV4Headers(
        'GET',
        'https://my-bucket.s3.us-east-1.amazonaws.com/test.txt',
        {},
        undefined,
        mockCredentials,
        'us-east-1'
      );

      expect(headers).toHaveProperty('Authorization');
      expect(headers).toHaveProperty('x-amz-date');
      expect(headers).toHaveProperty('host');
      
      expect(headers['Authorization']).toMatch(/^AWS4-HMAC-SHA256 Credential=/);
      expect(headers['Authorization']).toContain(mockCredentials.accessKeyId);
    });

    it('should include session token when provided', async () => {
      const credentialsWithToken = {
        ...mockCredentials,
        sessionToken: 'test-session-token',
      };

      const headers = await generateAWSSigV4Headers(
        'GET',
        'https://my-bucket.s3.us-east-1.amazonaws.com/test.txt',
        {},
        undefined,
        credentialsWithToken,
        'us-east-1'
      );

      expect(headers).toHaveProperty('x-amz-security-token');
      expect(headers['x-amz-security-token']).toBe('test-session-token');
    });

    it('should include content hash for PUT requests with body', async () => {
      const headers = await generateAWSSigV4Headers(
        'PUT',
        'https://my-bucket.s3.us-east-1.amazonaws.com/test.txt',
        {},
        'test body content',
        mockCredentials,
        'us-east-1'
      );

      expect(headers).toHaveProperty('x-amz-content-sha256');
      expect(headers['x-amz-content-sha256']).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should handle different regions', async () => {
      const headers = await generateAWSSigV4Headers(
        'GET',
        'https://my-bucket.s3.eu-west-1.amazonaws.com/test.txt',
        {},
        undefined,
        mockCredentials,
        'eu-west-1'
      );

      expect(headers['Authorization']).toContain('eu-west-1');
    });
  });

  describe('generatePresignedUrl', () => {
    it('should generate a valid presigned URL', async () => {
      const url = await generatePresignedUrl(
        'my-bucket',
        'test-file.txt',
        mockCredentials,
        'us-east-1',
        3600
      );

      expect(url).toMatch(/^https:\/\/my-bucket\.s3\.us-east-1\.amazonaws\.com/);
      expect(url).toContain('X-Amz-Algorithm=AWS4-HMAC-SHA256');
      expect(url).toContain('X-Amz-Credential=');
      expect(url).toContain('X-Amz-Date=');
      expect(url).toContain('X-Amz-Expires=3600');
      expect(url).toContain('X-Amz-Signature=');
    });

    it('should encode special characters in key', async () => {
      const url = await generatePresignedUrl(
        'my-bucket',
        'path/to file with spaces.txt',
        mockCredentials,
        'us-east-1'
      );

      // URL path uses %20 or + for spaces, both are valid
      expect(url).toMatch(/path%2Fto(%20|\+)file(%20|\+)with(%20|\+)spaces\.txt/);
    });

    it('should use default expiration of 3600 seconds', async () => {
      const url = await generatePresignedUrl(
        'my-bucket',
        'test.txt',
        mockCredentials,
        'us-east-1'
      );

      expect(url).toContain('X-Amz-Expires=3600');
    });
  });
});
