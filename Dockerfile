FROM node:20-slim

WORKDIR /app

# Install dependencies first (cached layer)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source and build frontend
COPY . .
RUN npm run build

EXPOSE 3001

CMD ["node", "server_pg.cjs"]
