import { Gitlab } from '@gitbeaker/rest';
import { AppConfig } from '../config';
import { logger } from '../config/logger';

let _gitlab: InstanceType<typeof Gitlab> | null = null;

function getClient(config: AppConfig): InstanceType<typeof Gitlab> {
  if (!_gitlab) {
    _gitlab = new Gitlab({
      token: config.gitlab.token,
      host: config.gitlab.baseUrl,
    }) as InstanceType<typeof Gitlab>;
  }
  return _gitlab;
}

export interface GitLabProjectInfo {
  id: number;
  path_with_namespace: string;
  default_branch: string;
}

export async function findGitLabGroup(config: AppConfig, groupPath: string): Promise<number | null> {
  const client = getClient(config);
  try {
    const groups = await client.Groups.search(groupPath);
    const match = groups.find((g: any) => g.full_path === groupPath);
    return match ? match.id : null;
  } catch {
    return null;
  }
}

export async function findGitLabProject(
  config: AppConfig,
  projectPath: string
): Promise<GitLabProjectInfo | null> {
  const client = getClient(config);
  try {
    const project = await client.Projects.show(projectPath);
    return {
      id: project.id as number,
      path_with_namespace: project.path_with_namespace as string,
      default_branch: (project.default_branch as string) || 'main',
    };
  } catch {
    return null;
  }
}

export async function createGitLabProject(
  config: AppConfig,
  groupPath: string,
  name: string,
  isPrivate: boolean
): Promise<number | null> {
  const client = getClient(config);
  const groupId = await findGitLabGroup(config, groupPath);
  if (!groupId) {
    logger.error(`GitLab group not found: ${groupPath}`);
    return null;
  }

  const project = await client.Projects.create({
    name,
    namespaceId: groupId,
    visibility: isPrivate ? 'private' : 'public',
  });
  logger.info(`Created GitLab project ${groupPath}/${name} (id=${project.id})`);
  return project.id as number;
}

export async function deleteGitLabProject(config: AppConfig, projectId: number): Promise<void> {
  const client = getClient(config);
  await client.Projects.remove(projectId);
  logger.info(`Deleted GitLab project id=${projectId}`);
}

export async function getGitLabDefaultBranchSha(
  config: AppConfig,
  projectId: number
): Promise<string | null> {
  const client = getClient(config);
  try {
    const branches = await client.Branches.all(projectId);
    if (branches.length === 0) return null;
    const def = branches.find((b: any) => b.default) || branches[0];
    return (def as any).commit?.id || null;
  } catch {
    return null;
  }
}

export async function createGitLabBranch(
  config: AppConfig,
  projectId: number,
  branch: string,
  ref: string
): Promise<void> {
  const client = getClient(config);
  await client.Branches.create(projectId, branch, ref);
  logger.info(`Created GitLab branch project=${projectId} branch=${branch}`);
}

export async function deleteGitLabBranch(
  config: AppConfig,
  projectId: number,
  branch: string
): Promise<void> {
  const client = getClient(config);
  await client.Branches.remove(projectId, branch);
  logger.info(`Deleted GitLab branch project=${projectId} branch=${branch}`);
}

export async function createGitLabTag(
  config: AppConfig,
  projectId: number,
  tag: string,
  ref: string
): Promise<void> {
  const client = getClient(config);
  await client.Tags.create(projectId, tag, ref);
  logger.info(`Created GitLab tag project=${projectId} tag=${tag}`);
}

export async function deleteGitLabTag(
  config: AppConfig,
  projectId: number,
  tag: string
): Promise<void> {
  const client = getClient(config);
  await client.Tags.remove(projectId, tag);
  logger.info(`Deleted GitLab tag project=${projectId} tag=${tag}`);
}

export async function pushFilesToGitLab(
  config: AppConfig,
  projectId: number,
  branch: string,
  files: Array<{ path: string; content: string }>,
  message: string
): Promise<void> {
  const client = getClient(config);

  const actions = files.map(f => ({
    action: 'create' as const,
    filePath: f.path,
    content: f.content,
    encoding: 'text' as const,
  }));

  try {
    await client.Commits.create(projectId, branch, message, actions);
    logger.info(`Pushed ${files.length} file(s) to GitLab project=${projectId} branch=${branch}`);
  } catch (err: any) {
    if (err.message?.includes('already exists') || err.description?.includes('already exists')) {
      const updateActions = files.map(f => ({
        action: 'update' as const,
        filePath: f.path,
        content: f.content,
        encoding: 'text' as const,
      }));
      await client.Commits.create(projectId, branch, message, updateActions);
      logger.info(`Updated ${files.length} file(s) in GitLab project=${projectId} branch=${branch}`);
    } else {
      throw err;
    }
  }
}
