FROM node

#
# Build client app
#
RUN mkdir -p /srv/app/client
WORKDIR /srv/app/client

COPY ./identity-react/package.json /srv/app/client
COPY ./identity-react/package-lock.json /srv/app/client
COPY ./identity-react /srv/app/client

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

EXPOSE 3001

CMD NODE_ENV=staging npm start 

