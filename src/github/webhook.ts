import crypto from 'crypto';
import { Request } from 'express';
import { AppConfig } from '../config';
import { logger } from '../config/logger';

export function verifyGitHubSignature(config: AppConfig, req: Request): boolean {
  const sig = req.headers['x-hub-signature-256'] as string;
  if (!sig) return false;

  const body = (req as any).rawBody || JSON.stringify(req.body);
  const hmac = crypto
    .createHmac('sha256', config.github.webhookSecret)
    .update(body, 'utf-8')
    .digest('hex');

  const expected = `sha256=${hmac}`;

  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function parseGitHubEvent(req: Request): {
  event: string;
  payload: any;
} | null {
  const event = req.headers['x-github-event'] as string;
  if (!event) {
    logger.warn('Missing X-GitHub-Event header');
    return null;
  }
  return { event, payload: req.body };
}

export function isGitHubSyncEvent(payload: any, marker: string): boolean {
  if (payload.commits) {
    return payload.commits.some((c: any) =>
      (c.message || '').includes(marker)
    );
  }
  if (payload.head_commit?.message) {
    return payload.head_commit.message.includes(marker);
  }
  return false;
}

export function extractGitHubOrg(payload: any): string | null {
  return payload.organization?.login || payload.repository?.owner?.login || null;
}

export function extractGitHubRepo(payload: any): string | null {
  return payload.repository?.name || null;
}
