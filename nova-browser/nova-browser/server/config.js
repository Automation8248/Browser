// Centralized configuration loader
import 'dotenv/config';

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '8080', 10),
  jwtSecret: process.env.JWT_SECRET || 'dev_only_secret_change_me',
  sessionTtl: parseInt(process.env.SESSION_TTL_HOURS || '12', 10),
  chromiumUrl: process.env.CHROMIUM_URL || 'ws://nova-chromium:9222',
  profilesPath: process.env.PROFILES_PATH || '/data/profiles',
  downloadsPath: process.env.DOWNLOADS_PATH || '/data/downloads',
  maxTabs: parseInt(process.env.MAX_TABS || '20', 10),
  ephemeral: process.env.EPHEMERAL === 'true',
  adminUser: process.env.ADMIN_USER || 'admin',
  adminPassHash: process.env.ADMIN_PASS_HASH || '',
  outboundProxy: process.env.OUTBOUND_PROXY || '',
};

if (!config.jwtSecret || config.jwtSecret.length < 32) {
  console.warn('⚠  JWT_SECRET is short. Use 32+ characters in production.');
}
