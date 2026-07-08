FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci
COPY src/ src/
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --production
COPY --from=builder /app/dist/ ./dist/
RUN adduser -D -h /app anixio && chown -R anixio:anixio /app
USER anixio
EXPOSE 7000
CMD ["node", "dist/server.js"]
