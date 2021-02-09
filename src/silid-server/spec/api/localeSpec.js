const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001;

const request = require('supertest');
const path = require('path');
const fs = require('fs');

const app = require('../../app');
const fixtures = require('sequelize-fixtures');
const models = require('../../models');
const stubAuth0Sessions = require('../support/stubAuth0Sessions');
const stubAuth0ManagementApi = require('../support/stubAuth0ManagementApi');
const stubUserRead = require('../support/auth0Endpoints/stubUserRead');
const stubUserRolesRead = require('../support/auth0Endpoints/stubUserRolesRead');
const stubUserAppMetadataUpdate = require('../support/auth0Endpoints/stubUserAppMetadataUpdate');
const scope = require('../../config/permissions');
const apiScope = require('../../config/apiPermissions');

/**
 * 2019-11-13
 * Sample tokens taken from:
 *
 * https://auth0.com/docs/api-auth/tutorials/adoption/api-tokens
 */
const _identity = { ...require('../fixtures/sample-auth0-identity-token'), iss: `https://${process.env.AUTH0_CUSTOM_DOMAIN}/`};
const _profile = require('../fixtures/sample-auth0-profile-response');

describe('localeSpec', () => {
  let originalProfile;

  let login, pub, prv, keystore;
  beforeEach(done => {
    stubAuth0Sessions((err, sessionStuff) => {
      if (err) return done.fail(err);
      ({ login, pub, prv, keystore } = sessionStuff);
      done();
    });
  });

  afterEach(() => {
    // Through the magic of node I am able to adjust the profile data returned.
    // This resets the default values
    _profile.email_verified = true;
    delete _profile.user_metadata;
    _profile.email = originalProfile.email;
    _profile.name = originalProfile.name;
  });

  let agent;
  beforeEach(done => {
    originalProfile = {..._profile};

    models.sequelize.sync({force: true}).then(() => {
      fixtures.loadFile(`${__dirname}/../fixtures/agents.json`, models).then(() => {
        models.Agent.findAll().then(results => {
          agent = results[0];
          done();
        }).catch(err => {
          done.fail(err);
        });
      }).catch(err => {
        done.fail(err);
      });
    }).catch(err => {
      done.fail(err);
    });
  });

  let authenticatedSession;
  describe('authenticated', () => {

    describe('authorized', () => {

      describe('read', () => {

        describe('GET /locale', () => {
          beforeEach(done => {
            stubAuth0ManagementApi((err, apiScopes) => {
              if (err) return done.fail();

              login(_identity, [scope.read.agents], (err, session) => {
                if (err) return done.fail(err);
                authenticatedSession = session;

                // Cached profile doesn't match "live" data, so agent needs to be updated
                // with a call to Auth0
                stubUserRead((err, apiScopes) => {
                  if (err) return done.fail();

                  done();
                });
              });
            });
          });

          it('retrieves all living and constructed languages specified in the iso-639-3 spec', done => {
            authenticatedSession
              .get('/locale')
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200)
              .end((err, res) => {
                if (err) return done.fail(err);
                // 7027 living languages + 22 constructed
                expect(res.body.length).toEqual(7027 + 22);
                done();
              });
          });
        });

        describe('GET /locale/supported', () => {

          let supportedLanguages;

          beforeEach(done => {
            stubAuth0ManagementApi((err, apiScopes) => {
              if (err) return done.fail();

              login(_identity, [scope.read.agents], (err, session) => {
                if (err) return done.fail(err);
                authenticatedSession = session;

                // Cached profile doesn't match "live" data, so agent needs to be updated
                // with a call to Auth0
                stubUserRead((err, apiScopes) => {
                  if (err) return done.fail();

                  const languageDirectory = path.resolve(__dirname, '../../public/languages');
                  fs.readdir(languageDirectory, (err, files) => {
                    if (err) return done.fail();
                    // Gets rid of _hidden_ files and the like
                    supportedLanguages = files.filter(item => !(/(^|\/)\.[^\/\.]/g).test(item));
                    done();
                  });
                });
              });
            });
          });

          it('retrieves all the languages for which copy exists in /public/languages', done => {
            expect(supportedLanguages.length).toEqual(2);
            authenticatedSession
              .get('/locale/supported')
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200)
              .end((err, res) => {
                if (err) return done.fail(err);
                expect(res.body.length).toEqual(supportedLanguages.length);
                done();
              });
          });
        });
      });

      describe('update', () => {

        describe('PUT /locale/:code', () => {

          let userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope;
          describe('locale not set', () => {

            beforeEach(done => {
              expect(_profile.user_metadata).toBeUndefined();

              stubAuth0ManagementApi((err, apiScopes) => {
                if (err) return done.fail();

                login(_identity, [scope.update.agents], (err, session) => {

                  if (err) return done.fail(err);
                  authenticatedSession = session;

                  // Cached profile doesn't match "live" data, so agent needs to be updated
                  // with a call to Auth0
                  stubUserRead((err, apiScopes) => {
                    if (err) return done.fail();

                    stubUserAppMetadataUpdate((err, apiScopes) => {
                      if (err) return done.fail();
                      ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);

                      /**
                       * For redirect after locale update
                       */
                      stubAuth0ManagementApi((err, apiScopes) => {
                        if (err) return done.fail();

                        stubUserRead((err, apiScopes) => {
                          if (err) return done.fail();

                          stubUserRolesRead((err, apiScopes) => {
                            if (err) return done.fail();

                            done();
                          });
                        });
                      });
                    });
                  });
                });
              });
            });

            it('returns the agent\'s profile with the silLocale field', done => {
              authenticatedSession
                .put('/locale/tlh')
                .set('Accept', 'application/json')
                .redirects(1)
                .expect('Content-Type', /json/)
                .expect(200)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  expect(res.body.name).toEqual(_profile.name);
                  expect(res.body.email).toEqual(_profile.email);
                  expect(res.body.user_metadata.silLocale).toBeDefined();
                  expect(res.body.user_metadata.silLocale.name).toEqual('Klingon');
                  expect(res.body.user_metadata.silLocale.type).toEqual('constructed');
                  expect(res.body.user_metadata.silLocale.scope).toEqual('individual');
                  expect(res.body.user_metadata.silLocale.iso6393).toEqual('tlh');
                  expect(res.body.user_metadata.silLocale.iso6392B).toEqual('tlh');
                  expect(res.body.user_metadata.silLocale.iso6392T).toEqual('tlh');
                  done();
                });
            });

            it('redirects to the /agent route', done => {
              authenticatedSession
                .put('/locale/tlh')
                .set('Accept', 'application/json')
                .expect('Location', '/agent')
                .expect(303)
                .end(function(err, res) {
                  if (err) return done.fail(err);
                  done();
                });
            });

            it('returns a friendly message if an invalid ISO-639-3 code provided', done => {
              authenticatedSession
                .put('/locale/lmnop')
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(404)
                .end(function(err, res) {
                  if (err) return done.fail(err);
                  expect(res.body.message).toEqual('That language does not exist');
                  done();
                });
            });

            describe('Auth0', () => {
              it('is called to update the agent user_metadata', done => {
                authenticatedSession
                  .put('/locale/tlh')
                  .set('Accept', 'application/json')
                  .expect('Location', '/agent')
                  .expect(303)
                  .end(function(err, res) {
                    if (err) return done.fail(err);

                    expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(true);
                    expect(userAppMetadataUpdateScope.isDone()).toBe(true);
                    done();
                  });
              });
            });
          });

          describe('locale set', () => {

            beforeEach(done => {
              _profile.user_metadata = {
                silLocale: {
                  name: 'English',
                  type: 'living',
                  scope: 'individual',
                  iso6393: 'eng',
                  iso6392B: 'eng',
                  iso6392T: 'eng',
                  iso6391: 'en'
                }
              };

              stubAuth0ManagementApi((err, apiScopes) => {
                if (err) return done.fail();

                login(_identity, [scope.update.agents], (err, session) => {

                  if (err) return done.fail(err);
                  authenticatedSession = session;

                  // Cached profile doesn't match "live" data, so agent needs to be updated
                  // with a call to Auth0
                  stubUserRead((err, apiScopes) => {
                    if (err) return done.fail();

                    stubUserAppMetadataUpdate(_profile, (err, apiScopes) => {
                      if (err) return done.fail();
                      ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);

                      /**
                       * For redirect after locale update
                       */
                      stubAuth0ManagementApi((err, apiScopes) => {
                        if (err) return done.fail();

                        stubUserRead((err, apiScopes) => {
                          if (err) return done.fail();

                          stubUserRolesRead((err, apiScopes) => {
                            if (err) return done.fail();

                            done();
                          });
                        });
                      });
                    });
                  });
                });
              });
            });

            it('redirects to the /agent route', done => {
              authenticatedSession
                .put('/locale/tlh')
                .set('Accept', 'application/json')
                .expect('Location', '/agent')
                .expect(303)
                .end(function(err, res) {
                  if (err) return done.fail(err);
                  done();
                });
            });

            it('returns the agent\'s profile with the silLocale field', done => {
              authenticatedSession
                .put('/locale/tlh')
                .set('Accept', 'application/json')
                .redirects(1)
                .expect('Content-Type', /json/)
                .expect(200)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  expect(res.body.name).toEqual(_profile.name);
                  expect(res.body.email).toEqual(_profile.email);
                  expect(res.body.user_metadata.silLocale).toBeDefined();
                  expect(res.body.user_metadata.silLocale.name).toEqual('Klingon');
                  expect(res.body.user_metadata.silLocale.type).toEqual('constructed');
                  expect(res.body.user_metadata.silLocale.scope).toEqual('individual');
                  expect(res.body.user_metadata.silLocale.iso6393).toEqual('tlh');
                  expect(res.body.user_metadata.silLocale.iso6392B).toEqual('tlh');
                  expect(res.body.user_metadata.silLocale.iso6392T).toEqual('tlh');
                  done();
                });
            });

            it('returns a friendly message if an invalid ISO-639-3 code provided', done => {
              authenticatedSession
                .put('/locale/lmnop')
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(404)
                .end(function(err, res) {
                  if (err) return done.fail(err);
                  expect(res.body.message).toEqual('That language does not exist');
                  done();
                });
            });

            describe('Auth0', () => {
              it('is called to update the agent user_metadata', done => {
                authenticatedSession
                  .put('/locale/tlh')
                  .set('Accept', 'application/json')
                  .expect('Location', '/agent')
                  .expect(303)
                  .end(function(err, res) {
                    if (err) return done.fail(err);

                    expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(true);
                    expect(userAppMetadataUpdateScope.isDone()).toBe(true);
                    done();
                  });
              });

              it('is not called if the language is already assigned to the agent', done => {
                expect(_profile.user_metadata.silLocale.iso6393).toEqual('eng');
                authenticatedSession
                  .put('/locale/eng')
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(200)
                  .end(function(err, res) {
                    if (err) return done.fail(err);

                    expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
                    expect(userAppMetadataUpdateScope.isDone()).toBe(false);
                    done();
                  });
              });
            });
          });
        });
      });
    });
  });

  describe('not authenticated', () => {
    it('redirects to login', done => {
      request(app)
        .get('/locale')
        .set('Accept', 'application/json')
        .expect(302)
        .end(function(err, res) {
          if (err) return done.fail(err);
          expect(res.headers.location).toEqual('/login');
          done();
        });
    });
  });
});
