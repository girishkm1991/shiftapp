# Multi-stage Dockerfile for Imvelo Shift - Enterprise Shift Swap System

# Stage 1: Build Phase
FROM node:22-alpine AS builder
WORKDIR /app

# Copy dependency files
COPY package.json ./

# Install all dependencies (including devDependencies for esbuild/typescript compiling)
RUN npm install

# Copy application files
COPY . .

# Run production compilation: builds Vite assets and bundles Express server.ts
RUN npm run build

# Stage 2: Runtime Phase
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy package descriptors and built assets
COPY --from=builder /app/package.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/data ./data

# Install ONLY production dependencies to keep the image slim
RUN npm install --only=production

# Expose mandatory Cloud Run port
EXPOSE 3000

# Start command
CMD ["npm", "start"]
