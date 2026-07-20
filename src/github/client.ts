import { Octokit } from 'octokit';
import { AppConfig } from '../config';
import { logger } from '../config/logger';

let _octokit: Octokit | null = null;

function getClient(config: AppConfig): Octokit {
  if (!_octokit) {
    _octokit = new Octokit({ auth: config.github.token });
  }
  return _octokit;
}

export async function createGitHubRepo(
  config: AppConfig,
  org: string,
  name: string,
  isPrivate: boolean
): Promise<void> {
  const client = getClient(config);
  await client.request('POST /orgs/{org}/repos', {
    org,
    name,
    private: isPrivate,
    auto_init: false,
  });
  logger.info(`Created GitHub repo ${org}/${name}`);
}

export async function renameGitHubRepo(
  config: AppConfig,
  owner: string,
  oldName: string,
  newName: string
): Promise<void> {
  const client = getClient(config);
  await client.request('PATCH /repos/{owner}/{repo}', {
    owner,
    repo: oldName,
    name: newName,
  });
  logger.info(`Renamed GitHub repo ${owner}/${oldName} → ${newName}`);
}

export async function deleteGitHubRepo(
  config: AppConfig,
  owner: string,
  repo: string
): Promise<void> {
  const client = getClient(config);
  await client.request('DELETE /repos/{owner}/{repo}', {
    owner,
    repo,
  });
  logger.info(`Deleted GitHub repo ${owner}/${repo}`);
}

export async function createGitHubBranch(
  config: AppConfig,
  owner: string,
  repo: string,
  branch: string,
  sha: string
): Promise<void> {
  const client = getClient(config);
  await client.request('POST /repos/{owner}/{repo}/git/refs', {
    owner,
    repo,
    ref: `refs/heads/${branch}`,
    sha,
  });
  logger.info(`Created GitHub branch ${owner}/${repo}:${branch}`);
}

export async function deleteGitHubBranch(
  config: AppConfig,
  owner: string,
  repo: string,
  branch: string
): Promise<void> {
  const client = getClient(config);
  await client.request('DELETE /repos/{owner}/{repo}/git/refs/heads/{branch}', {
    owner,
    repo,
    branch,
  });
  logger.info(`Deleted GitHub branch ${owner}/${repo}:${branch}`);
}

export async function createGitHubTag(
  config: AppConfig,
  owner: string,
  repo: string,
  tag: string,
  sha: string
): Promise<void> {
  const client = getClient(config);
  await client.request('POST /repos/{owner}/{repo}/git/refs', {
    owner,
    repo,
    ref: `refs/tags/${tag}`,
    sha,
  });
  logger.info(`Created GitHub tag ${owner}/${repo}:${tag}`);
}

export async function deleteGitHubTag(
  config: AppConfig,
  owner: string,
  repo: string,
  tag: string
): Promise<void> {
  const client = getClient(config);
  await client.request('DELETE /repos/{owner}/{repo}/git/refs/tags/{tag}', {
    owner,
    repo,
    tag,
  });
  logger.info(`Deleted GitHub tag ${owner}/${repo}:${tag}`);
}

export async function getGitHubDefaultBranchSha(
  config: AppConfig,
  owner: string,
  repo: string
): Promise<string> {
  const client = getClient(config);
  const res = await client.request('GET /repos/{owner}/{repo}', {
    owner,
    repo,
  });
  const defaultBranch = res.data.default_branch;
  const refRes = await client.request('GET /repos/{owner}/{repo}/git/ref/heads/{branch}', {
    owner,
    repo,
    branch: defaultBranch,
  });
  return refRes.data.object.sha;
}

export async function pushFilesToGitHub(
  config: AppConfig,
  owner: string,
  repo: string,
  branch: string,
  files: Array<{ path: string; content: string }>,
  message: string
): Promise<void> {
  const client = getClient(config);

  const refRes = await client.request('GET /repos/{owner}/{repo}/git/ref/heads/{branch}', {
    owner,
    repo,
    branch,
  }).catch(() => null);

  let latestSha: string;
  if (refRes) {
    latestSha = refRes.data.object.sha;
  } else {
    const repoInfo = await client.request('GET /repos/{owner}/{repo}', { owner, repo });
    const defBranch = repoInfo.data.default_branch;
    const defRef = await client.request('GET /repos/{owner}/{repo}/git/ref/heads/{branch}', {
      owner, repo, branch: defBranch,
    });
    latestSha = defRef.data.object.sha;
  }

  const treeItems = await Promise.all(files.map(async (f) => {
    const blob = await client.request('POST /repos/{owner}/{repo}/git/blobs', {
      owner,
      repo,
      content: f.content,
      encoding: 'utf-8',
    });
    return {
      path: f.path,
      mode: '100644' as const,
      type: 'blob' as const,
      sha: blob.data.sha,
    };
  }));

  const baseTree = await client.request('GET /repos/{owner}/{repo}/git/trees/{tree_sha}', {
    owner,
    repo,
    tree_sha: latestSha,
  });

  const newTree = await client.request('POST /repos/{owner}/{repo}/git/trees', {
    owner,
    repo,
    base_tree: baseTree.data.sha,
    tree: treeItems,
  });

  const newCommit = await client.request('POST /repos/{owner}/{repo}/git/commits', {
    owner,
    repo,
    message,
    tree: newTree.data.sha,
    parents: [latestSha],
  });

  await client.request('PATCH /repos/{owner}/{repo}/git/refs/heads/{branch}', {
    owner,
    repo,
    branch,
    sha: newCommit.data.sha,
    force: false,
  });

  logger.info(`Pushed ${files.length} file(s) to GitHub ${owner}/${repo}:${branch}`);
}
