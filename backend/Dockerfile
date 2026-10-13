FROM node:22-alpine AS dependencies

WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/ ./
COPY frontend/src/data/movies.json /app/frontend/src/data/movies.json

ENV PORT=5001 \
    CINEBOOK_DATA_DIR=/app/data

FROM dependencies AS development

ENV NODE_ENV=development
EXPOSE 5001
CMD ["npm", "run", "dev"]

FROM dependencies AS test

ENV NODE_ENV=test
CMD ["npm", "test"]

FROM dependencies AS staging

ENV NODE_ENV=production
RUN npm prune --omit=dev
EXPOSE 5001
CMD ["node", "server.js"]
