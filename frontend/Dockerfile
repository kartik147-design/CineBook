FROM node:22-alpine AS dependencies

WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

FROM dependencies AS development

ENV VITE_API_URL=/api \
    CINEBOOK_PROXY_TARGET=http://backend:5001
COPY frontend/ ./
EXPOSE 5000
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5000"]

FROM dependencies AS source

COPY frontend/ ./

FROM source AS test

RUN npm run lint && npm run build
CMD ["node", "-e", "console.log('Frontend lint and build passed.')"]

FROM source AS build

ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

FROM nginx:1.27-alpine AS staging

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
