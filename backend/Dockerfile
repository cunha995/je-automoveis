FROM node:18-alpine

# Create app directory
WORKDIR /app

# Install dependencies (prefer npm ci for reproducible installs if lockfile present)
COPY package*.json ./
RUN apk add --no-cache bash curl \
	&& if [ -f package-lock.json ]; then npm ci --only=production; else npm install --production; fi \
	&& apk add --no-cache tini \
	&& apk del bash

# Copy source
COPY . .

# Run as non-root user
RUN chown -R node:node /app

# Copy entrypoint and make executable
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Environment
ENV NODE_ENV=production
ENV PORT=3000

USER node

EXPOSE 3000

# Healthcheck (use runtime PORT when provided by platform)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 CMD sh -c "curl -fsS http://localhost:${PORT:-3000}/ || exit 1"

# Use tini as init system and run the entrypoint
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]

CMD ["node", "index.js"]
