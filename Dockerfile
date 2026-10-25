# Base image with full Firefox and noVNC Web UI
FROM lscr.io/linuxserver/firefox:latest

# Server configurations and timezone
ENV PUID=1000
ENV PGID=1000
ENV TZ=Asia/Kolkata
ENV TITLE="My Cloud Browser"

# Expose the default HTTP port for the web interface
EXPOSE 3000
