identity-react
==============

`create-react-app`-bootstrapped application to administer agent identity within a dynamic organizational structure.


## Setup

```
cp .env.example .env
npm install
```

## Dev server

```
npm start
```

## Test

For the moment, the dev server needs to be running (as above: `npm start`). Execute `cypress` tests:

```
npx cypress run
```

### Headless

Even if running `cypress` headlessly, you still need help from `X11`. Rather than tainting the host system with weird rendering dependencies, this is how you can use `docker`:

```
docker run --rm -it -v $PWD:/e2e -w /e2e --network host cypress/included:3.3.1
```

Or, better yet:

```
npm run test:headless
```

Some helpful (but not entirely applicable) info can be found here: https://www.cypress.io/blog/2019/05/02/run-cypress-with-a-single-docker-command/


