FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN apk add --no-cache openssh && npm install

COPY . .

CMD ["npm", "start"]