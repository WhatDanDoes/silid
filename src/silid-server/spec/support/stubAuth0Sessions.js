const app = require('../../app');
const request = require('supertest-session');
const nock = require('nock');

const roles = require('../../config/roles');

/**
 * 2019-11-13
 * Sample tokens taken from:
 *
 * https://auth0.com/docs/api-auth/tutorials/adoption/api-tokens
 *
 * For the moment, it doesn't seem to matter that all authenticated
 * agents are using the same access token for testing purposes.
 */
const _access = { ...require('../fixtures/sample-auth0-access-token'), iss: `http://${process.env.AUTH0_CUSTOM_DOMAIN}/`};

const jwt = require('jsonwebtoken');
const jose = require('node-jose');
const pem2jwk = require('pem-jwk').pem2jwk
const NodeRSA = require('node-rsa');
const querystring = require('querystring');

module.exports = function(done) {

  // Note to future self: this will probably muck things up if I
  // try to stub any other services
  nock.cleanAll();

  require('./setupKeystore').then(singleton => {
    let { pub, prv, keystore } = singleton.keyStuff;


    /**
     * `/authorize?...` mock
     *
     * This is called when `/login` is hit. The session is
     * created prior to redirect.
     *
     * Set `DEBUG=nock.*` to log
     */
    let state, nonce;
    const authorizeScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
      .persist()
      .get(/authorize*/)
      .reply(302, (uri, body) => {
        uri = uri.replace('/authorize?', '');
        const parsed = querystring.parse(uri);
        state = parsed.state;
        nonce = parsed.nonce;
      });

    /**
     * login
     */
    function login(idToken, permissions, done) {

      if (typeof permissions === 'function') {
        done = permissions;
        permissions = [];
      }

      /**
       * `/userinfo` mock
       *
       * Strangley, this seems to be called before the token
       * exchange and before the encoded id_token is delivered
       */
      const userInfoScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
        .get(/userinfo/)
        .reply(200, idToken);


      /**
       * This sets the cookie before the Auth0 redirects take over
       */
      const session = request(app);
      session
        .get('/login')
        .redirects()
        .end(function(err, res) {
          if (err) return done(err);

          const signedIdToken = jwt.sign({...idToken,
                                              aud: process.env.AUTH0_CLIENT_ID,
                                              iat: Math.floor(Date.now() / 1000) - (60 * 60),
                                              nonce: nonce },
                                           prv, { algorithm: 'RS256', header: { kid: keystore.all()[0].kid } });

          const signedAccessToken = jwt.sign({..._access, permissions: permissions}, prv, { algorithm: 'RS256', header: { kid: keystore.all()[0].kid } });

          /**
           * `/oauth/token` mock
           *
           *
           * Called on `/callback` when the client exchanges the
           * `authorization_code` for access and ID tokens
           */
          const oauthTokenScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
            .post(/oauth\/token/, {
                                    'grant_type': 'authorization_code',
                                    'redirect_uri': /\/callback/,
                                    'client_id': process.env.AUTH0_CLIENT_ID,
                                    'client_secret': process.env.AUTH0_CLIENT_SECRET,
                                    'code': 'AUTHORIZATION_CODE'
                                  })
            .reply(200, {
              'access_token': signedAccessToken,
              'refresh_token': 'SOME_MADE_UP_REFRESH_TOKEN',
              'id_token': signedIdToken });

          session
            .get(`/callback?code=AUTHORIZATION_CODE&state=${state}`)
            .redirects()
            .end(function(err, res) {
              if (err) return done(err);
              done(null, session, signedAccessToken);
            });
        });
    };

    done(null, {login, pub, prv, keystore});
  }).catch(err => {
    console.error(err);
  });
};
