# silid

`silid` is comprised of two parts:

1. A client-side app bootstrapped with [Create React App](https://github.com/facebook/create-react-app).
2. A server app produced with `express-generator`. It is backed by a `sequelize`/`postgres` pairing.

The following describes how to deploy the application to your local development environment and execute tests. These steps are carried out in Ubuntu 18.04 with the latest system upgrades. At the time of writing, the main system dependencies and their versions include:

- Node v10.20.1
- NPM v6.14.5
- Docker version 19.03.8, build afacb8b7f0
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

`silid-server` has tests of its own, apart from the client-driven end-to-end tests. These tests require a PostgreSQL development server. Start one with `docker`:

```
docker run --name dev-postgres -p 5432:5432 -e POSTGRES_PASSWORD=pass -e POSTGRES_USER=user -d postgres
```

Once the image is running, execute the server-specific tests from the `src/silid-server` directory like this:

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

As with the `silid-server`, the configurations in `.env.example` are sufficient for testing purposes:

```
cp .env.example .env
```

### End-to-end tests

As with any web application, this project is comprised of many moving parts. The most obvious include:

1. The `identity-react` client-side application served up by the `create-react-app` build server
2. The `silid-server` `express` application
3. The Auth0 mock server with which the `silid-server` interacts

The `silid-server` and Auth0 mock server are bundled together in a Docker composition for convenience. These containers are executed apart from the React build server and the Cypress test framework is executed apart from that. To set up the project for testing, it is convenient to execute each component in a seperate shell.

### Client build server

If you've already installed the client's dependencies, you'll likely already be in the correct directory. If not, navigate to the `src/identity-react` directory and start the build server:

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

### Client

In `./src/identity-react/`, configure `.env`:

```
REACT_APP_DOMAIN=silid.auth0.com
REACT_APP_CLIENT_ID=tjrl8aOQEx9AtQhFffuWmvP6bcHM7nXB
REACT_APP_CALLBACK_URL=https://example.com/callback
```

Install dependencies:

```
npm install --production
```

### Server

In `./src/silid-server/`, configure `.env`:

```
AUTH0_DOMAIN=silid.auth0.com
AUTH0_AUDIENCE=https://id.languagetechnology.org/
NOREPLY_EMAIL=noreply@example.com
NOREPLY_PASSWORD=secret
AUTH0_CLIENT_ID=KdUmLO7eZSAgY1AXEdryBkPth8jKSryz
AUTH0_CLIENT_SECRET=secret
CALLBACK_URL=https://id.whatdandoes.info/callback
SERVER_DOMAIN=https://id.whatdandoes.info
ROOT_AGENT=dan.bidulock@wycliffe.ca
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

## Auth0 Role/Permissions Configuration

At the moment, a `viewer` role with the permissions listed below must be configured for the `silid-sever` machine-to-machine application at Auth0:

- create:team-member
- create:teams
- delete:team-member
- delete:teams
- read:agents
- read:organizations
- read:teams
- update:agents
- update:teams

The role and the permissions defined therein are subject to change without notice. These may eventually be eliminated entirely.

# AWS Prod Topology

## AWS RDS

The UI for RDS can be found at the [Amazon dashboard](https://928745222303.signin.aws.amazon.com/console) and directly at the [RDS service.](https://console.aws.amazon.com/rds/home?region=us-east-1#databases:)

Two RDS databases are being used for silid and can be seen in the AWS console listed as `ss1e8pfmqwgebvu` for silid-dev.languagetechnology.org and `ss1fejs6cgbasrw` for silid.languagetechnology.org. These databases were created manually through the AWS dashboard and set to `db.t3.micro` instance type. Daily backups are being taken and handled throughout the RDS service.

In the event of a database outage or loss, the database can be restored by [restoring a snapshot of the database instance](https://console.aws.amazon.com/rds/home?region=us-east-1#database:id=ss1fejs6cgbasrw;is-cluster=false;tab=maintenance-and-backups) or recreated entirely [here](https://console.aws.amazon.com/rds/home?region=us-east-1#launch-dbinstance:gdb=false;s3-import=false).

## Auth0 IdP Connection Sync

From the documentation: https://auth0.com/docs/users/configure-connection-sync-with-auth0

> To be able to edit the name, nickname, given_name, family_name, or picture root attributes on the normalized user profile, you must configure your connection sync with Auth0 so that user attributes will be updated from the identity provider only on user profile creation.

### Turn off sync

1. Go to Dashboard > Connections and select a connection type.

2. Click the name of a connection to see its settings.

2. Toggle Sync user profile attributes at each login to the _off_ position and click _Save_.

## AWS SES

For the development_aws and production environments (silid-dev, silid), email is dependent on the [Amazon Simple Email Service](https://console.aws.amazon.com/ses/home?region=us-east-1#verified-sender-details:domain:languagetechnology.org) (SES). A config file named `aws.json` is required in the `config` directory of `silid-server` with SES credentials. This is currently being created by a step in the build process handled by TeamCity (see Add AWS aws.json file).

We are using [this](https://console.aws.amazon.com/iam/home?region=us-east-1#/users/ses-smtp-user.20200304-155331) smtp account for ses. It is providing the noreply@languagetechnology.org sending service for the verification process of silid.

## Troubleshooting

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
