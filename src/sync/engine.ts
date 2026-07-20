import { AppConfig } from '../config';
import { logger } from '../config/logger';
import { handleGitHubPush, handleGitHubBranchOrTagCreate, handleGitHubBranchOrTagDelete, handleRepoCreated, handleRepoDeleted, handleRepoRenamed } from '../handlers/github';
import { handleGitLabPush, handleGitLabBranchOrTagCreate, handleGitLabBranchOrTagDelete } from '../handlers/gitlab';

export async function processGitHubEvent(
  config: AppConfig,
  event: string,
  payload: any
): Promise<void> {
  const org = payload.organization?.login || payload.repository?.owner?.login;
  const repo = payload.repository?.name;

  if (!org || !repo) {
    logger.warn('GitHub event missing org/repo', { event });
    return;
  }

  const meta = { event, org, repo };

  switch (event) {
    case 'push':
      logger.info('Processing GitHub push', meta);
      await handleGitHubPush(config, payload);
      break;

    case 'create':
      logger.info('Processing GitHub create', meta);
      await handleGitHubBranchOrTagCreate(config, payload);
      break;

    case 'delete':
      logger.info('Processing GitHub delete', meta);
      await handleGitHubBranchOrTagDelete(config, payload);
      break;

    case 'repository':
      logger.info('Processing GitHub repository event', meta);
      if (payload.action === 'created') {
        await handleRepoCreated(config, payload);
      } else if (payload.action === 'deleted') {
        await handleRepoDeleted(config, payload);
      } else if (payload.action === 'renamed') {
        await handleRepoRenamed(config, payload);
      }
      break;

    default:
      logger.info(`Unhandled GitHub event type: ${event}`, meta);
  }
}

export async function processGitLabEvent(
  config: AppConfig,
  event: string,
  payload: any
): Promise<void> {
  const projectPath: string | undefined = payload.project?.path_with_namespace;
  const projectName: string | undefined = payload.project?.name;

  if (!projectPath || !projectName) {
    logger.warn('GitLab event missing project info', { event });
    return;
  }

  const parts = projectPath.split('/');
  const group = parts.length > 1 ? parts[0] : null;
  if (!group) {
    logger.warn('GitLab event could not extract group', { event, projectPath });
    return;
  }

  const meta = { event, group, project: projectName };

  switch (event) {
    case 'push':
      logger.info('Processing GitLab push', meta);
      await handleGitLabPush(config, payload);
      break;

    case 'tag_push':
      logger.info('Processing GitLab tag push', meta);
      await handleGitLabBranchOrTagCreate(config, payload);
      break;

    default:
      logger.info(`Unhandled GitLab event type: ${event}`, meta);
  }
}
