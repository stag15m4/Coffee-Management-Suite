FROM node:20-slim AS builder

WORKDIR /app

# Vite needs these at build time (baked into client bundle)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-slim AS runner

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
CMD ["node", "--require", "./dist/instrument.cjs", "dist/index.cjs"]
