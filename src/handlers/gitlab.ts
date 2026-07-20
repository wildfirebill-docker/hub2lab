import { AppConfig } from '../config';
import { logger } from '../config/logger';
import { resolveGitLabToGitHub } from '../config/mapper';
import { isGitLabSyncEvent } from '../gitlab/webhook';
import { findGitLabProject } from '../gitlab/client';
import { findGitLabGroup } from '../gitlab/client';
import { pushFilesToGitHub } from '../github/client';
import { buildDeletionContent } from '../sync/deletion';
import { mirrorPush } from '../sync/mirror';

export async function handleGitLabPush(config: AppConfig, payload: any): Promise<void> {
  if (isGitLabSyncEvent(payload, config.syncMarker)) {
    logger.info('Ignoring GitLab push from sync loop');
    return;
  }

  const projectPath: string = payload.project?.path_with_namespace;
  if (!projectPath) return;

  const parts = projectPath.split('/');
  if (parts.length < 2) return;
  const group = parts[0];
  const project = parts.slice(1).join('/');
  const ref = payload.ref;

  const mapping = resolveGitLabToGitHub(config, group, project);
  if (!mapping) {
    logger.info(`No mapping for ${group}/${project}, skipping`);
    return;
  }

  const { githubOrg, githubRepo } = mapping;

  const sourceUrl = payload.project?.git_http_url || `https://gitlab.com/${projectPath}.git`;
  const targetUrl = `https://github.com/${githubOrg}/${githubRepo}.git`;

  await mirrorPush(
    config,
    sourceUrl,
    config.gitlab.token,
    targetUrl,
    config.github.token,
    ref,
    config.syncMarker
  );
}

export async function handleGitLabBranchOrTagCreate(config: AppConfig, payload: any): Promise<void> {
  const projectPath: string = payload.project?.path_with_namespace;
  if (!projectPath) return;

  const parts = projectPath.split('/');
  if (parts.length < 2) return;
  const group = parts[0];
  const project = parts.slice(1).join('/');
  const ref = payload.ref;

  const mapping = resolveGitLabToGitHub(config, group, project);
  if (!mapping) return;

  logger.info(`GitLab ref create: ${group}/${project} -> ${mapping.githubOrg}/${mapping.githubRepo} ref=${ref}`);
}

export async function handleGitLabBranchOrTagDelete(config: AppConfig, payload: any): Promise<void> {
  const projectPath: string = payload.project?.path_with_namespace;
  if (!projectPath) return;

  const parts = projectPath.split('/');
  if (parts.length < 2) return;
  const group = parts[0];
  const project = parts.slice(1).join('/');
  const ref = payload.ref;
  const refType = payload.ref_type || (payload.event_name === 'tag_push' ? 'tag' : 'branch');

  const mapping = resolveGitLabToGitHub(config, group, project);
  if (!mapping) return;

  const deletionContent = buildDeletionContent(
    refType,
    ref,
    'gitlab',
    group,
    mapping.githubOrg,
    mapping.githubRepo
  );

  const filePath = `deletion-${refType}-${ref.replace(/\//g, '-')}.md`;

  await pushFilesToGitHub(
    config,
    mapping.githubOrg,
    mapping.githubRepo,
    payload.project?.default_branch || 'main',
    [{ path: filePath, content: deletionContent }],
    `${config.syncMarker} Record deletion of ${refType} ${ref} from GitLab`
  );
}
