FROM node
ARG PORT
WORKDIR /app

COPY ./package.json .
COPY ./package-lock.json .

RUN npm install

COPY . .

EXPOSE $PORT

CMD npm start
