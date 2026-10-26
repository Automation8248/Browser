FROM lscr.io/linuxserver/chromium:latest

# Environment variables setting for noVNC
ENV TITLE=Secure-Virtual-Browser
ENV DISPLAY=:1
ENV SCREEN_RESOLUTION=1280x720

# Python support aur basic tools install karne ke liye
RUN apk add --no-cache curl python3 py3-requests

# 🔒 BASIC AUTH SECURITY (Username & Password)
# Niche 'admin' aur 'MySecurePassword123' ko apni pasand se badal lein
ENV CUSTOM_USER=admin
ENV CUSTOM_PASSWORD=MySecurePassword123

EXPOSE 3000
