# Multi-stage Dockerfile for Imvelo Shift - Enterprise Shift Swap System

# Stage 1: Build Phase
FROM node:22-alpine AS builder
WORKDIR /app

# Copy dependency files first for layer caching
COPY package*.json ./

# Install all dependencies (including devDependencies like esbuild/typescript/vite for compilation)
RUN npm ci

# Copy the rest of the application source code
COPY . .

# Compile frontend assets and bundle Express backend
RUN npm run build

# Stage 2: Runtime Phase
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy package descriptors for installing production dependencies
COPY --from=builder /app/package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy only the compiled/built distribution assets from the build stage
COPY --from=builder /app/dist ./dist

# Create empty runtime directories for local persistence, uploads, and logs as required
RUN mkdir -p uploads logs data

# Expose the mandatory app port (3000)
EXPOSE 3000

# Start the bundled Express server
CMD ["npm", "start"]
