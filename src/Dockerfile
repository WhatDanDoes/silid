FROM node:12.18.3

ARG NODE_ENV
ARG PORT=3001
ARG REACT_APP_COMMIT

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
RUN mkdir -p /app/build && cp -r /srv/app/client/build/* /app/build

EXPOSE $PORT

CMD NODE_ENV=$NODE_ENV npm start

