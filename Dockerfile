FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@latest --activate

# Set timezone
RUN apk add --no-cache tzdata
ENV TZ=Asia/Shanghai

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# 导入环境变量
ARG LARK_DOMAIN
ARG LARK_CLIENT_ID
ARG LARK_CLIENT_SECRET
ARG LARK_REDIRECT_URI
ARG LARK_FOLDER_TOKEN
ARG DATA_DIR_NAME
ARG TASK_LIST_TABLE_NAME
ARG BACKEND_SERVER_URL
ARG SCRAPEAPI_TOKEN
ARG PORT
ARG LOG_LEVEL

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml ./
# Install only production dependencies
RUN pnpm install --prod --frozen-lockfile

# Copy built artifacts
COPY --from=builder /app/dist ./dist

# Create a non-root user (optional but good practice, keeping simple for now as per "allow docker start")
# If strict security needed, we can add user.

EXPOSE 3008

CMD ["node", "dist/index.js"]
