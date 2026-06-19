FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV FOLD_DATA_DIR=/data/append-log

EXPOSE 3000

CMD ["npm", "start"]
