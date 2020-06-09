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
docker run --name dev-postgres -p 5432:5432 -e POSTGRES_PASSWORD=pass -d postgres
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
AUTH0_CLIENT_SECRET=YoPBzOtKvlNUBME_ZPUuJwh8zTipDp5IFRZNMx1IO7H8Lzk10qNYnEeCBKpoQCr_
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

## Auth0

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

## Deploy to Development (silid-dev.languagetechnology.org)

Deployment is automated from an approved pull request by team members into the develop branch. Once the merge has been completed, the CI/CD
build process injects the environment variables required by silid into the Docker container and ships them with the app onto ECS infrastructure.

Login to TeamCity.

In _Silid > Develop_ project.

### _Parameters_ > \_Environment Variables (.env)

Set _all_ `.env` variables - for both the client and the server - in this section.

### _Edit Build Configuration_ > _Version Control Settings_

As prescribed by fields

### _Edit Build Configuration_ > _Build Steps_

#### Set variables

Runner type: _Command Line_
Step name: _Set variables_
Execute steps: _If all previous steps finished successfully_
Working directory: `src/silid-server`
Run: _Custom script_
Custom script: `printenv > .env`

#### ECR Login

Runner type: _Node.js NPM_
Step name: _ECR Login_
Execute steps: _If all previous steps finished successfully_
npm commands: `run ecr:login`
Working Directory: `src/silid-server`

#### Docker Build

Runner type: _Command Line_
Step name: _Docker Build_
Execute steps: _If all previous steps finished successfully_
Working Directory: `src`
Run: _Custom script_
Custom script: `docker build --build-arg environment=development_aws -t sild-server .`

#### Docker Tag

Runner type: _Node.js NPM_
Step name: _Docker Tag_
Execute steps: _If all previous steps finished successfully_
npm commands: `run docker:tag-dev`
Working Directory: `src/silid-server`

#### Docker Deploy

Runner type: _Node.js NPM_
Step name: _Docker Deploy_
Execute steps: _If all previous steps finished successfully_
npm commands: `run docker:deploy-dev`
Working Directory: `src/silid-server`

#### Register ECS

Runner type: _Node.js NPM_
Step name: _Register ECS_
Execute steps: _If all previous steps finished successfully_
npm commands: `run ecs:register-task-dev`
Working Directory: `src/silid-server`

#### Update Service Task

Runner type: _Node.js NPM_
Step name: _Update Service Task_
Execute steps: _If all previous steps finished successfully_
npm commands: `run ecs:update-service-dev Working Directory:`src/silid-server`

### _Edit Build Configuration_ > _Triggers_

- Trigger: _VCS Trigger_
- Parameters Descripture: _Branch filter:_ `+:*`

### _Edit Build Configuration_ > _Agent Requirements_

#### Explicit Requirements

- Parameters Name: _awsDeploy_
- Condition: _equals true_

#### Build Steps Requirements

- Parameters Name: _node.js.npm_
- Condition: _exists_

#### Agents Compatability

Compatible agents:

Default pool: `ba-aws-bionic64-2`

## Deploy to Production (silid.languagetechnology.org)

Deployment is automated from an approved pull request by team members into the master branch. Once the merge has been completed, the CI/CD
build process injects the environment variables required by silid into the Docker container and ships them with the app onto ECS infrastructure. The steps for this build are listed below in detail.

Login to TeamCity.

In the Silid > Production project build configuration:

#### Set variables

Runner type: Command Line

Working directory: `src/silid-server`

Custom script:

```
printenv > .env
```

#### Add AWS aws.json file

Runner type: Command Line

Working directory: `src/silid-server/config`

Custom script:

```
echo '{"accessKeyId": "key","secretAccessKey":"secret","region": "region","signatureVersion": "v4"}' > aws.json
```

#### ECR Login

Runner type: Node.js NPM

Working directory: `src/silid-server`

npm command:

```
run ecr:login
```

#### Docker Build

Runner type: Command Line

Working directory: `src`

Custom script:

```
docker build --build-arg environment=production -t sild-server .
```

#### Docker Tag

Runner type: Node.js NPM

Working directory: `src/silid-server`

npm command:

```
run docker:tag-prod
```

#### Docker Deploy

Runner type: Node.js NPM

Working directory: `src/silid-server`

npm command:

```
run docker:deploy-prod
```

#### Register ECS Task

Runner type: Node.js NPM

Working directory: `src/silid-server`

npm command:

```
 run ecs:register-task-prod
```

#### Update Service Task

Runner type: Node.js NPM

Working directory: `src/silid-server`

npm command:

```
run ecs:update-service-prod
```

Note: The build steps scripts are referencing aws-cli scripts which are available in the `package.json` file in the `silid-server` directory. Manual deployment by developers is also possible running these scripts directory.

## Database

Silid is utilizing Postgres and Sequelizer as an ORM. The database is running locally in a Postgres docker container via docker-compose for local environments and in AWS RDS for silid.languagetechnology.org and silid-dev.languagetechnology.org.

Migrations to these databases can be run by utilizing [sequelizer-cli](https://www.npmjs.com/package/sequelize-cli) and running the following command in the `src/silid-server/` directory:

```
sequelize db:migrate
```

The migrator tool will then look for migrations (located in the `src/silid-server/migrations/` folder) that need to be run against the configured database.

Sequelizer-cli will determine the enviroment by looking at the NODE_ENV environment variable set locally, f.e. if the environment is set to test as shown below, it will look for the environment test.

```
export NODE_ENV=test
```

So in order to connect to silid-dev.languagetechnology.org (development_aws database) the NODE_ENV environment variable will need to be set to development_aws like so:

```
export NODE_ENV=development_aws
```

This can be set in the `.env` file alongside the rest of the environment variables for silid.

## AWS RDS

The UI for RDS can be found at the [Amazon dashboard](https://928745222303.signin.aws.amazon.com/console) and directly at the [RDS service.](https://console.aws.amazon.com/rds/home?region=us-east-1#databases:)

Two RDS databases are being used for silid and can be seen in the AWS console listed as `ss1e8pfmqwgebvu` for silid-dev.languagetechnology.org and `ss1fejs6cgbasrw` for silid.languagetechnology.org. These databases were created manually through the AWS dashboard and set to `db.t3.micro` instance type. Daily backups are being taken and handled throughout the RDS service.

In the event of a database outage or loss, the database can be restored by [restoring a snapshot of the database instance](https://console.aws.amazon.com/rds/home?region=us-east-1#database:id=ss1fejs6cgbasrw;is-cluster=false;tab=maintenance-and-backups) or recreated entirely [here](https://console.aws.amazon.com/rds/home?region=us-east-1#launch-dbinstance:gdb=false;s3-import=false).

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
