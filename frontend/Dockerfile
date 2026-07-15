# Frontend Dockerfile (build from this directory / TAMS frontend repo root)
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG NEXT_PUBLIC_API_BASE_URL=/api/v1
ARG BACKEND_URL=http://backend:8000
ARG NEXT_PUBLIC_HOSTED_API_BASE_URL=
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV BACKEND_URL=$BACKEND_URL
ENV NEXT_PUBLIC_HOSTED_API_BASE_URL=$NEXT_PUBLIC_HOSTED_API_BASE_URL

RUN npm run build

FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache dumb-init wget

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/next.config.js ./next.config.js

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
USER nextjs

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/ || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "start"]
