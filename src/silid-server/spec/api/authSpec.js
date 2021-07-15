const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001;
const app = require('../../app');
const request = require('supertest-session');
const nock = require('nock');
const querystring = require('querystring');
const jwt = require('jsonwebtoken');
const models = require('../../models');
const url = require('url');
const cheerio = require('cheerio');

describe('authSpec', () => {

  /**
   * 2019-11-13
   * Sample tokens taken from:
   *
   * https://auth0.com/docs/api-auth/tutorials/adoption/api-tokens
   */
  const _identity = { ...require('../fixtures/sample-auth0-identity-token'), iss: `https://${process.env.AUTH0_CUSTOM_DOMAIN}/`};
  const _access = require('../fixtures/sample-auth0-access-token');
  const _profile = require('../fixtures/sample-auth0-profile-response');

  // Auth0 defined scopes and roles
  const scope = require('../../config/permissions');
  const apiScope = require('../../config/apiPermissions');
  const roles = require('../../config/roles');

  let pub, prv, keystore;
  beforeAll(done => {
    require('../support/setupKeystore').then(keyStuff => {
      ({ pub, prv, keystore } = keyStuff);
      done();
    }).catch(err => {
      done.fail(err);
    });
  });

  let auth0Scope, state, nonce;
  beforeEach(done => {
    nock.cleanAll();

    /**
     * This is called when `/login` is hit. The session is
     * created prior to redirect.
     */
    auth0Scope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
      .get(/authorize*/)
      .reply(302, (uri, body) => {
        uri = uri.replace('/authorize?', '');
        const parsed = querystring.parse(uri);
        state = parsed.state;
        nonce = parsed.nonce;
      });

    done();
  });

  afterEach(done => {
    // Delete the database
    models.sequelize.sync({force: true}).then(() => {
      done();
    }).catch(err => {
      done.fail(err);
    });
  });

  describe('/login', () => {
    it('redirects to Auth0 login endpoint', done => {
      request(app)
        .get('/login')
        .expect(302)
        .end(function(err, res) {
          if (err) return done.fail(err);
          expect(res.headers.location).toMatch(process.env.AUTH0_CUSTOM_DOMAIN);
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
          expect(session.cookies[0].name).toEqual('silid-server');
          expect(session.cookies[0].value).toBeDefined();
          expect(typeof session.cookies[0].expiration_date).toEqual('number');
          expect(session.cookies[0].expiration_date).not.toEqual(Infinity);
          expect(session.cookies[0].path).toEqual('/');
          expect(session.cookies[0].explicit_path).toBe(true);
          expect(session.cookies[0].domain).toBeUndefined();
          expect(session.cookies[0].explicit_domain).toBe(false);
          expect(session.cookies[0].noscript).toBe(true);

          //
          // 2020-10-19
          //
          // The bulk of the above are defaults. These require manual
          // testing, because in order for such a cookie to be put into the
          // cookie jar, it would have to be HTTPS
          //
          // expect(session.cookies[0].secure).toBe(true);
          // expect(session.cookies[0].sameSite).toEqual('none');
          //
          // These are test expectations. Production expetations are commented above
          expect(session.cookies[0].secure).toBe(false);
          expect(session.cookies[0].sameSite).toBeUndefined();

          done();
        });
    });

    it('sets maximum cookie age to one hour', done => {
      const session = request(app);
      session
        .get('/login')
        .expect(302)
        .end(function(err, res) {
          if (err) return done.fail(err);
          expect(session.cookies.length).toEqual(1);
          expect(session.cookies[0].expiration_date <= Date.now() + 1000 * 60 * 60).toBe(true);
          done();
        });
    });

    it('calls the /authorize endpoint', done => {
      request(app)
        .get('/login')
        .redirects()
        .end(function(err, res) {
          if (err) return done.fail(err);
          expect(auth0Scope.isDone()).toBe(true);
          done();
        });
    });

    /**
     * The `audience` param is required in order to get a JWT access token from
     * Auth0. Without `audience`, you will receive an _opaque_ token, which
     * contains no information.
     *
     * Think twice before thinking this unnecessary. So far the mocks have not
     * caught this param as a _match_ requirement. Haven't found precisely
     * where it is being released into the wild.
     */
    it('calls passport.authenticate with the correct options', done => {
      expect(process.env.AUTH0_API_AUDIENCE).toBeDefined();
      const passport = require('passport');
      spyOn(passport, 'authenticate').and.callThrough();
      request(app)
        .get('/login')
        .set('Accept-Language', 'ru')
        .redirects()
        .end(function(err, res) {
          if (err) return done.fail(err);
          expect(passport.authenticate).toHaveBeenCalledWith('auth0', {
            scope: 'openid email profile',
            audience: process.env.AUTH0_API_AUDIENCE,
            ui_locales: 'ru'
          });
          done();
        });
    });

    it('cleans the client languages for localizing the Auth0 Universal Login', done => {
      expect(process.env.AUTH0_API_AUDIENCE).toBeDefined();
      const passport = require('passport');
      spyOn(passport, 'authenticate').and.callThrough();
      request(app)
        .get('/login')
        // These language codes with quality values were taken as-is from my Chrome client
        .set('Accept-Language', 'en-GB;q=0.9,en-US;q=0.8,en;q=0.7')
        .redirects()
        .end(function(err, res) {
          if (err) return done.fail(err);
          expect(passport.authenticate).toHaveBeenCalledWith('auth0', {
            scope: 'openid email profile',
            audience: process.env.AUTH0_API_AUDIENCE,
            ui_locales: 'en-GB en-US en'
          });
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

    let session, oauthTokenScope, userInfoScope;
    // Added for when agent info is requested immediately after authentication
    let anotherOauthTokenScope, userReadScope;
    beforeEach(done => {

      /**
       * `/userinfo` mock
       */
      userInfoScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
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
          auth0Scope.isDone()

          /**
           * `/oauth/token` mock
           *
           * This is called when first authenticating
           */
          oauthTokenScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
            .post(/oauth\/token/, {
                                    'grant_type': 'authorization_code',
                                    'redirect_uri': /\/callback/,
                                    'client_id': process.env.AUTH0_CLIENT_ID,
                                    'client_secret': process.env.AUTH0_CLIENT_SECRET,
                                    'code': 'AUTHORIZATION_CODE'
                                  })
            .reply(200, {
              'access_token': jwt.sign({..._access,
                                        permissions: [scope.read.agents]},
                                       prv, { algorithm: 'RS256', header: { kid: keystore.all()[0].kid } }),
              'refresh_token': 'SOME_MADE_UP_REFRESH_TOKEN',
              'id_token': jwt.sign({..._identity,
                                      aud: process.env.AUTH0_CLIENT_ID,
                                      iat: Math.floor(Date.now() / 1000) - (60 * 60),
                                      nonce: nonce },
                                   prv, { algorithm: 'RS256', header: { kid: keystore.all()[0].kid } })
            });

          /**
           * This is called when the agent has authenticated and silid
           * needs to retreive the non-OIDC-compliant metadata, etc.
           */
          const accessToken = jwt.sign({..._access, scope: [apiScope.read.users]},
                                        prv, { algorithm: 'RS256', header: { kid: keystore.all()[0].kid } })
          anotherOauthTokenScope = nock(`https://${process.env.AUTH0_M2M_DOMAIN}`)
            .post(/oauth\/token/, {
                                    'grant_type': 'client_credentials',
                                    'client_id': process.env.AUTH0_M2M_CLIENT_ID,
                                    'client_secret': process.env.AUTH0_M2M_CLIENT_SECRET,
                                    /**
                                     * 2020-12-17
                                     *
                                     * Set as such because we have a custom domain.
                                     *
                                     * https://auth0.com/docs/custom-domains/configure-features-to-use-custom-domains#apis
                                     */
                                    //'audience': `https://${process.env.AUTH0_CUSTOM_DOMAIN}/api/v2/`,
                                    'audience': process.env.AUTH0_M2M_AUDIENCE,
                                    'scope': apiScope.read.users
                                  })
            .reply(200, {
              'access_token': accessToken,
              'token_type': 'Bearer',
            });

          /**
           * The token retrieved above is used to get the
           * non-OIDC-compliant metadata, etc.
           */
          userReadScope = nock(`https://${process.env.AUTH0_M2M_DOMAIN}`, { reqheaders: { authorization: `Bearer ${accessToken}`} })
            .get(/api\/v2\/users\/.+/)
            .query({})
            .reply(200, _profile);


          done();
        });
    });

    it('calls the `/oauth/token` endpoint', done => {
      session
        .get(`/callback?code=AUTHORIZATION_CODE&state=${state}`)
        .expect(302)
        .end(function(err, res) {
          if (err) return done.fail(err);
          expect(oauthTokenScope.isDone()).toBe(true);
          done();
        });
    });

    it('calls the `/userinfo` endpoint', done => {
      session
        .get(`/callback?code=AUTHORIZATION_CODE&state=${state}`)
        .expect(302)
        .end(function(err, res) {
          if (err) return done.fail(err);
          expect(userInfoScope.isDone()).toBe(true);
          done();
        });
    });

    it('redirects home', done => {
      session
        .get(`/callback?code=AUTHORIZATION_CODE&state=${state}`)
        .expect(302)
        .end(function(err, res) {
          if (err) return done.fail(err);
          expect(res.headers.location).toEqual('/');
          done();
        });
    });

    describe('request for non-OIDC-compliant agent info', () => {
      it('calls the `/oauth/token` endpoint', done => {
        session
          .get(`/callback?code=AUTHORIZATION_CODE&state=${state}`)
          .expect(302)
          .end(function(err, res) {
            if (err) return done.fail(err);
            expect(anotherOauthTokenScope.isDone()).toBe(true);
            done();
          });
      });

      it('calls the `/users/:id` endpoint', done => {
        session
          .get(`/callback?code=AUTHORIZATION_CODE&state=${state}`)
          .expect(302)
          .end(function(err, res) {
            if (err) return done.fail(err);
            userReadScope.done();
            done();
          });
      });
    });

    describe('database', () => {
      it('adds a new agent record if none exists', done => {
        models.Agent.findAll().then(results => {
          expect(results.length).toEqual(0);

          session
            .get(`/callback?code=AUTHORIZATION_CODE&state=${state}`)
            .expect(302)
            .end(function(err, res) {
              if (err) return done.fail(err);
              models.Agent.findAll().then(results => {
                expect(results.length).toEqual(1);
                expect(results[0].socialProfile.user_id).toEqual(_profile.user_id);
                expect(results[0].socialProfile.name).toEqual(_profile.name);
                expect(results[0].socialProfile.email).toEqual(_profile.email);
                done();
              }).catch(err => {
                done.fail(err);
              });
            });
        }).catch(err => {
          done.fail(err);
        });
      });

      it('saves social profile data for an existing agent', done => {
        session
          .get(`/callback?code=AUTHORIZATION_CODE&state=${state}`)
          .expect(302)
          .end(function(err, res) {
            if (err) return done.fail(err);
            models.Agent.findAll().then(results => {
              expect(results.length).toEqual(1);
              expect(results[0].socialProfile.user_id).toEqual(_profile.user_id);
              expect(results[0].socialProfile.name).toEqual(_profile.name);
              expect(results[0].socialProfile.email).toEqual(_profile.email);

              results[0].socialProfile = null;
              results[0].save().then(results => {
                expect(results.socialProfile).toBe(null);

                session
                  .get('/logout')
                  .expect(302)
                  .end(function(err, res) {
                    if (err) return done.fail(err);

                    /**
                     * Blah!
                     *
                     * All these mocks need to be set up again for another
                     * login.
                     */
                    let newAuth0Scope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
                      .get(/authorize*/)
                      .reply(302, (uri, body) => {
                        uri = uri.replace('/authorize?', '');
                        const parsed = querystring.parse(uri);
                        state = parsed.state;
                        nonce = parsed.nonce;
                      });

                    let newSession = request(app);
                    newSession
                      .get('/login')
                      .redirects()
                      .end(function(err, res) {
                        if (err) return done.fail(err);

                        /**
                         * `/oauth/token` mock
                         */
                        let newOauthTokenScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
                          .post(/oauth\/token/, {
                                                  'grant_type': 'authorization_code',
                                                  'redirect_uri': /\/callback/,
                                                  'client_id': process.env.AUTH0_CLIENT_ID,
                                                  'client_secret': process.env.AUTH0_CLIENT_SECRET,
                                                  'code': 'AUTHORIZATION_CODE'
                                                })
                          .reply(200, {
                            'access_token': jwt.sign({..._access,
                                                      permissions: [scope.read.agents]},
                                                     prv, { algorithm: 'RS256', header: { kid: keystore.all()[0].kid } }),
                            'refresh_token': 'SOME_MADE_UP_REFRESH_TOKEN',
                            'id_token': jwt.sign({..._identity,
                                                    aud: process.env.AUTH0_CLIENT_ID,
                                                    iat: Math.floor(Date.now() / 1000) - (60 * 60),
                                                    nonce: nonce },
                                                 prv, { algorithm: 'RS256', header: { kid: keystore.all()[0].kid } })
                          });

                        let newUserInfoScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
                          .get(/userinfo/)
                          .reply(200, _identity);


                        /**
                         * This is so gross...
                         *
                         * This is called when the agent has authenticated and silid
                         * needs to retreive the non-OIDC-compliant metadata, etc.
                         */
                        const accessToken = jwt.sign({..._access, scope: [apiScope.read.users]},
                                                      prv, { algorithm: 'RS256', header: { kid: keystore.all()[0].kid } })
                        let anotherOauthTokenScope = nock(`https://${process.env.AUTH0_M2M_DOMAIN}`)
                          .post(/oauth\/token/, {
                                                  'grant_type': 'client_credentials',
                                                  'client_id': process.env.AUTH0_M2M_CLIENT_ID,
                                                  'client_secret': process.env.AUTH0_M2M_CLIENT_SECRET,
                                                  /**
                                                   * 2020-12-17
                                                   *
                                                   * Set as such because we have a custom domain.
                                                   *
                                                   * https://auth0.com/docs/custom-domains/configure-features-to-use-custom-domains#apis
                                                   */
                                                  //'audience': `https://${process.env.AUTH0_CUSTOM_DOMAIN}/api/v2/`,
                                                  'audience': process.env.AUTH0_M2M_AUDIENCE,
                                                  'scope': apiScope.read.users
                                                })
                          .reply(200, {
                            'access_token': accessToken,
                            'token_type': 'Bearer',
                          });

                        /**
                         * The token retrieved above is used to get the
                         * non-OIDC-compliant metadata, etc.
                         */
                        let userReadScope = nock(`https://${process.env.AUTH0_M2M_DOMAIN}`, { reqheaders: { authorization: `Bearer ${accessToken}`} })
                          .get(/api\/v2\/users\/.+/)
                          .query({})
                          .reply(200, _profile);


                        /**
                         * Login again... finally
                         */
                        newSession
                          .get(`/callback?code=AUTHORIZATION_CODE&state=${state}`)
                          .expect(302)
                          .end(function(err, res) {
                            if (err) return done.fail(err);
                            models.Agent.findAll().then(results => {
                              expect(results.length).toEqual(1);
                              expect(results[0].socialProfile.user_id).toEqual(_profile.user_id);
                              expect(results[0].socialProfile.name).toEqual(_profile.name);
                              expect(results[0].socialProfile.email).toEqual(_profile.email);

                              done();
                            }).catch(err => {
                              done.fail(err);
                            });
                          });
                      });
                  });
              });
            }).catch(err => {
              done.fail(err);
            });
          });
      });
    });

    describe('/logout', () => {

      let logoutScope;
      beforeEach(done => {
        /**
         * Redirect client to Auth0 `/logout` after silid session is cleared
         */
        logoutScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
          .get('/v2/logout')
          .query({
            client_id: process.env.AUTH0_CLIENT_ID,
            returnTo: process.env.SERVER_DOMAIN + '/cheerio',
          })
          .reply(302, {}, { 'Location': process.env.SERVER_DOMAIN + '/cheerio' });
        done();
      });

      it('redirects home and clears the session', done => {
        expect(session.cookies.length).toEqual(1);
        session
          .get('/logout')
          .expect(302)
          .end(function(err, res) {
            if (err) return done.fail(err);
            expect(session.cookies.length).toEqual(0);
            done();
          });
      });

      it('redirects to the Auth0 SSO /logout endpoint and sets redirect query string', done => {
        session
          .get('/logout')
          .expect(302)
          .end(function(err, res) {
            if (err) return done.fail(err);
            const loc = new URL(res.header.location);
            expect(loc.origin).toMatch(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`);
            expect(loc.hostname).toMatch(process.env.AUTH0_CUSTOM_DOMAIN);
            expect(loc.pathname).toMatch('/v2/logout');
            expect(loc.searchParams.get('client_id')).toMatch(process.env.AUTH0_CLIENT_ID);
            expect(loc.searchParams.get('returnTo')).toMatch(process.env.SERVER_DOMAIN);
            expect(loc.searchParams.get('federated')).toBe(null);
            done();
          });
      });

      it('calls the Auth0 SSO /logout endpoint on redirect', done => {
        session
          .get('/logout')
          .redirects(1)
          .end((err, res) => {
            if (err) return done.fail(err);
            expect(logoutScope.isDone()).toBe(true);
            done();
          });
      });
    });

    describe('/cheerio', () => {

      let getClientsScope, clientLogoutScopes, clientCallbacks, redirectScope;
      beforeEach(done => {
        const accessToken = jwt.sign({..._access, scope: [apiScope.read.clients]},
                                      prv, { algorithm: 'RS256', header: { kid: keystore.all()[0].kid } })

        const getClientsOauthTokenScope = nock(`https://${process.env.AUTH0_M2M_DOMAIN}`)
          .post(/oauth\/token/, {
                                  'grant_type': 'client_credentials',
                                  'client_id': process.env.AUTH0_M2M_CLIENT_ID,
                                  'client_secret': process.env.AUTH0_M2M_CLIENT_SECRET,
                                  /**
                                   * 2020-12-17
                                   *
                                   * Set as such because we have a custom domain.
                                   *
                                   * https://auth0.com/docs/custom-domains/configure-features-to-use-custom-domains#apis
                                   */
                                  //'audience': `https://${process.env.AUTH0_CUSTOM_DOMAIN}/api/v2/`,
                                  'audience': process.env.AUTH0_M2M_AUDIENCE,
                                  'scope': apiScope.read.clients
                                })
          .reply(200, {
            'access_token': accessToken,
            'token_type': 'Bearer',
          });

        redirectScope = nock('http://example.com')
          .get('/')
          .reply(200);

        clientCallbacks = [
          {
            "client_id": "SILIdentitysoKnqjj8HJqRn4T5titww",
            "name": "SIL Identity",
            "callbacks": ['http://xyz.io/callback', 'https://abc.com/some-callback']
          },
          {
            "client_id": "TranscribersoKnqjj8HJqRn4T5titww",
            "name": "Transcriber",
            "callbacks": [ "http://example.com/callback" ],
          },
          {
            "client_id": "ScriptureForgenqjj8HJqRn4T5titww",
            "name": "Scripture Forge",
            "callbacks": ['https://sub.example.com/callback', 'http://dev.example.com/dev'],
          },
          {
            "client_id": "NoCallbacksrgenqjj8HJqRn4T5titww",
            "name": "Misconfigured. No callbacks"
          }
        ];
        getClientsScope = nock(`https://${process.env.AUTH0_M2M_DOMAIN}`)
          .get(/api\/v2\/clients/)
          .query({
            fields: 'client_id,name,callbacks',
            include_fields: true,
            page: 0,
            per_page: 50,
          })
          .reply(200, clientCallbacks);

        clientLogoutScopes = [];
        for (let client of clientCallbacks) {
          if (!client.callbacks) continue;
          for (let callback of client.callbacks) {
            let urlObj = new url.URL(callback);
            clientLogoutScopes.push(nock(urlObj.origin)
                                     .get('/logout')
                                     .reply(302, {})
                                   );
          }
        }

        done();
      });

      it('displays the correct interface', done => {
        session
          .get('/cheerio')
          .query({ returnTo: 'http://example.com' })
          .expect(200)
          .end((err, res) => {
            if (err) return done.fail(err);
            const $ = cheerio.load(res.text);

            expect($('main h2').text()).toEqual('Logging out of all SIL applications...');
            expect($('main section > h1 a').attr('href')).toEqual('/');
            expect($('main section > h1 a').text()).toEqual('Cheerio!');

            done();
          });
      });
    });
  });

  describe('Browser', () => {
    // Setup and start server
    const http = require('http');
    const server = http.createServer(app);
    server.on('listening', () => {
      console.log('Listening on ' + PORT);
    });
    server.listen(PORT);

    // Setup and configure zombie browser
    const Browser = require('zombie');
    Browser.localhost('localhost', PORT);

    let browser;
    beforeEach(() => {
      browser = new Browser({ waitDuration: '30s', loadCss: false });
    });

    it('displays the correct interface', done => {
      browser.visit('/', (err) => {
        browser.assert.element('a[href="/login"]');
        browser.assert.elements('a[href="/logout"]', 0);
        done();
      });
    });

    it('sets a cookie', done => {
      expect(browser.cookies.length).toEqual(0);
      browser.visit('/', (err) => {
        if (err) return done.fail(err);
        expect(browser.cookies.length).toEqual(1);
        done();
      });
    });

    describe('Login', () => {

      let loginScope, oauthTokenScope, userInfoScope;
      beforeEach(done => {
        nock.cleanAll();

        /**
         * This is called when `/login` is hit.
         */
        let identity, identityToken;
        auth0Scope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
          .get(/authorize*/)
          .reply((uri, body, next) => {
            uri = uri.replace('/authorize?', '');
            const parsed = querystring.parse(uri);
            state = parsed.state;
            nonce = parsed.nonce;

            identity = {..._identity,
                           aud: process.env.AUTH0_CLIENT_ID,
                           iat: Math.floor(Date.now() / 1000) - (60 * 60),
                           nonce: nonce }
            identityToken = jwt.sign(identity, prv, { algorithm: 'RS256', header: { kid: keystore.all()[0].kid } })

            /**
             * `/userinfo` mock
             */
            userInfoScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
              .get(/userinfo/)
              .reply(200, identity);

            /**
             * `/oauth/token` mock
             */
            oauthTokenScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
              .post(/oauth\/token/, {
                                      'grant_type': 'authorization_code',
                                      'redirect_uri': /\/callback/,
                                      'client_id': process.env.AUTH0_CLIENT_ID,
                                      'client_secret': process.env.AUTH0_CLIENT_SECRET,
                                      'code': 'AUTHORIZATION_CODE'
                                    })
              .reply(200, {
                'access_token': jwt.sign({..._access,
                                          permissions: [scope.read.agents]},
                                         prv, { algorithm: 'RS256', header: { kid: keystore.all()[0].kid } }),
                'refresh_token': 'SOME_MADE_UP_REFRESH_TOKEN',
                'id_token': identityToken
              });

            /**
             * This is called when the agent has authenticated and silid
             * needs to retreive the non-OIDC-compliant metadata, etc.
             */
            const accessToken = jwt.sign({..._access, scope: [apiScope.read.users]},
                                          prv, { algorithm: 'RS256', header: { kid: keystore.all()[0].kid } })
            const anotherOauthTokenScope = nock(`https://${process.env.AUTH0_M2M_DOMAIN}`)
              .post(/oauth\/token/, {
                                      'grant_type': 'client_credentials',
                                      'client_id': process.env.AUTH0_M2M_CLIENT_ID,
                                      'client_secret': process.env.AUTH0_M2M_CLIENT_SECRET,
                                      /**
                                       * 2020-12-17
                                       *
                                       * Set as such because we have a custom domain.
                                       *
                                       * https://auth0.com/docs/custom-domains/configure-features-to-use-custom-domains#apis
                                       */
                                      //'audience': `https://${process.env.AUTH0_CUSTOM_DOMAIN}/api/v2/`,
                                      'audience': process.env.AUTH0_M2M_AUDIENCE,
                                      'scope': apiScope.read.users
                                    })
              .reply(200, {
                'access_token': accessToken,
                'token_type': 'Bearer',
              });

            /**
             * The token retrieved above is used to get the
             * non-OIDC-compliant metadata, etc.
             */
            const userReadScope = nock(`https://${process.env.AUTH0_M2M_DOMAIN}`, { reqheaders: { authorization: `Bearer ${accessToken}`} })
              .get(/api\/v2\/users\/.+/)
              .query({})
              .reply(200, _profile);


            next(null, [302, {}, { 'Location': `https://${process.env.AUTH0_CUSTOM_DOMAIN}/login` }]);
          });

        /**
         * `/login` mock
         */
        loginScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
          .get(/login/)
          .reply((uri, body, next) => {
            next(null, [302, {}, { 'Location': `http://localhost:${PORT}/callback?code=AUTHORIZATION_CODE&state=${state}` }]);
          });

        browser.visit('/', (err) => {
          if (err) return done.fail(err);
          done();
        });
      });

      it('serves up the static app', done => {
        browser.clickLink('Login', (err) => {
          if (err) return done.fail(err);
          browser.assert.text('body p', /This is a test page/);
          browser.assert.element('a[href="/logout"]');
          done();
        });
      });

      // This is not testing the client side app
      describe('Logout', () => {

        describe('<50 unpaginated', () => {
          let logoutScope, getClientsScope, clientLogoutScopes, clientCallbacks;
          beforeEach(done => {
            /**
             * This is called when the agent has authenticated and silid
             * needs to retreive the non-OIDC-compliant metadata, etc.
             */
            const accessToken = jwt.sign({..._access, scope: [apiScope.read.clients]},
                                          prv, { algorithm: 'RS256', header: { kid: keystore.all()[0].kid } })
            const anotherOauthTokenScope = nock(`https://${process.env.AUTH0_M2M_DOMAIN}`)
              .post(/oauth\/token/, {
                                      'grant_type': 'client_credentials',
                                      'client_id': process.env.AUTH0_M2M_CLIENT_ID,
                                      'client_secret': process.env.AUTH0_M2M_CLIENT_SECRET,
                                      'audience': `https://${process.env.AUTH0_CUSTOM_DOMAIN}/api/v2/`,
                                      'scope': apiScope.read.clients
                                    })
              .reply(200, {
                'access_token': accessToken,
                'token_type': 'Bearer',
              });


            // Clear Auth0 SSO session cookies
            logoutScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
              .get('/v2/logout')
              .query({
                client_id: process.env.AUTH0_CLIENT_ID,
                returnTo: process.env.SERVER_DOMAIN + '/cheerio',
              })
              .reply(302, {}, { 'Location': `${process.env.SERVER_DOMAIN}/cheerio?returnTo=${process.env.SERVER_DOMAIN}` });


            clientCallbacks = [
              {
                "client_id": "SILIdentitysoKnqjj8HJqRn4T5titww",
                "name": "SIL Identity",
                "callbacks": ['http://xyz.io/callback', 'https://abc.com/some-callback']
              },
              {
                "client_id": "TranscribersoKnqjj8HJqRn4T5titww",
                "name": "Transcriber",
                "callbacks": [ "http://example.com/callback" ],
              },
              {
                "client_id": "ScriptureForgenqjj8HJqRn4T5titww",
                "name": "Scripture Forge",
                "callbacks": ['https://sub.example.com/callback', 'http://dev.example.com/dev'],
              },
              {
                "client_id": "NoCallbacksrgenqjj8HJqRn4T5titww",
                "name": "Misconfigured. No callbacks"
              }
            ];
            getClientsScope = nock(`https://${process.env.AUTH0_M2M_DOMAIN}`)
              .get(/api\/v2\/clients/)
              .query({
                fields: 'client_id,name,callbacks',
                include_fields: true,
                page: 0,
                per_page: 50
              })
              .reply(200, clientCallbacks);

            clientLogoutScopes = [];
            for (let client of clientCallbacks) {
              if (!client.callbacks) continue;
              for (let callback of client.callbacks) {
                let urlObj = new url.URL(callback);
                clientLogoutScopes.push(nock(urlObj.origin)
                                         .get('/logout')
                                         .reply(302, {})
                                       );
              }
            }

            browser.clickLink('Login', (err) => {
              if (err) return done.fail(err);
              browser.assert.success();
              done();
            });
          });

          it('lands in the right place', done => {
            browser.clickLink('Logout', (err) => {
              if (err) return done.fail(err);
              browser.assert.url('/');
              done();
            });
          });

          it('calls the Auth0 logout endpoint', done => {
            browser.clickLink('Logout', (err) => {
              if (err) return done.fail(err);
              expect(logoutScope.isDone()).toBe(true);
              done();
            });
          });

          it('calls the Auth0 Get Clients endpoint', done => {
            browser.clickLink('Logout', (err) => {
              if (err) return done.fail(err);
              expect(getClientsScope.isDone()).toBe(true);
              done();
            });
          });

          // This assumes that all SIL apps have a /logout endpoint
          it('calls all the client apps\' logout endpoints', done => {
            browser.clickLink('Logout', (err) => {
              if (err) return done.fail(err);
              for (let scope of clientLogoutScopes) {
                expect(scope.isDone()).toBe(true);
              }
              done();
            });
          });
        });

        describe('>50 paginated', () => {
          let logoutScope, getClientsScopes, clientLogoutScopes, clientCallbacks;
          beforeEach(done => {
            /**
             * This is called when the agent has authenticated and silid
             * needs to retreive the non-OIDC-compliant metadata, etc.
             */
            const accessToken = jwt.sign({..._access, scope: [apiScope.read.clients]},
                                          prv, { algorithm: 'RS256', header: { kid: keystore.all()[0].kid } })
            const anotherOauthTokenScope = nock(`https://${process.env.AUTH0_M2M_DOMAIN}`)
              .post(/oauth\/token/, {
                                      'grant_type': 'client_credentials',
                                      'client_id': process.env.AUTH0_M2M_CLIENT_ID,
                                      'client_secret': process.env.AUTH0_M2M_CLIENT_SECRET,
                                      'audience': `https://${process.env.AUTH0_CUSTOM_DOMAIN}/api/v2/`,
                                      'scope': apiScope.read.clients
                                    })
              .reply(200, {
                'access_token': accessToken,
                'token_type': 'Bearer',
              });

            // Clear Auth0 SSO session cookies
            logoutScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
              .get('/v2/logout')
              .query({
                client_id: process.env.AUTH0_CLIENT_ID,
                returnTo: process.env.SERVER_DOMAIN + '/cheerio',
              })
              .reply(302, {}, { 'Location': `${process.env.SERVER_DOMAIN}/cheerio?returnTo=${process.env.SERVER_DOMAIN}` });

            // 151 applications in the SIL ecosystem
            clientCallbacks = [];
            for (let i = 0; i < 151; i++) {
              clientCallbacks.push({
                "client_id": `SomeAwesomeSILAppj8HJqRn4T5titww${i}`,
                "name": `SomeAwesomeSILApp${i}`,
                "callbacks": [ `http://example${i}.com/callback` ],
              });
            }

            getClientsScopes = [];
            for (let i = 0; i < 151; i += 50) {
              getClientsScopes.push(
                nock(`https://${process.env.AUTH0_M2M_DOMAIN}`)
                  .get(/api\/v2\/clients/)
                  .query({
                    fields: 'client_id,name,callbacks',
                    include_fields: true,
                    page: i / 50,
                    per_page: 50
                  })
                  .reply(200, clientCallbacks.slice(i, i + 50))
              );
            }

            clientLogoutScopes = [];
            for (let client of clientCallbacks) {
              if (!client.callbacks) continue;
              for (let callback of client.callbacks) {
                let urlObj = new url.URL(callback);
                clientLogoutScopes.push(nock(urlObj.origin)
                                         .get('/logout')
                                         .reply(302, {})
                                       );
              }
            }

            browser.clickLink('Login', (err) => {
              if (err) return done.fail(err);
              browser.assert.success();
              done();
            });
          });

          it('lands in the right place', done => {
            browser.clickLink('Logout', (err) => {
              if (err) return done.fail(err);
              browser.assert.url('/');
              done();
            });
          });

          it('calls the Auth0 logout endpoint', done => {
            browser.clickLink('Logout', (err) => {
              if (err) return done.fail(err);
              expect(logoutScope.isDone()).toBe(true);
              done();
            });
          });

          it('calls the Auth0 Get Clients endpoint', done => {
            browser.clickLink('Logout', (err) => {
              if (err) return done.fail(err);
              for (let scope of getClientsScopes) {
                expect(scope.isDone()).toBe(true);
              }
              done();
            });
          });

          // This assumes that all SIL apps have a /logout endpoint
          it('calls all the client apps\' logout endpoints', done => {
            browser.clickLink('Logout', (err) => {
              if (err) return done.fail(err);
              for (let scope of clientLogoutScopes) {
                expect(scope.isDone()).toBe(true);
              }
              done();
            });
          });
        });
      });
    });
  });

  describe('Bearer token API access', () => {
    const stubOauthToken = require('../support/auth0Endpoints/stubOauthToken');
    const stubRolesRead = require('../support/auth0Endpoints/stubRolesRead');
    const stubUserRead = require('../support/auth0Endpoints/stubUserRead');
    const stubUserAssignRoles = require('../support/auth0Endpoints/stubUserAssignRoles');
    const stubUserRolesRead = require('../support/auth0Endpoints/stubUserRolesRead');
    const stubUserAppMetadataUpdate = require('../support/auth0Endpoints/stubUserAppMetadataUpdate');

    describe('with no token', () => {
      beforeEach(() => {
        /**
         * `/userinfo` mock
         */
        userInfoScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
          .get(/userinfo/)
          .reply(200, _identity);
      });

      it('return 401 error with message', done => {
        request(app)
          .get('/agent')
          .set('Accept', 'application/json')
          .expect(302)
          .end(function(err, res) {
            if (err) return done.fail(err);
            expect(res.headers.location).toEqual('/login');
            done();
          });
      });

      it('does not call Auth0 /userinfo', done => {
        request(app)
          .get('/agent')
          .set('Accept', 'application/json')
          .expect(302)
          .end(function(err, res) {
            if (err) return done.fail(err);
            expect(userInfoScope.isDone()).toBe(false);
            done();
          });
      });
    });

    describe('with mangled token', () => {
      beforeEach(() => {
        /**
         * `/userinfo` mock
         */
        userInfoScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
          .get(/userinfo/)
          .reply(200, _identity);
      });

      it('return 401 error with message', done => {
        request(app)
          .get('/agent')
          .set('Accept', 'application/json')
          .set('Authorization', 'Not-proper-Bearer some-made-up-bearer-token')
          .expect(401)
          .end(function(err, res) {
            if (err) return done.fail(err);
            expect(res.body.message).toEqual('Token could not be verified');
            done();
          });
      });

      it('does not call Auth0 /userinfo', done => {
        request(app)
          .get('/agent')
          .set('Accept', 'application/json')
          .set('Authorization', 'Not-proper-Bearer some-made-up-bearer-token')
          .expect(401)
          .end(function(err, res) {
            if (err) return done.fail(err);
            expect(userInfoScope.isDone()).toBe(false);
            done();
          });
      });
    });

    describe('with invalid token', () => {
      let userInfoScope;

      beforeEach(()=> {
        /**
         * `/userinfo` mock
         */
        userInfoScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
          .get(/userinfo/)
          .reply(401, { message: 'Token expired or something. I don\'t know what actually happens here' });
      });

      it('return 401 error with message', done => {
        request(app)
          .get('/agent')
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer some-made-up-bearer-token')
          .expect(401)
          .end(function(err, res) {
            if (err) return done.fail(err);
            expect(res.body.message).toEqual('Unauthorized');
            done();
          });
      });

      it('calls Auth0 /userinfo', done => {
        request(app)
          .get('/agent')
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer some-made-up-bearer-token')
          .expect(401)
          .end(function(err, res) {
            if (err) return done.fail(err);
            expect(userInfoScope.isDone()).toBe(true);
            done();
          });
      });
    });

    describe('with valid token', () => {
      let userInfoScope,
          rolesReadScope, rolesReadOauthTokenScope,
          userReadScope, userReadOauthTokenScope,
          userRolesReadScope, userRolesReadOauthTokenScope,
          userAssignRolesScope, userAssignRolesOauthTokenScope,
          secondUserReadScope, secondUserReadOauthTokenScope,
          secondUserRolesReadScope, secondUserRolesReadOauthTokenScope;

      /**
       * 2021-4-12
       *
       * The following test prove and document the Auth0 endpoints hit when a
       * client comes bearing a `Bearer` `Authorization` token.
       */
      beforeEach(done => {
        /**
         * `/userinfo` mock
         *
         * I'm leaving it to Auth0 to validate the `Bearer` `Authorization`
         * token. This happens when I request `GET /userinfo`.
         */
        userInfoScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
          .get(/userinfo/)
          .reply(200, _identity);

        // Immediately upon token verification (i.e., a successful return from
        // `GET /userinfo`, Identity retrieves the agent\'s roles and
        // `user_metadata`
        stubRolesRead((err, apiScopes) => {
          if (err) return done.fail(err);
          ({rolesReadScope, rolesReadOauthTokenScope} = apiScopes);

          stubUserRead((err, apiScopes) => {
            if (err) return done.fail(err);
            ({userReadScope, userReadOauthTokenScope} = apiScopes);

            stubUserRolesRead((err, apiScopes) => {
              if (err) return done.fail(err);
              ({userRolesReadScope, userRolesReadOauthTokenScope} = apiScopes);

              stubUserAssignRoles((err, apiScopes) => {
                if (err) return done.fail(err);
                ({userAssignRolesScope, userAssignRolesOauthTokenScope} = apiScopes);

                // This stubs the Auth0 calls for `GET /agent`. As you can see,
                // there is some redundancy...
                //
                // Are API sessions a viable option for reducing Auth0 calls
                // on subsequent requests?
                //
                stubUserRead((err, apiScopes) => {
                  if (err) return done.fail(err);
                  ({userReadScope: secondUserReadScope, userReadOauthTokenScope: secondUserReadOauthTokenScope} = apiScopes);

                  stubUserRolesRead((err, apiScopes) => {
                    if (err) return done.fail(err);
                    ({userRolesReadScope: secondUserRolesReadScope, userRolesReadOauthTokenScope: secondUserRolesReadOauthTokenScope} = apiScopes);

                    done();
                  });
                });
              });
            });
          });
        });
      });

      it('allows access to the requested resource', done => {
        request(app)
          .get('/agent')
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer some-made-up-bearer-token')
          .expect(200)
          .end(function(err, res) {
            if (err) return done.fail(err);

            expect(res.body.email).toEqual(_profile.email);
            expect(res.body.name).toEqual(_profile.name);
            expect(res.body.user_id).toEqual(_profile.user_id);
            expect(res.body.roles).toEqual([{ "id": "345", "name": "viewer", "description": "Basic agent viewing/updating permissions" }]);
            expect(res.body.user_metadata).toEqual({});
            expect(res.body.isSuper).toBe(false);
            expect(res.body.scope).toEqual(roles.viewer);

            done();
          });
      });

      it('calls Auth0 /userinfo and the appropriate endpoints', done => {
        request(app)
          .get('/agent')
          .set('Accept', 'application/json')
          .set('Authorization', 'Bearer some-made-up-bearer-token')
          .expect(200)
          .end(function(err, res) {
            if (err) return done.fail(err);
            expect(userInfoScope.isDone()).toBe(true);

            expect(rolesReadScope.isDone()).toBe(true);
            expect(rolesReadOauthTokenScope.isDone()).toBe(true);

            expect(userReadScope.isDone()).toBe(true);
            expect(userReadOauthTokenScope.isDone()).toBe(true);

            expect(userRolesReadScope.isDone()).toBe(true);
            expect(userRolesReadOauthTokenScope.isDone()).toBe(true);

            expect(userRolesReadScope.isDone()).toBe(true);
            expect(userAssignRolesOauthTokenScope.isDone()).toBe(false);

            expect(secondUserReadScope.isDone()).toBe(true);
            expect(secondUserReadOauthTokenScope.isDone()).toBe(false);

            expect(secondUserRolesReadScope.isDone()).toBe(true);
            expect(secondUserRolesReadOauthTokenScope.isDone()).toBe(false);

            done();
          });
      });
    });
  });
});
