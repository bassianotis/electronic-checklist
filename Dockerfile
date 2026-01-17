FROM node:20-bullseye

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDeps for building and tsx)
RUN npm ci

# Copy source code
COPY . .

# Build frontend (outputs to dist/)
RUN npm run build

# Create data directory
RUN mkdir -p data

# Expose port
EXPOSE 3000

# Set production env
ENV NODE_ENV=production
ENV PORT=3000

# Start server
# Using npx tsx to run the server directly. 
# Ensure tsx is available (it is in devDependencies, installed by npm ci)
CMD ["npx", "tsx", "server/index.ts"]
