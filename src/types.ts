export interface RepoMap {
  [githubRepo: string]: string;
}

export interface OrgGroupMapping {
  github_org: string;
  gitlab_group: string;
  repos?: RepoMap;
}

export interface MappingConfig {
  mappings: OrgGroupMapping[];
}

export interface MirrorResult {
  success: boolean;
  error?: string;
  pushed: boolean;
}

export interface SyncMarkerCheck {
  isFromSync: boolean;
}

export interface GitHubPushPayload {
  ref: string;
  before: string;
  after: string;
  repository: {
    name: string;
    full_name: string;
    owner: { login: string };
    private: boolean;
  };
  organization?: { login: string };
  commits: Array<{
    id: string;
    message: string;
    added: string[];
    removed: string[];
    modified: string[];
  }>;
  head_commit: {
    id: string;
    message: string;
  } | null;
  sender: { login: string };
}

export interface GitHubCreatePayload {
  ref: string;
  ref_type: 'branch' | 'tag';
  repository: {
    name: string;
    full_name: string;
    owner: { login: string };
    private: boolean;
  };
  organization?: { login: string };
}

export interface GitHubDeletePayload {
  ref: string;
  ref_type: 'branch' | 'tag';
  repository: {
    name: string;
    full_name: string;
    owner: { login: string };
    private: boolean;
  };
  organization?: { login: string };
}

export interface GitHubRepositoryPayload {
  action: 'created' | 'deleted' | 'renamed' | 'transferred' | 'privatized' | 'publicized';
  repository: {
    name: string;
    full_name: string;
    owner: { login: string };
    private: boolean;
  };
  organization?: { login: string };
  changes?: {
    repository?: {
      name?: { from: string };
    };
  };
}

export interface GitLabPushPayload {
  event_name: 'push' | 'tag_push';
  ref: string;
  before: string;
  after: string;
  project: {
    id: number;
    name: string;
    path_with_namespace: string;
    namespace: string;
    visibility: string;
  };
  commits: Array<{
    id: string;
    message: string;
    added: string[];
    removed: string[];
    modified: string[];
  }>;
  total_commits_count: number;
}

export type GitHubEvent =
  | { event: 'push'; payload: GitHubPushPayload }
  | { event: 'create'; payload: GitHubCreatePayload }
  | { event: 'delete'; payload: GitHubDeletePayload }
  | { event: 'repository'; payload: GitHubRepositoryPayload };
