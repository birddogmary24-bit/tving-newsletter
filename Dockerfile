FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

# data 디렉토리 생성 (DB 저장용)
RUN mkdir -p /app/data

# Set environment variables (should be provided via Cloud Run Secret Manager in production)
ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "src/server.js"]
