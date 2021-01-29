The subject of _mental models_ was raised during the SIL global staff meeting on January 26, 2021. SIL leadership invited input on how we explain real-world phenomenon collectively and as individuals. Which mental models are good and worth preserving? Which mental models are bad and should be abandoned? May God allow us all discernment in this capacity.

SIL Identity is where mental models collide. It was born of a marriage that might not seem unusual at first: [Express](https://expressjs.com/), React bootstrapped with [create-react-app](https://github.com/facebook/create-react-app), and [PostgreSQL](https://www.postgresql.org/) backed by the [Sequelize ORM](https://sequelize.org/).

![Core software](figures/core-software.svg)

Apart from the intricacies of `create-react-app`, these were all technologies with which I was familiar and reasonbly _on trend_. I think `create-react-app` imposes a good mental model of how a React project should be organized. It even enforces this model to a degree by constraining development around a build tool preset configurations. If you are not satisified with how how `create-react-app` manages your project, you have the option to [eject](https://create-react-app.dev/docs/available-scripts/) yourself free from those pre-baked constraints.

The Identity application leverages the [Auth0](https://auth0.com/) authentication/access-management platform. Though I was vaguely familiar with OAuth in general, I had no prior knowledge of this third-party service. My appreciation quickly grew as I reverse-engineered its [Authorization Code Flow](https://auth0.com/docs/flows/authorization-code-flow) interactions with my tried-and-true favourite test tools, [Jasmine](https://jasmine.github.io/), [ZombieJS](http://zombie.js.org/), [Nock](https://github.com/nock/nock), and many more.

![Server-side test tools](figures/server-test-tools.svg)

These tests, of course, can only be applied to the [server side](https://github.com/sillsdev/silid/tree/master/src/silid-server) of the Identity application. If measured on a scale of _difficulty_, server-side testing typically falls on the _easy_ end of the spectrum. But Identity has three sides _(at least)_. Testing the [client side](https://github.com/sillsdev/silid/tree/master/src/identity-react) software bootstrapped by `create-react-app` necessitated the introduction of an independent [mock server](https://github.com/sillsdev/silid/blob/master/src/silid-server/spec/support/mockAuth0ServerWithRBAC.js) to occupy the _authentication side_ in place of Auth0. The mock server was built with [Hapi](https://hapi.dev/). You'd think that this by itself would be tricky enough, but no. The _mental model_ constraints enforced by `create-react-app` raised issues so horribly mundane that we all must pray that I never be allowed to expound upon them at great length.

Looking back, I'm glad that ejecting the app wasn't an option. I once had a seminary professor - a favourite among favourites - who said to me, _constraints breed innovation_. And although he probably stole the line, it's no less true. The constraints imposed by `create-react-app`'s strict mental model necessitated a testing topology that closely mirrors the Identity application as deployed in _real life_. This software arrangment is proven with tests executed by [Cypress](https://www.cypress.io/). The client-side component of Identity is a seperate application, afterall. As such, it requires a set of integration tests seperate from its server-side component.

![End-to-end test tools](figures/e2e-test-tools.svg)

# Identity and Auth0's Authorization Code Flow 

Let's first examine the critical authentication interaction between real-life Identity and the Auth0 service.

## 1. A human agent sends an HTTP request to through his browser client to the Identity _backend_, hereafter known as `silid-server`.

![GET /](figures/00-get-slash.svg)

## 2. `silid-server` includes the requested home page in its response.

![200](figures/01-homepage-response.svg)

## 3. The human agent presses the _Login_ button on the browser client.

![GET /login](figures/02-get-login.svg)

## 4. `silid-server` responds with a redirect to the configured Auth0 authentication page.

![302 /login](figures/03-login-response.svg)

## 5. The browser client requests the Auth0 authentication page.

![GET sil.auth0.com/login](figures/04-get-auth0-login.svg)

## 6. Auth0 responds and the browser client loads the authentication page provided.

![200](figures/05-auth0-login-response.svg)

## 7. The human agent takes action to confirm his identity and submits the appropriate request to Auth0.

![POST sil.auth0.com/...](figures/06-post-auth0-credentials.svg)

## 8. Having verified the credentials provided, Auth0 responds with a redirect, or callback URL directing the browser client back to `silid-server`.

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

## 15. The browser client receives the redirect, saves the cookie.


15. The browser client requests the page to which it was redirected. The cookie goes along for the ride. This redirect goes back to `silid-server`.

16. `silid-server` receives the browser's request, matches the cookie to the session ID, and knows that this browser has been authenticated. It responds with the bundled `identity-react` application.
17. The browser client receives the response and executes `identity-react`.

From this point, every request initiated by `identity-react` contains a cookie that points to a `silid-server` session ID. This session ID is only meaningful to `silid-server`. For so long as the session is valid (it automatically expires after an hour if not kept fresh), `silid-server` will respond to `identity-react`'s requests as dictaed by the human agent's prescribed level of access. Though `identity-react` is its own application, it can only talk to `silid-server`. It _cannot_ talk to Auth0. All Identity-Auth0 interaction originate from `silid-server`.

Here, the Authorization Code Flow is used to establish a traditional browser session so that `silid-server` allows the authenticated human-agent access to `identity-react`, which is executed in the browser. For some, especially those used to the _Implicit_ OAuth flow, this is where _mental models collide_. Single page applications like `identity-react` often require storing potentially sensitive information in the host browser.

Using the Authorization Code Flow as prescribed her reveals some immediate and obvious benefits:

- No information relevant to Auth0 is ever provided or stored in the browser client
- Cross-Site Request Forgery concerns are entirely mitigated, because `identity-react` can only talk to `silid-server`
- Front-end, Single-Page App developers need not concern themselves with matters of authentication. This responsibility is left to the server with which the browser client is paired.
- There is an impenetrable and rigorously structured barrier between the human agent and sensitive data protected by Auth0 itself. Identity-Auth0 operations are constrained to those defined server side.


# Development arrangements


## Identity server

## Identity client



The benefits of a true-to-form testing configuration reveal themselves immediately when addressing questions from security-minded folk that typically take the form _Well, what if some nefarious hacker did _this_ or _that_?_ Such a topology empowers the concerned party to write a test, see what happens, and submit a pull request when the hole has been filled.




