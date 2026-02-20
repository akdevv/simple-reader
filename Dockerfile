FROM node:20
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# System deps for onnxruntime-node
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

# Generate Prisma client + build
RUN pnpm prisma generate
RUN pnpm build

EXPOSE 3000

CMD ["pnpm", "start"]
