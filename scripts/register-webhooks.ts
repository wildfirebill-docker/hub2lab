import { Octokit } from 'octokit';
import { Gitlab } from '@gitbeaker/rest';

const HUB2LAB_URL = process.env.HUB2LAB_URL!;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const GITHUB_SECRET = process.env.GITHUB_WEBHOOK_SECRET!;
const GITLAB_TOKEN = process.env.GITLAB_TOKEN!;
const GITLAB_SECRET = process.env.GITLAB_WEBHOOK_SECRET!;
const MAPPING_FILE = process.env.MAPPING_FILE || './mapping.json';
const DRY_RUN = process.env.DRY_RUN !== 'false';

const mapping = require('../' + MAPPING_FILE);

const GITHUB_EVENTS = ['push', 'create', 'delete', 'repository'];
const GITLAB_EVENTS = ['push_events', 'tag_push_events'];

async function registerGitHubWebhooks(githubOrg: string) {
  const octokit = new Octokit({ auth: GITHUB_TOKEN });
  const url = `${HUB2LAB_URL}/webhook/github`;

  if (DRY_RUN) {
    console.log(`[DRY-RUN] GitHub org=${githubOrg} → ${url}`);
    return;
  }

  try {
    const existing = await octokit.rest.orgs.listWebhooks({ org: githubOrg });
    const already = existing.data.find((h: any) => h.config?.url === url);
    if (already) {
      console.log(`GitHub webhook already exists for ${githubOrg} (id=${already.id})`);
      return;
    }
  } catch { /* may not exist yet */ }

  await octokit.rest.orgs.createWebhook({
    org: githubOrg,
    name: 'web',
    config: { url, content_type: 'json', secret: GITHUB_SECRET },
    events: GITHUB_EVENTS,
    active: true,
  });
  console.log(`Registered GitHub webhook for ${githubOrg}`);
}

async function registerGitLabWebhooks(gitlabGroup: string) {
  const client = new Gitlab({ token: GITLAB_TOKEN });
  const url = `${HUB2LAB_URL}/webhook/gitlab`;

  if (DRY_RUN) {
    console.log(`[DRY-RUN] GitLab group=${gitlabGroup} → ${url}`);
    return;
  }

  const groups = await client.Groups.search(gitlabGroup);
  const group = groups.find((g: any) => g.full_path === gitlabGroup);
  if (!group) {
    console.error(`GitLab group not found: ${gitlabGroup}`);
    return;
  }

  const existing = await client.GroupHook.all(group.id);
  const already = existing.find((h: any) => h.url === url);
  if (already) {
    console.log(`GitLab webhook already exists for ${gitlabGroup} (id=${already.id})`);
    return;
  }

  await client.GroupHook.create(group.id, url, GITLAB_SECRET, {
    pushEvents: true,
    tagPushEvents: true,
  });
  console.log(`Registered GitLab webhook for ${gitlabGroup}`);
}

async function main() {
  const hubUrl = HUB2LAB_URL || console.error('HUB2LAB_URL required');
  if (!hubUrl) process.exit(1);

  console.log(`Mode: ${DRY_RUN ? 'DRY-RUN' : 'LIVE'}\n`);

  for (const m of mapping.mappings) {
    await Promise.all([
      registerGitHubWebhooks(m.github_org),
      registerGitLabWebhooks(m.gitlab_group),
    ]);
  }
}

main().catch(console.error);
