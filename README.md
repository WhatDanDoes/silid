# silid

`silid` is comprised of two parts:

1. A client-side app bootstrapped with [Create React App](https://github.com/facebook/create-react-app).
2. A server app produced with `express-generator`. It is backed by a `sequelize`/`postgres` pairing.

The following describes how to deploy the application to your local development environment and execute tests. These steps are carried out in Ubuntu 18.04 with the latest system upgrades. At the time of writing, the main system dependencies and their versions include:

- Node v12.18.3
- NPM v7.10.0
- Docker version 20.10.6, build 370c289
- Git version 2.17.1

These are not required versions, but rather the most up-to-date available for the moment.

# Setup

[Watch the video setup instructions](https://youtu.be/f0DYs0JiIBw)

Clone this repository.

The client-side React application is found in `src/identity-react`.

The `express` server is found in `src/silid-server`.

## Server

### Setup

Navigate to the `src/silid-server` project directory and install the dependencies:

```
cd src/silid-server
npm install
```

For development and testing purposes, the configurations in `.env.example` are sufficient. Copy these to `.env`:

```
cp .env.example .env
```

### Test

`silid-server` has tests of its own, apart from the client-driven end-to-end tests. The easiest way to execute these tests is with the `make` task provided. From the project root folder:

```
make silid-unit-test
```

Alternatively, it may be convenient to execute select specs. Testing this way requires a PostgreSQL development server. Start one with `docker`:

```
docker run --name dev-postgres -p 5432:5432 -e POSTGRES_PASSWORD=pass -e POSTGRES_USER=user -d postgres
```

Once the image is running, execute the server-specific tests from the `src/silid-server` directory like this:

```
NODE_ENV=test npx jasmine spec/api/agentEditSpec.js
```

Or, to run all tests:

```
npm test
```

The tests executed here are the driving force behind the development of the `silid-server`. They do not test the front-end client, but rather the server's various API endpoints, authentication, its database models, and its treatment of the client-side app.

#### Clean up

Before executing the client-driven end-to-end tests, be sure to shutdown the `postgres` database:

```
docker stop dev-postgres
```

If you want to start the `postgres` container again, execute:

```
docker start dev-postgres
```

## Client

### Setup

Navigate to the `src/identity-react` directory and execute:

```
npm install
```

### End-to-end tests

As with any web application, this project is comprised of many moving parts. The most obvious include:

1. The `identity-react` client-side application served up by the `create-react-app` build server
2. The `silid-server` `express` application
3. The Auth0 mock server with which the `silid-server` interacts

The `silid-server` and Auth0 mock server are bundled together in a Docker composition for convenience. These containers are executed apart from the React build server and the Cypress test framework is executed apart from that. To set up the project for testing, it is convenient to execute each component in a seperate shell.

As with the server tests, there are several `make` tasks which are intended to simplify test execution. For general development purposes, execute the following tasks in the project's root folder:

```
make silid-compose-up
make silid-e2e-open
```

The commands above (best executed in seperate terminal sessions) execute the `silid-server`, the Auth0 mock server, and open the `cypress` interface for testing while developing. Tests executed for deployment use slightly different `make` tasks, which produce a production-optimized bundle:

```
make silid-compose-build-up
make silid-e2e-headless
```

The commands above execute all tests in a _headless_ browser. If you prefer to see tests run in the browser, execute this instead:

```
make silid-compose-build-up
make silid-e2e-run-build
```

### Client build server

The `make` tasks described in the previous section are intended to simplify the steps described below. If you've already installed the client's dependencies, you'll likely already be in the correct directory. If not, navigate to the `src/identity-react` directory and start the build server:

```
npm start
```

This will likely open a browser window. You can leave it open, but it's better to close it.

### e2e API test server

The client application tests against a local instance of the `silid-server` and a special mock server whose purpose is to return a public key with which to verify an Auth0 access token. These tests _do not_ execute against the live Auth0 server.

The `silid-server`/mock server combo are containerized. Open an new shell and navigate to the `src/silid-server` project directory. Start the `silid-server`/Auth0 mock server composition like this:

```
docker-compose -f docker-compose.e2e.yml up --build
```

Sometimes the database doesn't start on time during the first build. If `stdout` suggests this is the case, simply restart the server.

### Execute e2e tests

End-to-end tests may be executed in your preferred browser, or _headlessly_, as may be appropriate in a staging or CI environment.

These tests depend on `cypress`. Open a third shell and navigate to the `src/identity-react` project directory.

#### In-browser tests:

Open an interface and watch your tests execute:

```
npx cypress open
```

#### _Headless_ tests:

Execute `cypress` in a container (first run will be slow):

```
npm run test:headless
```

## Deploy to Staging

_(If starting from scratch, see Extras section below: "Staging Setup")_

### Client

Install dependencies:

```
npm install --production
```

### Server

In `./src/silid-server/`, configure `.env`:

```
AUTH0_CLIENT_ID=some-id
AUTH0_CLIENT_SECRET=some-secret
AUTH0_AUDIENCE=https://id.languagetechnology.org/
AUTH0_DEFAULT_AUDIENCE=https://silid.us.auth0.com/api/v2/
AUTH0_DOMAIN=auth.languagetechnology.org
CALLBACK_URL=http://id.languagetechnology.org/callback
NOREPLY_EMAIL=noreply@example.com
NOREPLY_PASSWORD=secret
ROOT_AGENT=root@example.com
SERVER_DOMAIN=https://id.languagetechnology.org
AUTH0_M2M_DOMAIN=silid.us.auth0.com
AUTH0_M2M_CLIENT_ID=some-id
AUTH0_M2M_CLIENT_SECRET=some-secret
```

Install dependencies:

```
npm install --production
```

### Docker

Edit `docker-compose.staging.yml` to point to the correct domain:

```
# ...
    environment:
      - VIRTUAL_HOST=id.languagetechnology.org
      - LETSENCRYPT_HOST=id.languagetechnology.org
      - LETSENCRYPT_EMAIL=daniel@example.com
# ...
```

In `./src`

```
docker-compose -f docker-compose.staging.yml up -d
```

### Database

In `./src/silid-server/`:

#### Migrations

```
docker-compose -f docker-compose.staging.yml exec app npx sequelize-cli db:migrate
```

#### Sync

Careful, you will lose all your data if you sync the database:

```
docker-compose -f docker-compose.staging.yml exec app node config/seed.js
```

# Development and Production Deployments

## Crowdin

For the moment, this is managed with the Crowdin [CLI](https://support.crowdin.com/cli-tool/), which was installed globally: `npm i -g @crowdin/cli`.

The CLI requires a token, which can be obtained from: https://crowdin.com/settings#api-key and configured in `crowdin.yml`.

```
cp crowdin.yml.example crowdin.yml
```

Send files to be translated:

```
crowdin upload sources
```

Download translated files:

```
crowdin download
```

## Auth0

### Role/Permissions Configuration

At the moment, a `viewer` role with the permissions listed below must be configured for the `silid-sever` machine-to-machine application at Auth0:

- read:agents
- read:teams
- update:agents

The role and the permissions defined therein are subject to change without notice. These may eventually be eliminated entirely.

### API

From the `silid-server` API settings:

- Enable RBAC
- Add Permissions in the Access Token

### Tenant-Level Logout

Single-Sign-Out depends upon correctly configuring the tenant-level logout URL (cf., _Third-Party Integration_ below).

https://auth0.com/docs/logout#set-the-allowed-logout-urls-at-the-tenant-level

Include this application's `/cheerio` route in the list of _Allowed Logout URLs_.

### Third-Party Integration

In order for Single-Sign-Out to work, all third-party applications require a `/logout` endpoint that clears the application session and calls Auth0's `/logout` endpoint with the application's `client_id` request parameter. The `returnTo` request parameter _must not_ be included so that the Auth0 server returns the agent to the first tenant-level _Allowed Logout URL_ set in the Dashboard.

More information here: https://auth0.com/docs/api/authentication#logout

# Extras

## Staging Setup

Staging assumes Nginx proxy containers and network setup with SSL.  One option
is to follow these instructions:

https://github.com/nginx-proxy/docker-letsencrypt-nginx-proxy-companion

You will also need to create a proxy network:

```
$ docker network create nginx-proxy
```

Now edit the docker container run configurations from the link above to connect
the containers to the proxy network.  Example:

```
# Step 1 - nginx-proxy
$ docker run --detach \
    --name nginx-proxy \
    --publish 80:80 \
    --publish 443:443 \
    --volume /etc/nginx/certs \
    --volume /etc/nginx/vhost.d \
    --volume /usr/share/nginx/html \
    --volume /var/run/docker.sock:/tmp/docker.sock:ro \
    --network nginx-proxy \
    jwilder/nginx-proxy

# Step 2 - letsencrypt-nginx-proxy-companion
$ docker run --detach \
    --name nginx-proxy-letsencrypt \
    --volumes-from nginx-proxy \
    --volume /var/run/docker.sock:/var/run/docker.sock:ro \
    --env "DEFAULT_EMAIL=mail@yourdomain.tld" \
    --network nginx-proxy \
    jrcs/letsencrypt-nginx-proxy-companion
```

_Note: In the above link, the "Step 3" docker container is an example container
to see if things work, which is otherwise not needed for this setup._

## AWS Prod Topology

### AWS RDS

The UI for RDS can be found at the [Amazon dashboard](https://928745222303.signin.aws.amazon.com/console) and directly at the [RDS service.](https://console.aws.amazon.com/rds/home?region=us-east-1#databases:)

Two RDS databases are being used for silid are manually created and and can be
seen in the AWS us-east-1 (Virginia region) console listed as silid-dev and silid-prod.

In the event of a database outage or loss, the database can be restored by [restoring a snapshot of the database instance](https://console.aws.amazon.com/rds/home?region=us-east-1#database:id=ss1fejs6cgbasrw;is-cluster=false;tab=maintenance-and-backups) or recreated entirely [here](https://console.aws.amazon.com/rds/home?region=us-east-1#launch-dbinstance:gdb=false;s3-import=false).

## Auth0 IdP Connection Sync

From the documentation: https://auth0.com/docs/users/configure-connection-sync-with-auth0

> To be able to edit the name, nickname, given_name, family_name, or picture root attributes on the normalized user profile, you must configure your connection sync with Auth0 so that user attributes will be updated from the identity provider only on user profile creation.

#### Turn off sync

1. Go to Dashboard > Connections and select a connection type.

2. Click the name of a connection to see its settings.

2. Toggle Sync user profile attributes at each login to the _off_ position and click _Save_.

### AWS SES

For the development_aws and production environments (silid-dev, silid), email is dependent on the [Amazon Simple Email Service](https://console.aws.amazon.com/ses/home?region=us-east-1#verified-sender-details:domain:languagetechnology.org) (SES). A config file named `aws.json` is required in the `config` directory of `silid-server` with SES credentials. This is currently being created by a step in the build process handled by TeamCity (see Add AWS aws.json file).

We are using [this](https://console.aws.amazon.com/iam/home?region=us-east-1#/users/ses-smtp-user.20200304-155331) smtp account for ses. It is providing the noreply@languagetechnology.org sending service for the verification process of silid.

### AWS Troubleshooting

Since silid is running across distributed services in AWS, there are a number of places to check in case of application errors or failures.

A good place to start is by running tests against the AWS RDS development database which silid-dev.languagetechnology.org is pointing towards by running the tests locally:

```
npm test
```

If the tests return failures, it is possible the data model needs to be updated in the database. This can be done by running:

```
sequelize db:migrate
```

However, it may be required to 'reset' the database models in order for data model to be updated/migrated correctly. The current solution for this is to manually connect to the postgres database and drop the tables manually.
