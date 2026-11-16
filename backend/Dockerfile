FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
# migrations pendentes primeiro; se falhar, o container não sobe
CMD ["sh", "-c", "node src/seed.js && node src/server.js"]
