FROM node

ENV WEBHOOK_URL=webhook
ENV WEBHOOK_SECRET=supersecret

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 8080
CMD [ "npm", "start" ]
