# hub2lab

Bidirectional GitHub ↔ GitLab repository sync service. Mirrors pushes, branches, tags, and repository events between GitHub organizations and GitLab groups with loop prevention.

## How It Works

hub2lab runs as an HTTP server that receives webhooks from both GitHub and GitLab. When a push, branch/tag creation, or deletion arrives from one side, it replays the action on the other side via the respective API.

```
GitHub push → hub2lab → GitLab API (create branch, push files, etc.)
GitLab push → hub2lab → GitHub API (create branch, push files, etc.)
```

### Loop Prevention

Every synced commit includes a configurable marker string (default `[hub2lab]`) in the commit message. Incoming webhooks that contain this marker in any commit message are silently ignored, preventing infinite sync loops.

### Branch / Tag Sync

- **Create** — a branch or tag created on GitHub is created on GitLab (and vice versa)
- **Delete** — a branch or tag deleted on one side is recorded as a marker file on the other side (not automatically deleted, for safety)
- **Push** — commits are pushed to the target via the mirror directory, with a marker commit to prevent re-sync

### Repository Lifecycle

- **Created** — a new repo created on GitHub is mirrored as a new GitLab project
- **Deleted** — a repo deleted on one side is recorded as a marker file on the other
- **Renamed** — a repo rename on GitHub is reflected in the mapping at runtime

## Mapping Configuration

Create a `mapping.json` that defines GitHub org ↔ GitLab group pairs and optionally which repos to sync.

### Explicit mode — list every repo

```json
{
  "mappings": [
    {
      "github_org": "acme-corp",
      "gitlab_group": "acme",
      "repos": {
        "frontend": "frontend",
        "backend-api": "backend-api",
        "docs": "documentation"
      }
    }
  ]
}
```

Use this when repo names differ between sides or you only want a subset synced. Key is the GitHub repo name, value is the GitLab project name.

### Auto mode — sync all repos

```json
{
  "mappings": [
    {
      "github_org": "oss-town",
      "gitlab_group": "oss-mirrors"
    }
  ]
}
```

Omit `repos` entirely. Any repo in the GitHub org is synced to the same-named GitLab project (and vice versa). Useful when you have many repos and they share names on both sides.

### Mix both in one file

```json
{
  "mappings": [
    { "github_org": "acme-corp", "gitlab_group": "acme",
      "repos": { "backend": "backend-service" } },
    { "github_org": "oss-town", "gitlab_group": "oss-mirrors" }
  ]
}
```

## Setup

### 1. Prerequisites

- Node.js ≥ 20
- npm

### 2. Install

```bash
git clone <repo-url> hub2lab
cd hub2lab
npm install
```

### 3. Configure

Copy the example env and mapping files:

```bash
cp .env.example .env
cp mapping.example.json mapping.json
```

Edit `.env` with your tokens and secrets:

| Variable | Description |
|---|---|
| `PORT` | HTTP server port (default `3000`) |
| `GITHUB_TOKEN` | GitHub personal access token with `repo` scope |
| `GITHUB_WEBHOOK_SECRET` | Secret for verifying GitHub webhook signatures |
| `GITLAB_TOKEN` | GitLab personal access token with `api` scope |
| `GITLAB_WEBHOOK_SECRET` | Token for verifying GitLab webhook requests |
| `GITLAB_BASE_URL` | GitLab instance URL (default `https://gitlab.com`) |
| `MAPPING_FILE` | Path to mapping JSON (default `./mapping.json`) |
| `MIRROR_DIR` | Temp directory for git mirror operations (default `./mirrors`) |
| `SYNC_MARKER` | Marker string in commit messages to prevent loops (default `[hub2lab]`) |

Edit `mapping.json` to define your org/group/repo mappings (see above).

### 4. GitHub PAT scopes

- `repo` (full control of private repositories)
- `admin:org` (read org membership — optional, for org-level events)

### 5. GitLab PAT scopes

- `api` (full API access)
- `write_repository` (push files)

## Running

### Development

```bash
npm run dev
```

Uses `tsx watch` for hot-reload.

### Production

```bash
npm run build
npm start
```

## Webhook Setup

### GitHub

1. Go to your GitHub org → Settings → Webhooks → Add webhook
2. **Payload URL**: `https://your-server/webhook/github`
3. **Content type**: `application/json`
4. **Secret**: same as `GITHUB_WEBHOOK_SECRET` in `.env`
5. **Events**: select "Just the push event" and add "Branch or tag creation", "Branch or tag deletion", "Repositories" (for create/delete/rename)
6. Ensure the server is publicly reachable (or use a tunnel like ngrok)

### GitLab

1. Go to your GitLab group → Settings → Webhooks → Add new webhook
2. **URL**: `https://your-server/webhook/gitlab`
3. **Secret token**: same as `GITLAB_WEBHOOK_SECRET` in `.env`
4. **Trigger**: Push events, Tag push events
5. Ensure the server is publicly reachable

## Project Structure

```
src/
├── index.ts              # Express server entry point
├── types.ts              # Shared type definitions
├── config/
│   ├── index.ts          # Config loader (env vars + mapping file)
│   ├── logger.ts         # Winston logger
│   └── mapper.ts         # Org/group ↔ repo resolution
├── github/
│   ├── client.ts         # GitHub API helpers (Octokit)
│   └── webhook.ts        # GitHub signature verification & event parsing
├── gitlab/
│   ├── client.ts         # GitLab API helpers (@gitbeaker/rest)
│   └── webhook.ts        # GitLab token verification & event parsing
├── handlers/
│   ├── github.ts         # Webhook handlers for GitHub events
│   └── gitlab.ts         # Webhook handlers for GitLab events
└── sync/
    ├── engine.ts         # Event routing dispatcher
    ├── mirror.ts         # Git mirror-based push via simple-git
    └── deletion.ts       # Deletion marker file builders
```

## Scripts

| Command | Description |
|---|---|
| `npm run build` | Compile TypeScript → `dist/` |
| `npm start` | Run compiled output |
| `npm run dev` | Run with hot-reload |
| `npm run lint` | Type-check without emitting |

## Safety

- **Deletions are not mirrored automatically.** When a branch, tag, or repository is deleted on one side, a marker file is written to the target repository instead of performing the deletion. This prevents accidental data loss.
- **Loop prevention** uses a marker string in commit messages. Any incoming webhook with a matching marker is dropped.
- **Signature verification** is enforced for GitHub webhooks (HMAC-SHA256). GitLab uses a shared secret token.
