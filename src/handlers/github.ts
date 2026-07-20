import { AppConfig } from '../config';
import { logger } from '../config/logger';
import { resolveGitHubToGitLab, findGroupByOrg } from '../config/mapper';
import { findGitLabProject, createGitLabProject, getGitLabDefaultBranchSha, pushFilesToGitLab, createGitLabBranch, createGitLabTag } from '../gitlab/client';
import { isGitHubSyncEvent } from '../github/webhook';
import { buildDeletionContent, buildRepoDeletionContent } from '../sync/deletion';
import { mirrorPush } from '../sync/mirror';

export async function handleGitHubPush(config: AppConfig, payload: any): Promise<void> {
  if (isGitHubSyncEvent(payload, config.syncMarker)) {
    logger.info('Ignoring GitHub push from sync loop');
    return;
  }

  const org = payload.organization?.login || payload.repository?.owner?.login;
  const repo = payload.repository?.name;
  const ref = payload.ref;

  if (!org || !repo) return;

  const mapping = resolveGitHubToGitLab(config, org, repo);
  if (!mapping) {
    logger.info(`No mapping for ${org}/${repo}, skipping`);
    return;
  }

  const { gitlabProjectName } = mapping;
  const group = findGroupByOrg(config, org);
  if (!group) {
    logger.warn(`No GitLab group for org ${org}`);
    return;
  }

  const glProjectPath = `${group}/${gitlabProjectName}`;
  const glProject = await findGitLabProject(config, glProjectPath);

  if (!glProject) {
    logger.warn(`GitLab project not found: ${glProjectPath}, creating`);
    const newId = await createGitLabProject(config, group, gitlabProjectName, payload.repository?.private !== false);
    if (!newId) return;
  }

  const sourceUrl = payload.repository?.clone_url || payload.repository?.git_url;
  const targetUrl = `https://gitlab.com/${glProjectPath}.git`;

  await mirrorPush(
    config,
    sourceUrl,
    config.github.token,
    targetUrl,
    config.gitlab.token,
    ref,
    config.syncMarker
  );
}

export async function handleGitHubBranchOrTagCreate(config: AppConfig, payload: any): Promise<void> {
  const org = payload.organization?.login || payload.repository?.owner?.login;
  const repo = payload.repository?.name;
  const ref = payload.ref;
  const refType = payload.ref_type;

  if (!org || !repo || !ref) return;

  const mapping = resolveGitHubToGitLab(config, org, repo);
  if (!mapping) return;

  const group = findGroupByOrg(config, org);
  if (!group) return;

  const glProjectPath = `${group}/${mapping.gitlabProjectName}`;
  const glProject = await findGitLabProject(config, glProjectPath);
  if (!glProject) return;

  const sha = payload.master_branch
    ? await getGitLabDefaultBranchSha(config, glProject.id)
    : null;

  if (refType === 'branch') {
    if (sha) await createGitLabBranch(config, glProject.id, ref, sha);
  } else if (refType === 'tag') {
    if (sha) await createGitLabTag(config, glProject.id, ref, sha);
  }
}

export async function handleGitHubBranchOrTagDelete(config: AppConfig, payload: any): Promise<void> {
  const org = payload.organization?.login || payload.repository?.owner?.login;
  const repo = payload.repository?.name;
  const ref = payload.ref;
  const refType = payload.ref_type;

  if (!org || !repo || !ref) return;

  const mapping = resolveGitHubToGitLab(config, org, repo);
  if (!mapping) return;

  const group = findGroupByOrg(config, org);
  if (!group) return;

  const glProjectPath = `${group}/${mapping.gitlabProjectName}`;
  const glProject = await findGitLabProject(config, glProjectPath);
  if (!glProject) return;

  const deletionContent = buildDeletionContent(
    refType,
    ref,
    'github',
    org,
    group,
    mapping.gitlabProjectName
  );

  const filePath = `deletion-${refType}-${ref}.md`;

  await pushFilesToGitLab(config, glProject.id, glProject.default_branch, [
    { path: filePath, content: deletionContent },
  ], `${config.syncMarker} Record deletion of ${refType} ${ref} from GitHub`);
}

export async function handleRepoCreated(config: AppConfig, payload: any): Promise<void> {
  const org = payload.organization?.login || payload.repository?.owner?.login;
  const repo = payload.repository?.name;

  if (!org || !repo) return;

  const mapping = resolveGitHubToGitLab(config, org, repo);
  if (!mapping) return;

  const group = findGroupByOrg(config, org);
  if (!group) {
    logger.warn(`No GitLab group for org ${org}`);
    return;
  }

  await createGitLabProject(
    config,
    group,
    mapping.gitlabProjectName,
    payload.repository?.private !== false
  );
}

export async function handleRepoDeleted(config: AppConfig, payload: any): Promise<void> {
  const org = payload.organization?.login || payload.repository?.owner?.login;
  const repo = payload.repository?.name || payload.repository?.full_name;

  if (!org || !repo) return;

  const mapping = resolveGitHubToGitLab(config, org, repo);
  if (!mapping) return;

  const group = findGroupByOrg(config, org);
  if (!group) return;
  const glProjectPath = `${group}/${mapping.gitlabProjectName}`;
  const glProject = await findGitLabProject(config, glProjectPath);
  if (!glProject) return;

  const deletionContent = buildRepoDeletionContent(
    mapping.gitlabProjectName,
    'github',
    org,
    group
  );

  await pushFilesToGitLab(config, glProject.id, glProject.default_branch, [
    { path: 'deletion-repository.md', content: deletionContent },
  ], `${config.syncMarker} Record deletion of repo ${repo} from GitHub`);
}

export async function handleRepoRenamed(config: AppConfig, payload: any): Promise<void> {
  const org = payload.organization?.login || payload.repository?.owner?.login;
  const oldName = payload.changes?.repository?.name?.from;
  const newName = payload.repository?.name;

  if (!org || !oldName || !newName) return;

  const mapping = resolveGitHubToGitLab(config, org, newName);
  if (!mapping) return;

  const group = findGroupByOrg(config, org);
  if (!group) return;
  const glProjectPath = `${group}/${mapping.gitlabProjectName}`;
  const glProject = await findGitLabProject(config, glProjectPath);

  if (glProject) {
    logger.info(`GitLab project ${glProjectPath} already exists (rename not needed)`);
  }
}
