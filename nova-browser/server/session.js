// Tab & profile persistence per user
import fs from 'fs/promises';
import path from 'path';
import { config } from './config.js';

function profileDir(userId) {
  return path.join(config.profilesPath, userId);
}

function sessionFile(userId) {
  return path.join(profileDir(userId), 'session.json');
}

async function ensureDir(userId) {
  await fs.mkdir(profileDir(userId), { recursive: true });
}

// ── Save open tabs ────────────────────────────────
export async function saveTabs(userId, tabs) {
  await ensureDir(userId);
  const data = {
    savedAt: Date.now(),
    tabs: (tabs || []).slice(0, config.maxTabs),
  };
  await fs.writeFile(sessionFile(userId), JSON.stringify(data, null, 2));
}

// ── Load tabs (returns default if none) ──────────
export async function loadTabs(userId) {
  try {
    const raw = await fs.readFile(sessionFile(userId), 'utf8');
    const data = JSON.parse(raw);
    return data.tabs || [];
  } catch {
    return [{
      id: 'home',
      title: 'Nova Home',
      url: 'https://www.google.com',
      favicon: 'N',
    }];
  }
}

// ── Bookmarks persistence ─────────────────────────
function bookmarksFile(userId) {
  return path.join(profileDir(userId), 'bookmarks.json');
}

export async function saveBookmarks(userId, bookmarks) {
  await ensureDir(userId);
  await fs.writeFile(bookmarksFile(userId), JSON.stringify(bookmarks || [], null, 2));
}

export async function loadBookmarks(userId) {
  try {
    const raw = await fs.readFile(bookmarksFile(userId), 'utf8');
    return JSON.parse(raw);
  } catch {
    return [
      { title: 'Google', url: 'https://google.com', icon: 'G' },
      { title: 'YouTube', url: 'https://youtube.com', icon: 'Y' },
      { title: 'GitHub', url: 'https://github.com', icon: 'H' },
    ];
  }
}

// ── Wipe user data (ephemeral / logout) ──────────
export async function wipeProfile(userId) {
  await fs.rm(profileDir(userId), { recursive: true, force: true });
}
