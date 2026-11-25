FROM node:24.22.1-bookworm-slim@sha256:be8204d4bd327363357f532187b752ff62759c31bedf98e9e18fc08c9cbd605c
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
ARG BUILD_DATE
ARG SOURCE_REVISION
ARG APP_VERSION=0.1.0
LABEL org.opencontainers.image.title="Material Asus Router" \
      org.opencontainers.image.description="Manage an Asus router over SSH with readable controls, previews and undo." \
      org.opencontainers.image.source="https://github.com/Ding-Ding-Projects/material-asus-router" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.revision=$SOURCE_REVISION \
      org.opencontainers.image.created=$BUILD_DATE \
      org.opencontainers.image.version=$APP_VERSION
COPY server ./server
COPY public ./public
RUN mkdir /data && chown node:node /data
USER node
ENV DATA_DIR=/data BIND_ADDRESS=0.0.0.0 PORT=8790 NODE_ENV=production \
    APP_VERSION=$APP_VERSION SOURCE_REVISION=$SOURCE_REVISION BUILD_DATE=$BUILD_DATE
EXPOSE 8790
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:8790/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "server/index.mjs"]
