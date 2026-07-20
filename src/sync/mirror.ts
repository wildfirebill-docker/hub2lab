import path from 'path';
import fs from 'fs';
import simpleGit, { SimpleGit } from 'simple-git';
import { AppConfig } from '../config';
import { logger } from '../config/logger';

function mirrorPath(config: AppConfig, remoteId: string): string {
  return path.join(config.mirrorDir, remoteId);
}

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

export async function mirrorPush(
  config: AppConfig,
  sourceUrl: string,
  sourceToken: string,
  targetUrl: string,
  targetToken: string,
  ref: string,
  loopMessage: string
): Promise<void> {
  const remoteId = Buffer.from(`${sourceUrl}|${targetUrl}`).toString('base64url').slice(0, 32);
  const mPath = mirrorPath(config, remoteId);
  ensureDir(config.mirrorDir);

  let git: SimpleGit;

  if (fs.existsSync(path.join(mPath, '.git'))) {
    await simpleGit(mPath).fetch('origin');
    git = simpleGit(mPath);
    logger.info(`Updated existing mirror at ${mPath}`);
  } else {
    const authenticatedSource = sourceUrl.replace('://', `://x-access-token:${sourceToken}@`);
    ensureDir(mPath);
    await simpleGit().clone(authenticatedSource, mPath, ['--mirror']);
    git = simpleGit(mPath);
    logger.info(`Cloned fresh mirror at ${mPath}`);
  }

  if (ref.startsWith('refs/heads/') || ref.startsWith('refs/tags/')) {
    await git.push([
      '--force',
      targetUrl.replace('://', `://x-access-token:${targetToken}@`),
      `${ref}:${ref}`,
    ]);
    logger.info(`Mirror-pushed ${ref} to target`);
  } else if (ref === '_delete_branch_') {
    logger.info(`Skipping git push for deletion event (handled via API)`);
  }
}

export async function initMirrorCleanup(config: AppConfig): Promise<void> {
  if (fs.existsSync(config.mirrorDir)) {
    const entries = fs.readdirSync(config.mirrorDir);
    for (const entry of entries) {
      const full = path.join(config.mirrorDir, entry);
      if (entry.startsWith('cleanup-')) {
        const pid = parseInt(entry.replace('cleanup-', ''), 10);
        try {
          process.kill(pid, 0);
        } catch {
          fs.rmSync(full, { recursive: true, force: true });
        }
      }
    }
  }
}
