SIL Single Sign Out
===================

Logging out of an Auth0-configured application involves clearing multiple _session layers_:

1. Application Session Layer
2. Auth0 Session Layer
3. Identity Provider Session Layer

Refer to Auth0 documentation for a [synopsis](https://auth0.com/docs/login/logout) of each layer.

Typically, developers concern themselves with the _Application_ and _Auth0_ session layers. Depending on the type of app (e.g. _regular_ versus _SPA_), clearing these sessions effects a _logout_. I.e., if an agent wants to use the app again, authentication steps must be repeated from the beginning in order to create new sessions.

The third _Identity Provider_ session is that which was created by the IdP itself (e.g., Google, Facebook). By [setting the _federated_ flag](https://auth0.com/docs/login/logout/log-users-out-of-idps) in the Auth0 `/logout` call, this session will be destroyed, thus _de_-authenticating all SIL and peripheral non-SIL apps. This is a powerful feature, [best suited for private, self-provided IdPs](https://auth0.com/docs/architecture-scenarios/b2b/logout#federated-logout).

The ability to deauthenticate all SIL apps at once is desirable, but the federated logout is _heavy handed_. An agent authenticated by Google, for example, will be logged out from applications like Gmail if a federated logout is performed.

Integration with Identity means having another option.

## GET /cheerio

Named as such for no other reason than it's a funny _British-y_ way to say _adiós_. If an SIL app redirects to this endpoint on `/logout`, Identity will make a best effort to call the `/logout` endpoint on every application configured on the same Auth0 tenant.

As such, one thing is required of applications wanting to `GET /cheerio`:

> An application must be able to deauthenticate via its own `GET /logout` route.

What happens in this `/logout` route is up to application developers, but if you want to hit the `/cheerio` endpoint, you'll need to _redirect_ with a formatted query string. The following [Express](https://expressjs.com/) code is typical of that found deployed alongside Identity.

```
// Need to format a query string. Use this or something similar
const querystring = require('querystring');
const util = require('util');
const url = require('url');

/**
 * 2020-3-17 Originally adapted from:
 *
 *   https://github.com/auth0-samples/auth0-nodejs-webapp-sample/blob/master/01-Login/routes/auth.js
 *
 * Recall the three auth session layers described above. This route addresses
 * those with `/cheerio` in place of a full federated logout.
 */
router.get('/logout', (req, res) => {

  /**
   * This is Application Session layer stuff.
   *
   * Let `express` do its session clearing and expire all the cookies sent with
   * the request.
   */
  req.logout();

  let cookies = req.cookies;
  for (var cookie in cookies) {
    res.cookie(cookie, '', {expires: new Date(0)});
  }

  /**
   * Auth0 Session
   *
   * You need to tell Auth0 to do its own session clearing and cookie
   * expirations.
   */
  const logoutURL = new url.URL(
    util.format('https://%s/v2/logout', 'silid.auth0.com');
  );

  /**
   * This is where `/cheerio` steps in...
   *
   * By setting the `returnTo` param on the Auth0 call, this app
   *
   * 1. Will be deauthenticated at Auth0,
   * 2. Redirected to Identity's `/cheerio` (which deauthenticates all known apps), and then
   * 3. Redirected back to your app's homepage.
   *
   * Note: your app's `returnTo` URL must be configured as an _Allowed Logout_
   * on the Auth0 tenant.
   *
   * This is at the heart of how `/cheerio` works. Apps deployed on an Auth0
   * tenant will eventually make a call to Auth0's `/logout` endpoint. All that
   * is required to integrate with Identity in this capacity is a properly
   * formatted `returnTo` param.
   */
  const searchString = querystring.stringify({
    returnTo: 'https://id.languagetechnology.org/cheerio?returnTo=https://your.app'
  });
  logoutURL.search = searchString;

  /**
   * Some more Application Session layer stuff.
   *
   * For express enthusiasts, find info on `req.logout` versus
   * `req.session.destroy` here:
   *
   *   https://stackoverflow.com/a/50473675/1356582
   */
  req.session.destroy(err => {

    /**
     * At this point, the Application Session stuff is complete. This redirect
     * kicks off a chain of single-sign-out redirects. It starts at Auth0
     * and eventually redirects back to the original application.
     */
    res.redirect(logoutURL);
  });
});
```

The sample above demonstrates how an `express`-backed application can implement single-sign-out when deployed alongside Identity. Framework's will vary in form, but the steps remain the same.

## Limitations

The `GET /logout` requests that result from a call to Identity's `/cheerio` cannot be guaranteed. These calls originate from the client software, so they are naturally limited by network availability.

## Features

With Auth0 configurations in mind, `GET /cheerio` is not bound by the number of apps deployed on a tenant. Apart from the `returnTo` config described above, no additional tenant configuration is required.

