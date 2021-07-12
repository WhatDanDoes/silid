# silid-server

`express-generator`-bootstrapped app to administer agent identity.

## Setup

```
npm install
cp .env.example .env
```

## Test

Start a PostgreSQL development server:

```
docker run --name dev-postgres -p 5432:5432 -e POSTGRES_PASSWORD=pass -e POSTGRES_USER=user -d postgres
```

Execute tests:

```
npm test
```

### e2e

This image is to be paired with front-end behavioural tests:

```
docker-compose -f docker-compose.e2e.yml up
```

A fresh access token is generated each time the image is run. Find it logged to stdout. Perform endpoints tests like this:

```
curl --request GET \
  --url localhost:3001/agent \
  --header 'authorization: Bearer [access_token]'
```

If you want to poke around in the test database, connect like this:

```
psql -h localhost -d postgres -U user -W
```

## Dev server

Start maildev:

```
docker run -d --name maildev -p 1080:80 -p 25:25 -p 587:587 djfarrelly/maildev
```

Build Docker images:

```
docker-compose up
```

### Database

Setup and management.

#### Migrations

For an orderly database deployment. Should preserve data.

```
docker-compose exec app npx sequelize-cli db:create
docker-compose exec app npx sequelize-cli db:migrate
```

For info on `sequelize` management, refer to https://sequelize.org/master/manual/migrations.html
