silid-server
============

`express-generator`-bootstrapped app to administer agent identity within a dynamic organizational structure.


## Setup

```
npm install
cp .env.example .env
```

## Test

Start a PostgreSQL development server:

```
docker run --name dev-postgres -p 5432:5432 -d postgres
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

```
docker-compose up
```

Seed database:

```
docker-compose exec app node config/seed.js
```

