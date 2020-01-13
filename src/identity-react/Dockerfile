FROM node

RUN mkdir -p /srv/app/client
WORKDIR /srv/app/client

COPY ./package.json /srv/app/client
COPY ./package-lock.json /srv/app/client
COPY . /srv/app/client

RUN npm install
RUN npm run build

EXPOSE 3000

CMD ./node_modules/.bin/http-server ./build --port 3000 --proxy http://localhost:3000?

