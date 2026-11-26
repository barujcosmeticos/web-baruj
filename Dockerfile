FROM node:22-alpine

RUN apk add --no-cache su-exec

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data

COPY docker-entrypoint.sh ./
COPY server.js robots.txt ./
COPY css ./css
COPY js ./js
COPY assets ./assets
COPY servidor ./servidor

RUN chmod +x /app/docker-entrypoint.sh \
    && mkdir -p /data \
    && chown node:node /data

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD wget -qO- http://127.0.0.1:3000/health > /dev/null || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
