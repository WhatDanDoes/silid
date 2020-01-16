const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001;
const app = require('../../app');
const request = require('supertest-session');
const nock = require('nock');
const querystring = require('querystring');
const jwt = require('jsonwebtoken');
const setupKeystore = require('../support/setupKeystore');

describe('authSpec', () => {

  /**
   * 2019-11-13
   * Sample tokens taken from:
   *
   * https://auth0.com/docs/api-auth/tutorials/adoption/api-tokens
   */
  //const _access = require('../fixtures/sample-auth0-access-token');
  const _identity = require('../fixtures/sample-auth0-identity-token');

  let pub, prv, keystore;
  beforeAll(done => {
    setupKeystore((err, keyStuff) => {
      if (err) return done.fail(err);
      ({ pub, prv, keystore } = keyStuff);
      done();
    });
  });

  let auth0Scope, state, nonce;
  beforeEach(done => {

    /**
     * This is called when `/login` is hit. The session is
     * created prior to redirect.
     */
    auth0Scope = nock(`https://${process.env.AUTH0_DOMAIN}`)
      .log(console.log)
      .get(/authorize*/)
      .reply(302, (uri, body) => {
        uri = uri.replace('/authorize?', '');
        const parsed = querystring.parse(uri);
        state = parsed.state;
        nonce = parsed.nonce;
      });
    done();
  });

  describe('/login', () => {
    it('redirects to Auth0 login endpoint', done => {
      request(app)
        .get('/login')
        .expect(302)
        .end(function(err, res) {
          if (err) return done.fail(err);
          expect(res.headers.location).toMatch(process.env.AUTH0_DOMAIN);
          done();
        });     
    });

    it('starts a session', done => {
      const session = request(app);
      expect(session.cookies.length).toEqual(0);
      session
        .get('/login')
        .expect(302)
        .end(function(err, res) {
          if (err) return done.fail(err);
          expect(session.cookies.length).toEqual(1);
          done();
        });     
    });

    it('calls the /authorize endpoint', done => {
      request(app)
        .get('/login')
        .redirects()
        .end(function(err, res) {
          if (err) return done.fail(err);
          auth0Scope.isDone()
          done();
        });     
    });
  });

  /**
   * Called upon successful third-party permission granting.
   * The code is exchanged for an authorization token. Then
   * `/userinfo` is hit
   */
  describe('/callback', () => {

    let session, oauthTokenScope;
    beforeEach(done => {
      /**
       * `/userinfo` mock
       */
      userInfoScope = nock(`https://${process.env.AUTH0_DOMAIN}`)
        .log(console.log)
        .get(/userinfo/)
        .reply(200, _identity);

      /**
       * This sets the cookie before the Auth0 redirects take over 
       */
      session = request(app);
      session
        .get('/login')
        .redirects()
        .end(function(err, res) {
          if (err) return done.fail(err);

          /**
           * `/oauth/token` mock
           */
          oauthTokenScope = nock(`https://${process.env.AUTH0_DOMAIN}`)
            .log(console.log)
            .post(/oauth\/token/, {
                                    'grant_type': 'authorization_code',
                                    'redirect_uri': /\/callback/,
                                    'client_id': process.env.AUTH0_CLIENT_ID,
                                    'client_secret': process.env.AUTH0_CLIENT_SECRET,
                                    'code': 'AUTHORIZATION_CODE'
                                  })
            .reply(200, {
              'access_token': 'SOME_MADE_UP_ACCESS_TOKEN',
              'refresh_token': 'SOME_MADE_UP_REFRESH_TOKEN',
              'id_token': jwt.sign({..._identity,
                                      aud: process.env.AUTH0_CLIENT_ID,
                                      iat: Math.floor(Date.now() / 1000) - (60 * 60),
                                      nonce: nonce },
                                   prv, { algorithm: 'RS256', header: { kid: keystore.all()[0].kid } })
            });

          done();
        });
    });

    it('calls the `/oauth/token` endpoint', done => {
      session
        .get(`/callback?code=AUTHORIZATION_CODE&state=${state}`)
        .expect(302)
        .end(function(err, res) {
          if (err) return done.fail(err);
          oauthTokenScope.done();
          done();
        });
    });

    it('calls the `/userinfo` endpoint', done => {
      session
        .get(`/callback?code=AUTHORIZATION_CODE&state=${state}`)
        .expect(302)
        .end(function(err, res) {
          if (err) return done.fail(err);
          userInfoScope.done();
          done();
        });
    });

    describe('/logout', () => {
      it('redirects home and clears the session', done => {
        expect(session.cookies.length).toEqual(1);
        session
          .get('/logout')
          .expect(302)
          .end(function(err, res) {
            if (err) return done.fail(err);
            expect(res.headers.location).toMatch('/');
            expect(session.cookies.length).toEqual(0);
            done();
          });
      });
    });
  });
});
