silid
=====

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
npm install
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
```

Install dependencies:

```
npm install
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

```
docker-compose -f docker-compose.staging.yml exec app node config/seed.js
```
