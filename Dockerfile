FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Development: Vite dev server with hot reload (source is bind-mounted by compose).
FROM base AS dev
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

FROM base AS build
RUN npm run build

# Hosting upload: docker build --target release --output release .
# writes release/dist/ and release/dotted-paper.zip (ready for Hostinger's File Manager).
FROM alpine:3.20 AS package
RUN apk add --no-cache zip
COPY --from=build /app/dist /dist
RUN cd /dist && zip -rq /dotted-paper.zip .

FROM scratch AS release
COPY --from=build /app/dist /dist
COPY --from=package /dotted-paper.zip /

# Production: static files served by nginx.
FROM nginx:1.27-alpine AS prod
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
