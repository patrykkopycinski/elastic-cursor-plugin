# Elastic Developer Experience Cursor Plugin — MCP server container
# Stdio by default; set PORT for streamable HTTP transport.
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY packages ./packages
COPY tsconfig.json ./
RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=builder /app/packages ./packages

ENV NODE_ENV=production
EXPOSE 3000

# Default: stdio (MCP client connects via stdin/stdout).
# For HTTP: set PORT=3000 and the server will listen when streamable HTTP is enabled.
ENTRYPOINT ["node", "packages/mcp-server/dist/index.js"]
