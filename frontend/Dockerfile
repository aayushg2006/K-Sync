FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY index.html ./
COPY components.json ./
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY tailwind.config.ts ./
COPY src ./src

ARG VITE_API_BASE_URL=https://k-sync-backend-729436216540.asia-south1.run.app
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

FROM nginx:1.27-alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
