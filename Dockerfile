FROM node:22-bookworm-slim

ENV NODE_ENV=production

WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY backend ./ 
COPY cdmc-web-final /app/cdmc-web-final

EXPOSE 4000

CMD ["node", "src/server.js"]
