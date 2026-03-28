ARG BASE_IMAGE=node:22-slim

FROM ${BASE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ src/
RUN npm run build

FROM ${BASE_IMAGE}
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist/ dist/
RUN mkdir -p /app/data
EXPOSE 3000
USER node
CMD ["node", "dist/index.js"]
