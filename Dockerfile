# 腾讯云 CloudBase 云托管（容器型）：监听端口需与部署时 --port 一致
FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# 项目无额外 npm 依赖，仅需业务文件
COPY package.json ./
COPY server.js ./
COPY index.html ./

EXPOSE 8080

USER node

CMD ["node", "server.js"]
