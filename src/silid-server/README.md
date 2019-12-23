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

## Dev server

```
docker-compose up
```

