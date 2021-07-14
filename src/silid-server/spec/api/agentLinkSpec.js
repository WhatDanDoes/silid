const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001;
const app = require('../../app');
const fixtures = require('sequelize-fixtures');
const models = require('../../models');
const request = require('supertest');
const nock = require('nock');
const stubAuth0Sessions = require('../support/stubAuth0Sessions');
const stubAuth0ManagementApi = require('../support/stubAuth0ManagementApi');
const stubAuth0ManagementEndpoint = require('../support/stubAuth0ManagementEndpoint');
const stubUserAppMetadataUpdate = require('../support/auth0Endpoints/stubUserAppMetadataUpdate');
const stubUserRead = require('../support/auth0Endpoints/stubUserRead');
const stubUserCreate = require('../support/auth0Endpoints/stubUserCreate');
const stubUserRolesRead = require('../support/auth0Endpoints/stubUserRolesRead');
const stubEmailVerification = require('../support/auth0Endpoints/stubEmailVerification');
const stubUserReadByEmail = require('../support/auth0Endpoints/stubUserReadByEmail');
const stubUserLinkAccount = require('../support/auth0Endpoints/stubUserLinkAccount');
const scope = require('../../config/permissions');
const apiScope = require('../../config/apiPermissions');
const jwt = require('jsonwebtoken');

const _profile = require('../fixtures/sample-auth0-profile-response');

describe('agentLinkSpec', () => {

  /**
   * 2019-11-13
   * Sample tokens taken from:
   *
   * https://auth0.com/docs/api-auth/tutorials/adoption/api-tokens
   */
  const _identity = { ...require('../fixtures/sample-auth0-identity-token'), iss: `https://${process.env.AUTH0_CUSTOM_DOMAIN}/`};
  const _access = require('../fixtures/sample-auth0-access-token');

  let login, pub, prv, keystore,
      agent;

  beforeEach(done => {
    stubAuth0Sessions((err, sessionStuff) => {
      if (err) return done.fail(err);
      ({ login, pub, prv, keystore } = sessionStuff);

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
  });

  describe('authenticated', () => {

    describe('authorized', () => {

      let authenticatedSession, accessToken;

      describe('/agent/profiles', () => {

        describe('email verified', () => {

          beforeEach(done => {
            stubAuth0ManagementApi((err, apiScopes) => {
              if (err) return done.fail(err);

              login(_identity, [scope.read.agents], (err, session, token) => {
                if (err) return done.fail(err);
                accessToken = token;
                authenticatedSession = session;

                done();
              });
            });
          });

          describe('no linkable accounts', () => {

            beforeEach(done => {
              // No accounts with matching email
              stubUserReadByEmail((err, apiScopes) => {
                if (err) return done.fail(err);
                ({userReadByEmailScope, userReadByEmailOauthTokenScope} = apiScopes);

                done();
              });
            });

            describe('session access', () => {

              it('returns the lone agent profile', done => {
                authenticatedSession
                  .get('/agent/profiles')
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(200)
                  .end((err, res) => {
                    if (err) return done.fail(err);

                    expect(res.body).toEqual([_profile]);
                    done();
                  });
              });

              describe('Auth0', () => {

                it('is called to retrieve all profiles with the same email as the primary account', done => {
                  authenticatedSession
                    .get('/agent/profiles')
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(200)
                    .end((err, res) => {
                      if (err) return done.fail(err);
                      expect(userReadByEmailScope.isDone()).toBe(true);
                      expect(userReadByEmailOauthTokenScope.isDone()).toBe(false);
                      done();
                    });
                });
              });
            });

            describe('Bearer token access', () => {

              beforeEach(() => {
                const userInfoScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
                  .get(/userinfo/)
                  .reply(200, {..._identity, permissions: [scope.read.agents] });
              });

              it('returns the lone agent profile', done => {
                request(app)
                  .get('/agent/profiles')
                  .set('Authorization', `Bearer ${accessToken}`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(200)
                  .end((err, res) => {
                    if (err) return done.fail(err);

                    expect(res.body).toEqual([_profile]);
                    done();
                  });
              });

              describe('Auth0', () => {

                it('is called to retrieve all profiles with the same email as the primary account', done => {
                  request(app)
                    .get('/agent/profiles')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(200)
                    .end((err, res) => {
                      if (err) return done.fail(err);
                      expect(userReadByEmailScope.isDone()).toBe(true);
                      expect(userReadByEmailOauthTokenScope.isDone()).toBe(false);
                      done();
                    });
                });
              });
            });
          });

          describe('linkable accounts exist', () => {

            beforeEach(done => {
              stubUserReadByEmail([_profile, {..._profile, email: 'someotherguy@example.com' }], (err, apiScopes) => {
                if (err) return done.fail(err);
                ({userReadByEmailScope, userReadByEmailOauthTokenScope} = apiScopes);

                done();
              });
            });

            describe('session access', () => {

              it('returns the lone agent profile', done => {
                authenticatedSession
                  .get('/agent/profiles')
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(200)
                  .end((err, res) => {
                    if (err) return done.fail(err);

                    expect(res.body.length).toEqual(2);
                    expect(res.body[0].email).toEqual(_profile.email);
                    expect(res.body[0].email_verified).toBe(true);
                    expect(res.body[1].email).toEqual('someotherguy@example.com');
                    expect(res.body[1].email_verified).toBe(true);

                    done();
                  });
              });

              describe('Auth0', () => {

                it('is called to retrieve all profiles with the same email as the primary account', done => {
                  authenticatedSession
                    .get('/agent/profiles')
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(200)
                    .end((err, res) => {
                      if (err) return done.fail(err);
                      expect(userReadByEmailScope.isDone()).toBe(true);
                      expect(userReadByEmailOauthTokenScope.isDone()).toBe(false);
                      done();
                    });
                });
              });
            });

            describe('Bearer token access', () => {

              beforeEach(() => {
                const userInfoScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
                  .get(/userinfo/)
                  .reply(200, {..._identity, permissions: [scope.read.agents] });
              });

              it('returns the lone agent profile', done => {
                request(app)
                  .get('/agent/profiles')
                  .set('Authorization', `Bearer ${accessToken}`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(200)
                  .end((err, res) => {
                    if (err) return done.fail(err);

                    expect(res.body.length).toEqual(2);
                    expect(res.body[0].email).toEqual(_profile.email);
                    expect(res.body[0].email_verified).toBe(true);
                    expect(res.body[1].email).toEqual('someotherguy@example.com');
                    expect(res.body[1].email_verified).toBe(true);

                    done();
                  });
              });

              describe('Auth0', () => {

                it('is called to retrieve all profiles with the same email as the primary account', done => {
                  request(app)
                    .get('/agent/profiles')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(200)
                    .end((err, res) => {
                      if (err) return done.fail(err);
                      expect(userReadByEmailScope.isDone()).toBe(true);
                      expect(userReadByEmailOauthTokenScope.isDone()).toBe(false);
                      done();
                    });
                });
              });
            });
          });

          describe('linkable account not verified', () => {

            beforeEach(done => {
              stubUserReadByEmail([
                _profile,
                {..._profile, email: 'someotherguy@example.com', email_verified: false },
                {..._profile, email: 'someverifiedguy@example.com' },
              ], (err, apiScopes) => {
                if (err) return done.fail(err);
                ({userReadByEmailScope, userReadByEmailOauthTokenScope} = apiScopes);

                done();
              });
            });

            describe('session access', () => {

              it('returns the lone agent profile', done => {
                authenticatedSession
                  .get('/agent/profiles')
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(200)
                  .end((err, res) => {
                    if (err) return done.fail(err);

                    expect(res.body.length).toEqual(2);
                    expect(res.body[0].email).toEqual(_profile.email);
                    expect(res.body[0].email_verified).toBe(true);
                    expect(res.body[1].email).toEqual('someverifiedguy@example.com');
                    expect(res.body[1].email_verified).toBe(true);

                    done();
                  });
              });

              describe('Auth0', () => {

                it('is called to retrieve all profiles with the same email as the primary account', done => {
                  authenticatedSession
                    .get('/agent/profiles')
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(200)
                    .end((err, res) => {
                      if (err) return done.fail(err);
                      expect(userReadByEmailScope.isDone()).toBe(true);
                      expect(userReadByEmailOauthTokenScope.isDone()).toBe(false);
                      done();
                    });
                });
              });
            });

            describe('Bearer token access', () => {

              beforeEach(() => {
                const userInfoScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
                  .get(/userinfo/)
                  .reply(200, {..._identity, permissions: [scope.read.agents] });
              });

              it('returns the lone agent profile', done => {
                request(app)
                  .get('/agent/profiles')
                  .set('Authorization', `Bearer ${accessToken}`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(200)
                  .end((err, res) => {
                    if (err) return done.fail(err);

                    expect(res.body.length).toEqual(2);
                    expect(res.body[0].email).toEqual(_profile.email);
                    expect(res.body[0].email_verified).toBe(true);
                    expect(res.body[1].email).toEqual('someverifiedguy@example.com');
                    expect(res.body[1].email_verified).toBe(true);

                    done();
                  });
              });

              describe('Auth0', () => {

                it('is called to retrieve all profiles with the same email as the primary account', done => {
                  request(app)
                    .get('/agent/profiles')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(200)
                    .end((err, res) => {
                      if (err) return done.fail(err);
                      expect(userReadByEmailScope.isDone()).toBe(true);
                      expect(userReadByEmailOauthTokenScope.isDone()).toBe(false);
                      done();
                    });
                });
              });
            });
          });
        });

        describe('primary email not verified', () => {

          beforeEach(done => {
            stubAuth0ManagementApi({userRead: {..._profile, email_verified: false}}, (err, apiScopes) => {
              if (err) return done.fail(err);

              login(_identity, [scope.read.agents], (err, session, token) => {
                if (err) return done.fail(err);
                accessToken = token;
                authenticatedSession = session;

                stubUserReadByEmail([_profile, {..._profile, email: 'someotherguy@example.com' }], (err, apiScopes) => {
                  if (err) return done.fail(err);
                  ({userReadByEmailScope, userReadByEmailOauthTokenScope} = apiScopes);

                  done();
                });
              });
            });
          });

          describe('session access', () => {

            it('returns 401 unauthenticated', done => {
              authenticatedSession
                .get('/agent/profiles')
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(401)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  expect(res.body.message).toEqual('Check your email to verify your account');
                  done();
                });
            });

            describe('Auth0', () => {

              it('is not called', done => {
                authenticatedSession
                  .get('/agent/profiles')
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(401)
                  .end((err, res) => {
                    if (err) return done.fail(err);

                    expect(userReadByEmailOauthTokenScope.isDone()).toBe(false);
                    expect(userReadByEmailScope.isDone()).toBe(false);
                    done();
                  });
              });
            });
          });

          describe('Bearer token access', () => {

            beforeEach(() => {
              const userInfoScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
                .get(/userinfo/)
                .reply(200, {..._identity, permissions: [scope.read.agents], email_verified: false });
            });

            it('returns 401 unauthenticated', done => {
              request(app)
                .post('/agent')
                .send({
                  email: 'someotherguy@example.com'
                })
                .set('Authorization', `Bearer ${accessToken}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(401)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  expect(res.body.message).toEqual('Check your email to verify your account');
                  done();
                });
            });

            describe('Auth0', () => {

              it('is not called', done => {
                request(app)
                  .post('/agent')
                  .send({
                    email: 'someotherguy@example.com'
                  })
                  .set('Authorization', `Bearer ${accessToken}`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(401)
                  .end((err, res) => {
                    if (err) return done.fail(err);

                    expect(userReadByEmailOauthTokenScope.isDone()).toBe(false);
                    expect(userReadByEmailScope.isDone()).toBe(false);
                    done();
                  });
              });
            });
          });
        });
      });

      describe('/agent/link', () => {

        describe('email verified', () => {

          beforeEach(done => {
            stubAuth0ManagementApi((err, apiScopes) => {
              if (err) return done.fail(err);

              login(_identity, [scope.update.agents], (err, session, token) => {
                if (err) return done.fail(err);
                accessToken = token;
                authenticatedSession = session;

                done();
              });
            });
          });

          describe('secondary account does not exist', () => {

            beforeEach(done => {
              // No accounts with matching email
              stubUserLinkAccount({..._profile}, {
                ..._profile,
                email: 'thesameguy@example.com',
                identities: [{
                  connection: 'twitter',
                  user_id: 'abc-123',
                  provider: 'twitter',
                }]
              }, { status: 400 }, (err, apiScopes) => {
                if (err) return done.fail(err);
                ({userLinkAccountScope, userLinkAccountOauthTokenScope} = apiScopes);

                done();
              });
            });

            describe('session access', () => {

              it('returns an error', done => {
                authenticatedSession
                  .put('/agent/link')
                  .send({
                    connection: 'twitter',
                    user_id: 'abc-123',
                    provider: 'twitter',
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(400)
                  .end((err, res) => {
                    if (err) return done.fail(err);

                    expect(res.body.message).toEqual('Some error occurred');
                    done();
                  });
              });

              describe('Auth0', () => {

                it('is called to attempt linking the secondary account to the primary account', done => {
                  authenticatedSession
                   .put('/agent/link')
                   .send({
                     connection: 'twitter',
                     user_id: 'abc-123',
                     provider: 'twitter',
                   })
                   .set('Accept', 'application/json')
                   .expect('Content-Type', /json/)
                   .expect(400)
                   .end((err, res) => {
                     if (err) return done.fail(err);
                     expect(userReadByEmailScope.isDone()).toBe(true);
                     expect(userReadByEmailOauthTokenScope.isDone()).toBe(true);
                     done();
                   });
                });
              });
            });

            describe('Bearer token access', () => {

              beforeEach(() => {
                const userInfoScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
                  .get(/userinfo/)
                  .reply(200, {..._identity, permissions: [scope.update.agents] });
              });

              it('returns an error', done => {
                request(app)
                  .put('/agent/link')
                  .send({
                    connection: 'twitter',
                    user_id: 'abc-123',
                    provider: 'twitter',
                  })
                  .set('Authorization', `Bearer ${accessToken}`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(400)
                  .end((err, res) => {
                    if (err) return done.fail(err);

                    expect(res.body.message).toEqual('Some error occurred');
                    done();
                  });
              });

              describe('Auth0', () => {

                it('is called to attempt linking the secondary account to the primary account', done => {
                  request(app)
                    .put('/agent/link')
                    .send({
                      connection: 'twitter',
                      user_id: 'abc-123',
                      provider: 'twitter',
                    })
                    .set('Authorization', `Bearer ${accessToken}`)
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(400)
                    .end((err, res) => {
                      if (err) return done.fail(err);
                      expect(userReadByEmailScope.isDone()).toBe(true);
                      expect(userReadByEmailOauthTokenScope.isDone()).toBe(true);
                      done();
                    });
                });
              });
            });
          });

          describe('secondary account exists', () => {

            beforeEach(done => {
              stubUserLinkAccount({..._profile}, {
                ..._profile,
                email: 'thesameguy@example.com',
                identities: [{
                  connection: 'twitter',
                  user_id: 'abc-123',
                  provider: 'twitter',
                }]
              }, (err, apiScopes) => {
                if (err) return done.fail(err);
                ({userLinkAccountScope, userLinkAccountOauthTokenScope} = apiScopes);

                done();
              });
            });

            describe('session access', () => {

              it('returns the identities array', done => {
                authenticatedSession
                  .put('/agent/link')
                  .send({
                    connection: 'twitter',
                    user_id: 'abc-123',
                    provider: 'twitter',
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end((err, res) => {
                    if (err) return done.fail(err);

                    expect(res.body.length).toEqual(2);
                    expect(res.body[0]).toEqual(_profile.identities[0]);
                    expect(res.body[1].profileData.email).toEqual('thesameguy@example.com');

                    done();
                  });
              });

              describe('Auth0', () => {

                it('is called to link the secondary account to the primary', done => {
                  authenticatedSession
                    .put('/agent/link')
                    .send({
                      connection: 'twitter',
                      user_id: 'abc-123',
                      provider: 'twitter',
                    })
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end((err, res) => {
                      if (err) return done.fail(err);
                      expect(userLinkAccountScope.isDone()).toBe(true);
                      expect(userLinkAccountOauthTokenScope.isDone()).toBe(true);
                      done();
                    });
                });
              });
            });

            describe('Bearer token access', () => {

              beforeEach(() => {
                const userInfoScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
                  .get(/userinfo/)
                  .reply(200, {..._identity, permissions: [scope.read.agents] });
              });

              it('returns the identities array', done => {
                request(app)
                  .put('/agent/link')
                  .send({
                    connection: 'twitter',
                    user_id: 'abc-123',
                    provider: 'twitter',
                  })
                  .set('Authorization', `Bearer ${accessToken}`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end((err, res) => {
                    if (err) return done.fail(err);

                    expect(res.body.length).toEqual(2);
                    expect(res.body[0]).toEqual(_profile.identities[0]);
                    expect(res.body[1].profileData.email).toEqual('thesameguy@example.com');

                    done();
                  });
              });

              describe('Auth0', () => {

                it('is called to link the secondary account to the primary', done => {
                  request(app)
                    .put('/agent/link')
                    .send({
                      connection: 'twitter',
                      user_id: 'abc-123',
                      provider: 'twitter',
                    })
                    .set('Authorization', `Bearer ${accessToken}`)
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end((err, res) => {
                      if (err) return done.fail(err);
                      expect(userReadByEmailScope.isDone()).toBe(true);
                      expect(userReadByEmailOauthTokenScope.isDone()).toBe(true);
                      done();
                    });
                });
              });
            });
          });
        });
      });
    });

    describe('forbidden', () => {

//      let originalProfile, forbiddenSession;
//      beforeEach(done => {
//        originalProfile = {..._profile};
//        _profile.email = 'someotherguy@example.com';
//        _profile.name = 'Some Other Guy';
//
//        stubAuth0ManagementApi((err, apiScopes) => {
//          if (err) return done.fail(err);
//
//         login({ ..._identity, email: 'someotherguy@example.com', name: 'Some Other Guy' }, (err, session) => {
//            if (err) return done.fail(err);
//            forbiddenSession = session;
//
//            done();
//          });
//        });
//      });
//
//      afterEach(() => {
//        // Through the magic of node I am able to adjust the profile data returned.
//        // This resets the default values
//        _profile.email = originalProfile.email;
//        _profile.name = originalProfile.name;
//      });
//
//      describe('delete', () => {
//
//        it('returns 403', done => {
//          forbiddenSession
//            .delete('/agent')
//            .send({
//              id: agent.id
//            })
//            .set('Accept', 'application/json')
//            .expect('Content-Type', /json/)
//            .expect(403)
//            .end((err, res) => {
//              if (err) done.fail(err);
//              expect(res.body.message).toEqual('Insufficient scope');
//              done();
//            });
//        });
//
//        it('does not remove the record from the database', done => {
//          models.Agent.findAll().then(results => {
//            // 2 because the unauthorized agent is in the database
//            expect(results.length).toEqual(2);
//
//            forbiddenSession
//              .delete('/agent')
//              .send({
//                id: agent.id
//              })
//              .set('Accept', 'application/json')
//              .expect('Content-Type', /json/)
//              .expect(403)
//              .end((err, res) => {
//                if (err) done.fail(err);
//                models.Agent.findAll().then(results => {
//                  expect(results.length).toEqual(2);
//                  done();
//                }).catch(err => {
//                  done.fail(err);
//                });
//              });
//          }).catch(err => {
//            done.fail(err);
//          });
//        });
//      });
    });
  });

  describe('unauthenticated', () => {

//    it('redirects to login', done => {
//      request(app)
//        .get('/agent')
//        .set('Accept', 'application/json')
//        .expect(302)
//        .end((err, res) => {
//          if (err) return done.fail(err);
//          expect(res.headers.location).toEqual('/login');
//          done();
//        });
//    });
  });
});
