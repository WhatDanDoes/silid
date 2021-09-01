Identity's Implementation of the Authorization Code Flow
========================================================

The subject of _mental models_ was raised during the SIL global staff meeting on January 26, 2021. SIL leadership invited input on how we explain real-world phenomenon collectively and as individuals. _Which mental models are good and worth preserving? Which mental models are bad and should be abandoned?_ May God allow each of us the discernment required.

SIL Identity is where mental models collide (not really, but it may seem so at first). It consists of three main components:

- The _backend_ [silid-server](https://github.com/sillsdev/silid/tree/master/src/silid-server)
- [identity-react](https://github.com/sillsdev/silid/tree/master/src/identity-react) on the _frontend_
- The [Auth0](https://auth0.com/) authentication/access-management platform

Identity was born of a fairly typical marriage between [Express](https://expressjs.com/), React bootstrapped with [create-react-app](https://github.com/facebook/create-react-app), and [PostgreSQL](https://www.postgresql.org/) backed by the [Sequelize ORM](https://sequelize.org/).

![Core software](figures/core-software.svg)

Apart from the intricacies of `create-react-app`, these were all technologies with which I was familiar and reasonably _on trend_. I think `create-react-app` imposes a good mental model of how a React project should be organized. It even enforces this model to a degree by constraining development around a build tool with preset configurations. If you are not satisified with how `create-react-app` manages your project, you have the option to [eject](https://create-react-app.dev/docs/available-scripts/) yourself free from those pre-baked constraints.

### `silid-server`

The Identity application leverages the [Auth0](https://auth0.com/) authentication/access-management platform. Though I was vaguely familiar with OAuth in general, I had no prior knowledge of this third-party service. My appreciation quickly grew as I reverse-engineered its [Authorization Code Flow](https://auth0.com/docs/flows/authorization-code-flow) interactions with my tried-and-true favourite test tools: [Jasmine](https://jasmine.github.io/), [SuperTest](https://www.npmjs.com/package/supertest), [Nock](https://github.com/nock/nock), and others.

![Server-side test tools](figures/server-test-tools.svg)

The tests above, of course, can only be applied to the server-side of the Identity application (i.e., `silid-server`). If measured on a scale of _difficulty_, server-side testing typically falls on the _easy_ end of the spectrum. But Identity has three sides _(at least)_...

### `identity-react`

Testing `identity-react`, which was bootstrapped with `create-react-app`, necessitated the introduction of an independent [mock server](https://github.com/sillsdev/silid/blob/master/src/silid-server/spec/support/mockAuth0ServerWithRBAC.js) to occupy the _authentication side_ in place of Auth0. The mock server was built with [Hapi](https://hapi.dev/). You'd think that this by itself would be tricky enough, but no. The _mental model_ constraints enforced by `create-react-app` raised issues so horribly mundane that we all must pray that I never be allowed to expound upon them at great length.

The constraints imposed by `create-react-app`'s strict mental model necessitated a testing topology that closely mirrors the Identity application as it is deployed in _real life_. This software arrangement is proven with tests executed by [Cypress](https://www.cypress.io/). The client-side component of Identity is a seperate application, afterall. As such, it was expedient to build upon a set of integration tests seperate from its server-side component.

![End-to-end test tools](figures/e2e-test-tools.svg)

Looking back, I'm glad that ejecting the app wasn't an option. I once had a seminary professor - a favourite among favourites - who said to me, _constraints breed innovation_. And although he probably stole the line, it's no less true.

# Identity and Auth0's Authorization Code Flow

I'll return to mock servers and test configurations in a moment, but first let's first examine the all-too-critical authentication interaction between real-life `silid-server`, `identity-react`, and the Auth0 service. The following illustrates how all three sides work together:

## 1. A human agent sends an HTTP request through his browser client to the Identity _backend_, hereafter known as `silid-server`.

![GET /](figures/00-get-slash.svg)

## 2. `silid-server` includes the requested home page in its response.

![200](figures/01-homepage-response.svg)

## 3. The human agent presses the _Login_ button on the browser client.

![GET /login](figures/02-get-login.svg)

## 4. `silid-server` responds with a redirect to the configured Auth0 authentication page (not exactly as shown).

![302 /login](figures/03-login-response.svg)

## 5. The browser client requests the Auth0 authentication page.

![GET sil.auth0.com/login](figures/04-get-auth0-login.svg)

## 6. Auth0 responds and the browser client loads the authentication page provided.

![200](figures/05-auth0-login-response.svg)

## 7. The human agent takes action to confirm his identity and submits the appropriate request to Auth0.

![POST sil.auth0.com/...](figures/06-post-auth0-credentials.svg)

## 8. Having verified the credentials provided, Auth0 responds with a callback URL redirecting the browser client back to `silid-server`.

![302 /callback?auth_code=abc1234](figures/07-auth0-success-response.svg)

## 9. The browser client requests the provided callback URL from `silid-server`.

![GET /callback?auth_code=abc1234](figures/08-get-callback.svg)

## 10. `silid-server` takes the _authorization code_ set in the callback URL's query string and submits a request for an _access token_ from Auth0. This request is accompanied by `silid-server`'s registered client and secret IDs.

![POST sil.auth0.com/oauth/token](figures/09-post-oauth-token.svg)

## 11. Assuming all credentials are in order, Auth0 responds to `silid-server`'s request with an _access token_.

![200](figures/10-auth0-token-response.svg)

## 12. `silid-server` requests the human agent's information from Auth0.

![GET sil.auth0.com/userinfo](figures/11-get-userinfo.svg)

## 13. Auth0 responds with the human agent's information. Upon receipt, `silid-server` starts a _session_ and ties all the agent's profile data to a unique _session ID_.

![200](figures/12-auth0-userinfo-response.svg)

## 14. `silid-server` then responds to the browser client with a redirect and a _cookie_, which holds the browser client's unique session ID.

![302 /](figures/13-redirect-with-cookie.svg)

## 15. The browser client receives the redirect, saves the cookie, and requests the page to which it was redirected.

![GET /](figures/14-get-slash-with-cookie.svg)

## 16. `silid-server` receives the browser's request, matches the cookie to the session ID, and knows that the human agent operating the browser has been authenticated. It responds with the bundled `identity-react` application.

![200](figures/15-react-app-response.svg)


From this point, every request initiated by `identity-react` contains a cookie that points to a `silid-server` session ID. This session ID is only meaningful to `silid-server`. For so long as the session is valid (it automatically expires after an hour if not kept fresh), `silid-server` will respond to `identity-react`'s requests as determined by the human agent's prescribed level of access. Though `identity-react` is its own application, it can only talk to `silid-server`. It _cannot_ talk to Auth0. All Identity-Auth0 interaction originates from `silid-server`.

![No SPA Auth0 access](figures/16-no-spa-access.svg)

## Summary of Interactions

Here, the Authorization Code Flow is used to establish a traditional browser session so that `silid-server` allows the authenticated human-agent access to `identity-react`, which is executed in the browser. For some, especially those used to the _Implicit_ OAuth flow, this is where _mental models collide_. Single page applications like `identity-react` often require storing potentially sensitive information in the browser client.

# Advantages

Implementing the Authorization Code Flow as described here reveals some immediate and obvious benefits:

- No information relevant to Auth0 is ever provided or stored in the browser client
- Cross-Site Request Forgery concerns are entirely mitigated, because `identity-react` can only talk to `silid-server`
- Front-end, Single-Page App developers need not concern themselves with matters of authentication. This responsibility is left to the server with which the browser client is paired.
- There is an impenetrable and rigorously structured barrier between the human agent and sensitive data protected by Auth0 itself. Identity-Auth0 operations are constrained to those defined in `silid-server`.

# Development arrangements

Proof of this interaction and its viability is demonstrated and documented in the development environments and their respective arrangements. The tests that pertain to Identity's Authorization Code Flow implementation are linked below.

## `silid-server`

This authentication interaction is documented and tested server-side [here](https://github.com/sillsdev/silid/blob/article/mental-models/src/silid-server/spec/api/authSpec.js). Recall the server-side test tools named above:

![Server-side test tools](figures/server-test-tools.svg)

The tests in the linked file (and most others here) _kinda sorta_ look like this:

![Server-side test arrangement](figures/server-test-arrangement.svg)

There is one notable exception to this arrangement. It is found in the `Browser` block of the [same test spec file](https://github.com/sillsdev/silid/blob/article/mental-models/src/silid-server/spec/api/authSpec.js#L653). It is here that you find the test to load the static frontend React app. For this (and the others) I used another favourite tool: [ZombieJS](http://zombie.js.org/):

![Server-side Zombie test arrangement](figures/server-zombie-test-arrangement.svg) 

## `identity-react`

The _wholistic_ end-to-end tests are managed alongside [`identity-react`](https://github.com/sillsdev/silid/tree/article/mental-models/src/identity-react/cypress). This is a much more true-to-form representation of an actual Identity deployment. These are the tools used to test that arrangement:

![End-to-end test tools](figures/e2e-test-tools.svg)

Compare the real-life authentication interaction with the E2E test arrangement:

![End-to-end test arrangement](figures/e2e-test-arrangement.svg)

Apart from the automated test runner and [the mock Auth0 server](https://github.com/sillsdev/silid/blob/article/mental-models/src/silid-server/spec/support/mockAuth0ServerWithRBAC.js), the `create-react-app` build server is not part of a production deployment. `identity-react` is pre-built and served as a static file from `silid-server` itself.

The behavioural authentication tests are documented [here](https://github.com/sillsdev/silid/blob/article/mental-models/src/identity-react/cypress/integration/viewer/authenticationSpec.js). As stated among the advantages of this software arrangement, strict SPA developers need not necessarily concern themselves with authentication. If there is concern, it would be within this context that a test to manage locally stored tokens would be written (for example).

# God's peace,

## Dan
