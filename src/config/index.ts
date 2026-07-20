import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { MappingConfig } from '../types';

dotenv.config();

export interface AppConfig {
  port: number;
  github: {
    token: string;
    webhookSecret: string;
  };
  gitlab: {
    token: string;
    webhookSecret: string;
    baseUrl: string;
  };
  mapping: MappingConfig;
  mirrorDir: string;
  syncMarker: string;
}

function loadMapping(filePath: string): MappingConfig {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    console.warn(`Mapping file not found at ${resolved}, using empty config`);
    return { mappings: [] };
  }
  const raw = fs.readFileSync(resolved, 'utf-8');
  return JSON.parse(raw);
}

function getRequired(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

export function loadConfig(): AppConfig {
  const mappingFile = process.env.MAPPING_FILE || './mapping.json';

  return {
    port: parseInt(process.env.PORT || '3000', 10),
    github: {
      token: getRequired('GITHUB_TOKEN'),
      webhookSecret: getRequired('GITHUB_WEBHOOK_SECRET'),
    },
    gitlab: {
      token: getRequired('GITLAB_TOKEN'),
      webhookSecret: getRequired('GITLAB_WEBHOOK_SECRET'),
      baseUrl: process.env.GITLAB_BASE_URL || 'https://gitlab.com',
    },
    mapping: loadMapping(mappingFile),
    mirrorDir: process.env.MIRROR_DIR || path.resolve(process.cwd(), 'mirrors'),
    syncMarker: process.env.SYNC_MARKER || '[hub2lab]',
  };
}
