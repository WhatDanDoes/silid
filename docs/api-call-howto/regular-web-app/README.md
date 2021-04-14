Calling the Identity API with a Regular Web Application
=======================================================

This _regular_ demonstration application obtains an _access token_ via the Auth0-provided _Universal Login_. It is then submitted in an `Authorization` header to Identity. Upon receipt, Identity verifies the token with Auth0. If the token is legit, Identity fulfills the original request with the authorized agent's full Auth0 profile.

This documentation and the accompanying demo app is a direct plagiarization of [Auth0's own documentation](https://auth0.com/docs/microsites/call-api/call-api-regular-web-app). The code was bootstrapped on 2021-4-9.

## In general...

The bootstrapped code was customized in only one significant way. This change is not unique to Identity. You would call upon any Auth0-supported API in the same way.

Upon authentication, the agent is provided a simple interface to access the app's _Home_ and _Profile_ pages. There is a also a _Logout_ link. The heart of this demonstration lays within the `GET /profile` route.

When you click on the _Profile_ link, the demo app sends a request to Identity. It asks to provide the data that only Identity can provide. Most significantly, the data contained in `user_metadata`. Refer to `routes/index.js`:

```
router.get('/profile', async (req, res) => {
  let { token_type, access_token } = req.oidc.accessToken;
  fetch(`${process.env.IDENTITY_ENDPOINT}/agent`, {
      method: 'get',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `${token_type} ${access_token}`
      },
    })
    .then(res => res.json())
    .then(json => {
      res.render('profile', {
        userProfile: JSON.stringify(json, null, 2),
        title: 'Profile page'
      });
    });
});
```

The configuration of interest for this and any request made to Identity is the `Authorization` header. Upon authentication, the client is provided an access token consisting of a _type_ and a JWT-encoded string. The type in this case is `Bearer`. The Identity app verifies the JWT token against the Auth0 `GET /userinfo` endpoint. If the token is valid, Identity fulfills the request. If not, an error is returned.


# Express OpenID Connect sample

The folowing is adapted from the original `README.md` included with the Auth0 sample project.

See a detailed walk-through of this app on the [Express Quickstart](https://auth0.com/docs/quickstart/webapp/express).

## Running the Sample

Install the dependencies with `npm`:

```
npm install
```

Rename `.env.example` to `.env` and replace the following values:

- `CLIENT_ID` - your Auth0 application client ID
- `ISSUER_BASE_URL` - absolute URL to your Auth0 application domain (ie: `https://silid.auth0.com`)
- `SECRET` - your Auth0 application client secret
- `IDENTITY_URL` - absolute URL to the Identity application domain (ie: `https://id.languagetechnology.org`)
- `AUDIENCE` - API audience (ie: `https://id.languagetechnology.org/`)
- `BASE_URL` - absolute URL to the demo application domain. For production. Leave unset if in local development

```
mv .env.example .env
```

Run the app:

```
npm start
```

The app will be served at `localhost:3000`.

## Production

This is meant to be executed behind an `nginx-proxy`/`lets-encrypt` combo:

```
docker-compose up
```
