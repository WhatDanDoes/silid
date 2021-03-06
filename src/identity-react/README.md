identity-react
==============

`create-react-app`-bootstrapped application to administer agent identity.


## Setup

```
npm install
```

## Dev server

```
npm start
```

## Test

Start `silid-server` in another shell or process:

```
cd ../silid-server && PORT=3001 npm start
```

As above, the dev server needs to be running in another shell or process. From the `identity-react` directory:

```
npm start
```

Execute `cypress` tests:

```
npx cypress open
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


To run a single test file:

```
npm run test:headless -- --spec cypress/integration/viewer/agentIndexSpec.js
```

Note the extra `--`.


