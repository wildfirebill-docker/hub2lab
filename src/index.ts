import express from 'express';
import { loadConfig } from './config';
import { logger } from './config/logger';
import { verifyGitHubSignature, parseGitHubEvent } from './github/webhook';
import { verifyGitLabToken, parseGitLabEvent } from './gitlab/webhook';
import { processGitHubEvent, processGitLabEvent } from './sync/engine';
import { initMirrorCleanup } from './sync/mirror';

const app = express();
const config = loadConfig();

app.use(express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf.toString();
  }
}));

app.post('/webhook/github', async (req, res) => {
  if (!verifyGitHubSignature(config, req)) {
    logger.warn('Invalid GitHub webhook signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const parsed = parseGitHubEvent(req);
  if (!parsed) {
    return res.status(400).json({ error: 'Unknown event' });
  }

  res.status(202).json({ received: true });

  try {
    await processGitHubEvent(config, parsed.event, parsed.payload);
  } catch (err: any) {
    logger.error('GitHub event processing failed', { error: err.message });
  }
});

app.post('/webhook/gitlab', async (req, res) => {
  if (!verifyGitLabToken(config, req)) {
    logger.warn('Invalid GitLab webhook token');
    return res.status(401).json({ error: 'Invalid token' });
  }

  const parsed = parseGitLabEvent(req);
  if (!parsed) {
    return res.status(400).json({ error: 'Unknown event' });
  }

  res.status(202).json({ received: true });

  try {
    await processGitLabEvent(config, parsed.event, parsed.payload);
  } catch (err: any) {
    logger.error('GitLab event processing failed', { error: err.message });
  }
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

initMirrorCleanup(config);

app.listen(config.port, () => {
  logger.info(`hub2lab listening on port ${config.port}`);
});
