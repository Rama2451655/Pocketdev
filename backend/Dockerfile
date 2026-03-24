# PocketDev IDE - Execution Server Dockerfile
FROM node:20-alpine AS base

# Install language runtimes
RUN apk add --no-cache \
    python3 \
    py3-pip \
    gcc \
    g++ \
    musl-dev \
    go \
    bash \
    php83 \
    php83-cli \
    openjdk17 \
    curl \
    git

# Install Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
ENV PATH="/root/.cargo/bin:${PATH}"

# ---- APP SETUP ----
WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Create sandbox directory
RUN mkdir -p /tmp/pocketdev-sandboxes && chmod 777 /tmp/pocketdev-sandboxes

# Security: Run as non-root
RUN addgroup -S pocketdev && adduser -S pocketdev -G pocketdev
RUN chown -R pocketdev:pocketdev /app /tmp/pocketdev-sandboxes

# Apply resource limits via Docker (recommended for production)
# docker run --memory="256m" --cpus="1.0" --pids-limit=50 ...

USER pocketdev

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

CMD ["node", "server.js"]
