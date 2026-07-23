# ── Build stage ──────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS build
WORKDIR /app

# Native deps for canvas (chartjs-node-canvas)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev \
    python3 pkg-config \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

# ── Runtime stage ────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Runtime libs for canvas + fonts for PDFKit/canvas text rendering
RUN apt-get update && apt-get install -y --no-install-recommends \
    libcairo2 libpango-1.0-0 libpangocairo-1.0-0 libjpeg62-turbo libgif7 librsvg2-2 \
    fontconfig fonts-dejavu-core fonts-liberation \
  && rm -rf /var/lib/apt/lists/* && fc-cache -f

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/report-templates ./report-templates

EXPOSE 3000
CMD ["node", "dist/src/main.js"]
