FROM node:20-slim

WORKDIR /app

# Copy package descriptors
COPY package*.json ./

# Install dependencies (including build tools for frontend)
RUN npm install

# Copy application source code and build frontend bundle
COPY . .
RUN npm run build

# Set production environment and expose port
ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "server_pg.cjs"]
