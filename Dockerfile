FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.json tsconfig.build.json ./
RUN npm ci --fetch-retries=5 --fetch-retry-mintimeout=2000
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:24-alpine
# git is needed at runtime: the docs index is built from a sparse clone of mastra-ai/mastra.
RUN apk add --no-cache git
WORKDIR /app
ENV NODE_ENV=production XDG_CACHE_HOME=/data
COPY package.json LICENSE NOTICE ./
RUN mkdir -p /data && chown node:node /data
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
VOLUME /data
# MCP over stdio: run with `-i` and no TTY.
ENTRYPOINT ["node", "dist/index.js"]
