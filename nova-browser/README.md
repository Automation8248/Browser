# 🌐 Nova Browser

A Chrome-inspired remote browser with secure streaming, tab management, virtual drive, and clipboard sync.

## Features

- 🔒 **Secure Login** — JWT-based auth gate
- 🗂️ **Tab Management** — Open, close, duplicate, switch
- 🎥 **Low-latency Streaming** — CDP screencast over WebSocket
- 📋 **Clipboard Sync** — Two-way between OS and remote browser
- 💾 **Virtual Drive** — Upload/download files, export ZIP
- 🔐 **Session Persistence** — Restore tabs on login
- 🐳 **Docker Sandbox** — Cgroups limits, container isolation
- 🕶️ **Ephemeral Mode** — Wipe data on close

## Quick Start

```bash
# 1. Clone
git clone https://github.com/YOURUSER/nova-browser.git
cd nova-browser

# 2. Setup
cp .env.example .env
bash scripts/setup.sh

# 3. Generate admin hash
node scripts/generate-hash.js YourStrongPassword
# → Copy the output into .env as ADMIN_PASS_HASH

# 4. Edit .env — set JWT_SECRET (32+ chars) and CHROMIUM_PASSWORD

# 5. Launch
docker-compose up -d

# 6. Open
open http://localhost:8080/login.html
