import { Request } from 'express';
import { AppConfig } from '../config';
import { logger } from '../config/logger';

export function verifyGitLabToken(config: AppConfig, req: Request): boolean {
  const token = req.headers['x-gitlab-token'] as string;
  if (!token) {
    logger.warn('Missing X-GitLab-Token header');
    return false;
  }
  return token === config.gitlab.webhookSecret;
}

export function parseGitLabEvent(req: Request): {
  event: string;
  payload: any;
} | null {
  const body = req.body;
  if (!body) return null;

  const eventName = body.event_name || body.object_kind;
  if (!eventName) {
    logger.warn('Unknown GitLab event type');
    return null;
  }
  return { event: eventName, payload: body };
}

export function isGitLabSyncEvent(payload: any, marker: string): boolean {
  if (payload.commits) {
    return payload.commits.some((c: any) =>
      (c.message || '').includes(marker)
    );
  }
  return false;
}

export function extractGitLabGroup(payload: any): string | null {
  const path = payload.project?.path_with_namespace || payload.project?.namespace || null;
  if (!path) return null;
  const parts = path.split('/');
  return parts.length > 1 ? parts[0] : null;
}

export function extractGitLabProject(payload: any): string | null {
  return payload.project?.name || payload.project?.path_with_namespace?.split('/').pop() || null;
}

export function extractGitLabProjectId(payload: any): number | null {
  return payload.project?.id || null;
}
