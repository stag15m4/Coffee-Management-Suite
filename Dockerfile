# ---- Build stage ----
FROM node:22-alpine AS builder

WORKDIR /app

# Vite embeds these into the client bundle at build time
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_USE_MOCK_DATA

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Production stage ----
FROM node:22-alpine AS production

WORKDIR /app

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist

# Run as non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chown -R appuser:appgroup /app
USER appuser

ENV NODE_ENV=production
ENV PORT=5001

EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5001/api/health',(r)=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

CMD ["node", "--require", "./dist/instrument.cjs", "dist/index.cjs"]
