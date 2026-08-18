FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
COPY tests ./tests
COPY scripts ./scripts
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/@phosphor-icons/web ./node_modules/@phosphor-icons/web
COPY package.json ./
COPY public ./public
COPY fixtures ./fixtures
EXPOSE 8787
CMD ["node", "dist/src/server.js"]
