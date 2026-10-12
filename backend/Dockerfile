FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app/backend

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

COPY backend/ ./
COPY frontend/src/data/movies.json /app/frontend/src/data/movies.json

ENV PORT=5000 \
    CINEBOOK_DATA_DIR=/app/data

VOLUME ["/app/data"]
EXPOSE 5000

CMD ["node", "server.js"]
