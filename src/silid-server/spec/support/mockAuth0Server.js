/**
 * Mock Auth0 server for end-to-end tests.
 *
 * Trick the client and server into thinking they're actually talking to Auth0
 *
 * This server satisifies `authorization_code` server-side session
 * authentication (probably)
 */
require('dotenv-flow').config();

const setupKeystore = require('../support/setupKeystore');
const jwt = require('jsonwebtoken');
const pem = require('pem');
const crypto = require('crypto');


if (process.env.NODE_ENV === 'e2e') {
  const models =  require('../../models');

  models.sequelize.sync({force: true}).then(() => {
    console.log('Database synced');
  }).catch(err => {
    console.error(err);
  });
}

/**
 * 2019-11-13
 * Sample tokens taken from:
 *
 * https://auth0.com/docs/api-auth/tutorials/adoption/api-tokens
 */
const _identity = require('../fixtures/sample-auth0-identity-token');

/**
 * The agent ID token "database"
 */
const identityDb = {};

setupKeystore((err, keyStuff) => {
  if (err) console.log(err);
  let { pub, prv, keystore } = keyStuff;

  pem.createCertificate({ days: 1, selfSigned: true }, function (err, keys) {
    if (err) {
      throw err
    }

    const tlsOptions = {
      key: keys.serviceKey,
      cert: keys.certificate
    };

    /**
     * Fake Auth0 server
     */
    const Hapi = require('@hapi/hapi');

    const init = async () => {

      const server = Hapi.server({
        port: 3002,
        host: '0.0.0.0',
        tls: tlsOptions,
        routes: {
          cors: true
        }
      });

      await server.register({
        plugin: require('hapi-require-https'),
        options: {}
      })

      /**
       * Pass an ID token for immediate reference during `/authorize`.  The
       * authorize route takes a pseudo-random access code and nonce. These
       * are required to access and validate an ID token. The ID token
       * registered here is stored to be combined with those codes when the
       * `/authorize` endpoint is hit after the `/login` redirect. If a new
       * agent is being added, the login has to happen immediately after in
       * the tests for the new agent to be added to the "database".
       */
      let agentIdToken;
      server.route({
        method: 'POST',
        path: '/register',
        handler: (request, h) => {
          console.log('/register');
          console.log(request.payload);

          agentIdToken = {...request.payload.token,
                             aud: process.env.AUTH0_CLIENT_ID,
                             iss: `https://${process.env.AUTH0_DOMAIN}/`,
                             iat: Math.floor(Date.now() / 1000) - (60 * 60)},

          console.log(agentIdToken);

          return h.response(agentIdToken);
        }
      });

      /**
       * Hit immediately after `/login`. If a new test agent has been
       * registered, he is added to the database here.
       */
      let _nonce;
      server.route({
        method: 'GET',
        path: '/authorize',
        handler: (request, h) => {
          console.log('/authorize');
          console.log(request.state);
          console.log(request.query);

          _nonce = request.query.nonce;

          const buffer = crypto.randomBytes(12);
          const authorizationCode = buffer.toString('hex');

          // A test agent has been registered.
          if (agentIdToken) {
            const idToken = { ...agentIdToken, nonce: _nonce };
            const signedToken = jwt.sign(idToken, prv, { algorithm: 'RS256', header: { kid: keystore.all()[0].kid } });

            identityDb[authorizationCode] = { idToken: idToken,
                                              count: Object.keys(identityDb).length + 1,
                                              signedToken: signedToken };

            // This allows the next test to register an agent
            agentIdToken = undefined;
          }

          const redirectUrl= `http://${process.env.SERVER_DOMAIN}/callback?code=${authorizationCode}&state=${request.query.state}`;
          console.log(`Redirecting: ${redirectUrl}`);
          return h.redirect(redirectUrl);
        }
      });

      /**
       * It's here that you kind of start to understand and appreciate OAuth...
       */
      server.route({
        method: 'POST',
        path: '/oauth/token',
        handler: (request, h) => {
          console.log('/oauth/token...');
          console.log(request.headers);
          console.log(request.payload);

          let signedIdToken;
          if (identityDb[request.payload.code]) {
            signedIdToken = identityDb[request.payload.code].signedToken;
          }
          else {
            // This step satisfies the earliest client-side auth tests,
            // which I am too sentimental to delete.
            signedIdToken = jwt.sign({..._identity,
                                         aud: process.env.AUTH0_CLIENT_ID,
                                         iat: Math.floor(Date.now() / 1000) - (60 * 60),
                                         iss: `https://${process.env.AUTH0_DOMAIN}/`,
                                         nonce: identityDb[request.payload.code] ? identityDb[request.payload.code].idToken.nonce : _nonce} ,
                                      prv, { algorithm: 'RS256', header: { kid: keystore.all()[0].kid } })
          }

          // This was expedient. No problems so far
          const pretendValidAccessToken = request.payload.code;

          return h.response({
            'access_token': pretendValidAccessToken,
            'refresh_token': 'SOME_MADE_UP_REFRESH_TOKEN',
            'id_token': signedIdToken
          });
        }
      });

      /**
       * This will come in handing if we switch our
       * auth strategy again
       */
      server.route({
        method: 'GET',
        path: '/.well-known/jwks.json',
        handler: (request, h) => {
          console.log('/.well-known/jwks.json');
          console.log(keystore.toJSON());
          return JSON.stringify(keystore.toJSON());
        }
      });

      /**
       * Delivers as promised
       */
      server.route({
        method: 'GET',
        path: '/userinfo',
        handler: (request, h) => {
          console.log('/userinfo');
          console.log(request.headers);
          console.log(request.query);

          let idToken = identityDb[request.query.access_token] ? identityDb[request.query.access_token].idToken : _identity;
          return h.response(idToken);
        }
      });

      await server.start();
      console.log('Server running on %s', server.info.uri);
    };

    process.on('unhandledRejection', (err) => {
      console.log(err);
      process.exit(1);
    });

    init();
  });
});

