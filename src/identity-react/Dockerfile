FROM node:10.20.1

WORKDIR /srv/app/client

COPY ./package.json .
COPY ./package-lock.json .
COPY ./cypress/ ./cypress/

RUN npm install && npm install pm2 -g

COPY . .

EXPOSE 3000

CMD npm start

