FROM node:12.18.3
ENV PORT=3001

WORKDIR /app

COPY ./package.json .
COPY ./package-lock.json .

RUN npm install

COPY . .

EXPOSE $PORT

CMD npm start
