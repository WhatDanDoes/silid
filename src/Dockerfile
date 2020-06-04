FROM node:10.20.1

ARG NODE_ENV
ARG PORT=3001

ENV NODE_ENV=$NODE_ENV
ENV PORT=$PORT

#
# Build client app
#
WORKDIR /srv/app/client

COPY ./identity-react/package.json .
COPY ./identity-react/package-lock.json .
COPY ./identity-react .

RUN npm install --production
RUN npm run build

#
# Start server app
#
WORKDIR /app

COPY ./silid-server/package.json .
COPY ./silid-server/package-lock.json .

RUN npm install --production

COPY ./silid-server .


# Copy client build
RUN cp -R /srv/app/client/build/* /app/build

EXPOSE $PORT

CMD NODE_ENV=$NODE_ENV npm start

