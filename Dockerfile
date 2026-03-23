# ── Stage 1: Build ─────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY svelte.config.js vite.config.ts tsconfig.json ./
COPY src/ src/
COPY static/ static/

RUN npm run build
RUN npm prune --omit=dev

# ── Stage 2: Runtime ───────────────────────────────────────
FROM node:22-slim AS runtime

ARG INSTALL_LIBREOFFICE=false
RUN if [ "$INSTALL_LIBREOFFICE" = "true" ]; then \
      apt-get update && \
      apt-get install -y --no-install-recommends \
        libreoffice-writer \
        libreoffice-core \
        fonts-dejavu-core && \
      rm -rf /var/lib/apt/lists/*; \
    fi

WORKDIR /app

COPY --from=builder /app/node_modules node_modules/
COPY --from=builder /app/package.json package.json
COPY --from=builder /app/build build/

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV ORIGIN=http://localhost:3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3000',{signal:AbortSignal.timeout(3000)}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

USER node

CMD ["node", "build"]
