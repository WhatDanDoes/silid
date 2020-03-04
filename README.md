# silid

This client app was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

The server app was produced by `express-generator` and was scrounged from the ruined heap of a now forgotten app with the exact same purpose. It is backed by a `sequelize`/`postgres` pairing.

The following describes how to deploy the combined application to a local development environment and run end-to-end tests.

## Server

From the `src/silid-server` project directory:

```
npm install
cp .env.example .env
```

### Test

The server has tests of its own, apart from the client-driven e2e tests. These tests require a PostgreSQL development server. Start one with `docker`:

```
docker run --name dev-postgres -p 5432:5432 -d postgres
```

Execute server-specific tests:

```
npm test
```

## Client

From the `src/identity-react` project directory:

```
npm install
cp .env.example .env
```

### Client build server

In a new shell, from the `src/identity-react` project directory:

```
npm start
```

### e2e API test server

The client application tests against a local instance of the `silid-server` and a special mock server whose purpose is to return a public key with which to verify an Auth0 access token. These tests _do not_ execute against a live server.

The `silid-server`/mock server combo are containerized. In a separate shell, from the `src/silid-server` project directory, launch the e2e API server:

```
docker-compose -f docker-compose.e2e.yml up --build
```

Sometimes the database doesn't start on time during the first build. If `stdout` suggests this is the case, restart the server.

### Execute e2e tests

End-to-end tests depend on `cypress`. They are executed from the `src/identity-react` project directory. Tests may be executed in your preferred browser, or _headlessly_, as may be appropriate in a staging environment.

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
AUTH0_CLIENT_ID=tjrl8aOQEx9AtQhFffuWmvP6bcHM7nXB
AUTH0_CLIENT_SECRET=some_secret_key
CALLBACK_URL=https://example.com/callback
DATABASE_HOST_DEV=example1.rds.amazonaws.com
DATABASE_USER_DEV=user
DATABASE_PASSWORD_DEV=password
DATABASE_HOST_PROD=example2.rds.amazonaws.com
DATABASE_USER_PROD=user
DATABASE_PASSWORD_PROD=password
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
