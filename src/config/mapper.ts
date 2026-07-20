import { AppConfig } from './index';
import { OrgGroupMapping } from '../types';

export interface ResolvedMapping {
  orgMapping: OrgGroupMapping;
  gitlabProjectName: string;
}

export function resolveGitHubToGitLab(
  config: AppConfig,
  githubOrg: string,
  githubRepo: string
): ResolvedMapping | null {
  for (const m of config.mapping.mappings) {
    if (m.github_org !== githubOrg) continue;
    if (!m.repos) {
      return { orgMapping: m, gitlabProjectName: githubRepo };
    }
    const targetName = m.repos[githubRepo];
    if (!targetName) return null;
    return { orgMapping: m, gitlabProjectName: targetName };
  }
  return null;
}

export function resolveGitLabToGitHub(
  config: AppConfig,
  gitlabGroup: string,
  gitlabProject: string
): { githubOrg: string; githubRepo: string } | null {
  for (const m of config.mapping.mappings) {
    if (m.gitlab_group !== gitlabGroup) continue;
    if (!m.repos) {
      return { githubOrg: m.github_org, githubRepo: gitlabProject };
    }
    for (const [ghRepo, glProject] of Object.entries(m.repos)) {
      if (glProject === gitlabProject) {
        return { githubOrg: m.github_org, githubRepo: ghRepo };
      }
    }
  }
  return null;
}

export function findGroupByOrg(config: AppConfig, githubOrg: string): string | null {
  const m = config.mapping.mappings.find(x => x.github_org === githubOrg);
  return m?.gitlab_group || null;
}

export function findOrgByGroup(config: AppConfig, gitlabGroup: string): string | null {
  const m = config.mapping.mappings.find(x => x.gitlab_group === gitlabGroup);
  return m?.github_org || null;
}
