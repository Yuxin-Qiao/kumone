# Ultra-lightweight Kumone Web & PWA Docker Image
FROM node:22-alpine

WORKDIR /app

# Copy web files
COPY web/ ./

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

EXPOSE 3000

USER node

CMD ["node", "server.js"]
