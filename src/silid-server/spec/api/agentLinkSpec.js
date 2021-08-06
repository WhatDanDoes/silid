const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001;
const app = require('../../app');
const fixtures = require('sequelize-fixtures');
const models = require('../../models');
const request = require('supertest');
const nock = require('nock');
const stubAuth0Sessions = require('../support/stubAuth0Sessions');
const stubAuth0ManagementApi = require('../support/stubAuth0ManagementApi');
const stubUserReadByEmail = require('../support/auth0Endpoints/stubUserReadByEmail');
const stubUserLinkAccount = require('../support/auth0Endpoints/stubUserLinkAccount');
const stubUserUnlinkAccount = require('../support/auth0Endpoints/stubUserUnlinkAccount');
const stubUserAppMetadataUpdate = require('../support/auth0Endpoints/stubUserAppMetadataUpdate');
const scope = require('../../config/permissions');
const apiScope = require('../../config/apiPermissions');

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

              it('returns the lone profile (in real life)', done => {
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

              it('returns the lone profile (in real life)', done => {
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

          describe('linkable account exists', () => {

            beforeEach(done => {
              stubUserReadByEmail([
                {
                  ..._profile,
                },
                {
                  ..._profile,
                  email: 'pretendthisisthesameemail@example.com'
                }
              ], (err, apiScopes) => {
                if (err) return done.fail(err);
                ({userReadByEmailScope, userReadByEmailOauthTokenScope} = apiScopes);

                done();
              });
            });

            describe('session access', () => {

              it('returns all matching agent profiles (in real life)', done => {
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
                    expect(res.body[1].email).toEqual('pretendthisisthesameemail@example.com');
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

              it('returns all matching agent profiles (in real life)', done => {
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
                    expect(res.body[1].email).toEqual('pretendthisisthesameemail@example.com');
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

              it('returns all matching agent profiles (in real life)', done => {
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

              it('returns all matching agent profiles (in real life)', done => {
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
                .get('/agent/profiles')
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
                  .get('/agent/profiles')
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

        let userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope;
        let secondaryProfile;

        beforeEach(() => {
          secondaryProfile = {
            ..._profile,
            email: 'thesameguy@example.com',
            identities: [{
              connection: 'twitter',
              user_id: 'abc-123',
              provider: 'twitter',
            }]
          };
        });

        describe('email verified', () => {

          beforeEach(done => {

            stubAuth0ManagementApi((err, apiScopes) => {
              if (err) return done.fail(err);

              login(_identity, [scope.update.agents], (err, session, token) => {
                if (err) return done.fail(err);
                accessToken = token;
                authenticatedSession = session;

                // For removing the `manually_unlinked` flag
                stubUserAppMetadataUpdate(secondaryProfile, (err, apiScopes) => {
                  if (err) return done.fail(err);
                  ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);

                  done();
                });
              });
            });
          });

          describe('secondary account does not exist', () => {

            beforeEach(done => {
              // No accounts with matching email
              stubUserLinkAccount({..._profile}, secondaryProfile, { status: 400 }, (err, apiScopes) => {
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
                    // From where do I get connection_id?
                    //connection_id: 'twitter',
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
                     // From where do I get connection_id?
                     //connection_id: 'twitter',
                     user_id: 'abc-123',
                     provider: 'twitter',
                   })
                   .set('Accept', 'application/json')
                   .expect('Content-Type', /json/)
                   .expect(400)
                   .end((err, res) => {
                     if (err) return done.fail(err);
                     expect(userLinkAccountScope.isDone()).toBe(true);
                     expect(userLinkAccountOauthTokenScope.isDone()).toBe(true);
                     done();
                   });
                });

                it('is not called to update user_metadata on the non-existant secondary account', done => {
                  authenticatedSession
                   .put('/agent/link')
                   .send({
                     // From where do I get connection_id?
                     //connection_id: 'twitter',
                     user_id: 'abc-123',
                     provider: 'twitter',
                   })
                   .set('Accept', 'application/json')
                   .expect('Content-Type', /json/)
                   .expect(400)
                   .end((err, res) => {
                     if (err) return done.fail(err);
                     expect(userAppMetadataUpdateScope.isDone()).toBe(false);
                     expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
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
                    // From where do I get connection_id?
                    //connection_id: 'twitter',
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
                      // From where do I get connection_id?
                      //connection_id: 'twitter',
                      user_id: 'abc-123',
                      provider: 'twitter',
                    })
                    .set('Authorization', `Bearer ${accessToken}`)
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(400)
                    .end((err, res) => {
                      if (err) return done.fail(err);
                      expect(userLinkAccountScope.isDone()).toBe(true);
                      expect(userLinkAccountOauthTokenScope.isDone()).toBe(true);
                      done();
                    });
                });

                it('is not called to update user_metadata on the non-existant secondary account', done => {
                  request(app)
                   .put('/agent/link')
                   .send({
                     // From where do I get connection_id?
                     //connection_id: 'twitter',
                     user_id: 'abc-123',
                     provider: 'twitter',
                   })
                   .set('Authorization', `Bearer ${accessToken}`)
                   .set('Accept', 'application/json')
                   .expect('Content-Type', /json/)
                   .expect(400)
                   .end((err, res) => {
                     if (err) return done.fail(err);
                     expect(userAppMetadataUpdateScope.isDone()).toBe(false);
                     expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
                     done();
                   });
                });
              });
            });
          });

          describe('secondary account exists', () => {

            beforeEach(done => {
              stubUserLinkAccount({..._profile}, secondaryProfile, (err, apiScopes) => {
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
                    // From where do I get connection_id?
                    //connection_id: 'twitter',
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
                      // From where do I get connection_id?
                      //connection_id: 'twitter',
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

                it('is called to update user_metadata on the secondary account', done => {
                  authenticatedSession
                   .put('/agent/link')
                   .send({
                     // From where do I get connection_id?
                     //connection_id: 'twitter',
                     user_id: 'abc-123',
                     provider: 'twitter',
                   })
                   .set('Accept', 'application/json')
                   .expect('Content-Type', /json/)
                   .expect(201)
                   .end((err, res) => {
                     if (err) return done.fail(err);
                     expect(userAppMetadataUpdateScope.isDone()).toBe(true);
                     expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
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
                    // From where do I get connection_id?
                    //connection_id: 'twitter',
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
                      // From where do I get connection_id?
                      //connection_id: 'twitter',
                      user_id: 'abc-123',
                      provider: 'twitter',
                    })
                    .set('Authorization', `Bearer ${accessToken}`)
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

                it('is called to remove manually_unlinked from the secondary user_metadata', done => {
                  request(app)
                    .put('/agent/link')
                    .send({
                      // From where do I get connection_id?
                      //connection_id: 'twitter',
                      user_id: 'abc-123',
                      provider: 'twitter',
                    })
                    .set('Authorization', `Bearer ${accessToken}`)
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end((err, res) => {
                      if (err) return done.fail(err);
                      expect(userAppMetadataUpdateScope.isDone()).toBe(true);
                      expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
                      done();
                    });
                });
              });
            });
          });

          describe('secondary account was previously manually_unlinked', () => {

            beforeEach(done => {
              secondaryProfile.user_metadata = { manually_unlinked: true }
              stubUserLinkAccount({..._profile}, secondaryProfile, (err, apiScopes) => {
                if (err) return done.fail(err);
                ({userLinkAccountScope, userLinkAccountOauthTokenScope} = apiScopes);

                done();
              });
            });

            describe('session access', () => {

              it('returns the identities array', done => {
                expect(secondaryProfile.user_metadata.manually_unlinked).toBe(true);
                authenticatedSession
                  .put('/agent/link')
                  .send({
                    // From where do I get connection_id?
                    //connection_id: 'twitter',
                    user_id: 'abc-123',
                    provider: 'twitter',
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end((err, res) => {
                    if (err) return done.fail(err);

                    // The null value erases the user_metdata property at Auth0
                    expect(secondaryProfile.user_metadata.manually_unlinked).toEqual(null);

                    done();
                  });
              });
            });

            describe('Bearer token access', () => {

              beforeEach(() => {
                const userInfoScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
                  .get(/userinfo/)
                  .reply(200, {..._identity, permissions: [scope.read.agents] });
              });

              it('is called to link the secondary account to the primary', done => {
                expect(secondaryProfile.user_metadata.manually_unlinked).toBe(true);
                request(app)
                  .put('/agent/link')
                  .send({
                    // From where do I get connection_id?
                    //connection_id: 'twitter',
                    user_id: 'abc-123',
                    provider: 'twitter',
                  })
                  .set('Authorization', `Bearer ${accessToken}`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end((err, res) => {
                    if (err) return done.fail(err);

                    // The null value erases the user_metdata property at Auth0
                    expect(secondaryProfile.user_metadata.manually_unlinked).toEqual(null);

                    done();
                  });
              });
            });
          });
        });

        describe('email not verified', () => {

          beforeEach(done => {
            stubAuth0ManagementApi({userRead: {..._profile, email_verified: false}}, (err, apiScopes) => {
              if (err) return done.fail(err);

              login(_identity, [scope.read.agents], (err, session, token) => {
                if (err) return done.fail(err);
                accessToken = token;
                authenticatedSession = session;

                stubUserLinkAccount({..._profile}, secondaryProfile, (err, apiScopes) => {
                  if (err) return done.fail(err);
                  ({userLinkAccountScope, userLinkAccountOauthTokenScope} = apiScopes);

                  // For removing the `manually_unlinked` flag
                  stubUserAppMetadataUpdate(secondaryProfile, (err, apiScopes) => {
                    if (err) return done.fail(err);
                    ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);

                    done();
                  });
                });
              });
            });
          });

          describe('session access', () => {

            it('returns an error', done => {
              authenticatedSession
                .put('/agent/link')
                .send({
                  // From where do I get connection_id?
                  //connection_id: 'twitter',
                  user_id: 'abc-123',
                  provider: 'twitter',
                })
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

              it('is not called link the secondary account to the primary account', done => {
                authenticatedSession
                 .put('/agent/link')
                 .send({
                   // From where do I get connection_id?
                   //connection_id: 'twitter',
                   user_id: 'abc-123',
                   provider: 'twitter',
                 })
                 .set('Accept', 'application/json')
                 .expect('Content-Type', /json/)
                 .expect(401)
                 .end((err, res) => {
                   if (err) return done.fail(err);
                   expect(userLinkAccountScope.isDone()).toBe(false);
                   expect(userLinkAccountOauthTokenScope.isDone()).toBe(false);
                   done();
                 });
              });

              it('is not called to remove manually_unlinked from the secondary user_metadata', done => {
                authenticatedSession
                  .put('/agent/link')
                  .send({
                    // From where do I get connection_id?
                    //connection_id: 'twitter',
                    user_id: 'abc-123',
                    provider: 'twitter',
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(401)
                  .end((err, res) => {
                    if (err) return done.fail(err);
                    expect(userAppMetadataUpdateScope.isDone()).toBe(false);
                    expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
                    done();
                  });
              });
            });
          });

          describe('Bearer token access', () => {

            beforeEach(() => {
              const userInfoScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
                .get(/userinfo/)
                .reply(200, {..._identity, permissions: [scope.update.agents], email_verified: false });
            });

            it('returns an error', done => {
              request(app)
                .put('/agent/link')
                .send({
                  // From where do I get connection_id?
                  //connection_id: 'twitter',
                  user_id: 'abc-123',
                  provider: 'twitter',
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

              it('is called to attempt linking the secondary account to the primary account', done => {
                request(app)
                  .put('/agent/link')
                  .send({
                    // From where do I get connection_id?
                    //connection_id: 'twitter',
                    user_id: 'abc-123',
                    provider: 'twitter',
                  })
                  .set('Authorization', `Bearer ${accessToken}`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(401)
                  .end((err, res) => {
                    if (err) return done.fail(err);
                    expect(userLinkAccountScope.isDone()).toBe(false);
                    expect(userLinkAccountOauthTokenScope.isDone()).toBe(false);

                    done();
                  });
              });

              it('is not called to remove manually_unlinked from the secondary user_metadata', done => {
                request(app)
                  .put('/agent/link')
                  .send({
                    // From where do I get connection_id?
                    //connection_id: 'twitter',
                    user_id: 'abc-123',
                    provider: 'twitter',
                  })
                  .set('Authorization', `Bearer ${accessToken}`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(401)
                  .end((err, res) => {
                    if (err) return done.fail(err);
                    expect(userAppMetadataUpdateScope.isDone()).toBe(false);
                    expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
                    done();
                  });
              });
            });
          });
        });
      });

      describe('/agent/unlink', () => {

        const _identities = [
          {
            provider: 'google-oauth2',
            user_id: '117550400000000000000',
            connection: 'google-oauth2',
            isSocial: true
          },
          {
            connection: 'twitter',
            user_id: 'abc-123',
            provider: 'twitter',
            profileData: {
              email: 'thesameguy@example.com',
              email_verified: true,
              name: 'Some Guy',
              given_name: 'Some',
              family_name: 'Guy'
            }
          }
        ];

        let profile, secondaryProfile;

        beforeEach(done => {
          profile = {..._profile, identities: _identities};
          secondaryProfile = {..._profile, email: 'thesameguy@example.com', user_id: 'twitter|abc-123'};

          stubAuth0ManagementApi({userRead: {..._profile, identities: _identities}}, (err, apiScopes) => {
            if (err) return done.fail(err);

            login(_identity, [scope.update.agents], (err, session, token) => {
              if (err) return done.fail(err);

              accessToken = token;
              authenticatedSession = session;

              // For setting `manually_unlinked` flag
              stubUserAppMetadataUpdate(secondaryProfile, (err, apiScopes) => {
                if (err) return done.fail(err);
                ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);

                done();
              });
            });
          });
        });

        describe('general error handling (e.g., secondary account does not exist)', () => {

          beforeEach(done => {
            // No accounts with matching email
            stubUserUnlinkAccount(profile, { status: 400 }, (err, apiScopes) => {
              if (err) return done.fail(err);
              ({userUnlinkAccountScope, userUnlinkAccountOauthTokenScope} = apiScopes);

              done();
            });
          });

          describe('session access', () => {

            it('returns an error', done => {
              authenticatedSession
                .delete(`/agent/link/twitter/abc-123`)
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

              it('is called to attempt unlinking the secondary account from the primary account', done => {
                authenticatedSession
                 .delete(`/agent/link/twitter/abc-123`)
                 .set('Accept', 'application/json')
                 .expect('Content-Type', /json/)
                 .expect(400)
                 .end((err, res) => {
                   if (err) return done.fail(err);
                   expect(userUnlinkAccountScope.isDone()).toBe(true);
                   expect(userUnlinkAccountOauthTokenScope.isDone()).toBe(true);
                   done();
                 });
              });

              it('is not called to update the user_metadata', done => {
                authenticatedSession
                 .delete(`/agent/link/twitter/abc-123`)
                 .set('Accept', 'application/json')
                 .expect('Content-Type', /json/)
                 .expect(400)
                 .end((err, res) => {
                   if (err) return done.fail(err);
                   expect(userAppMetadataUpdateScope.isDone()).toBe(false);
                   expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
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
                .delete(`/agent/link/twitter/abc-123`)
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

              it('is called to attempt unlinking the secondary account from the primary account', done => {
                request(app)
                  .delete(`/agent/link/twitter/abc-123`)
                  .set('Authorization', `Bearer ${accessToken}`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(400)
                  .end((err, res) => {
                    if (err) return done.fail(err);
                    expect(userUnlinkAccountScope.isDone()).toBe(true);
                    expect(userUnlinkAccountOauthTokenScope.isDone()).toBe(true);
                    done();
                  });
              });

              it('is not called to update the user_metadata', done => {
                request(app)
                 .delete(`/agent/link/twitter/abc-123`)
                 .set('Authorization', `Bearer ${accessToken}`)
                 .set('Accept', 'application/json')
                 .expect('Content-Type', /json/)
                 .expect(400)
                 .end((err, res) => {
                   if (err) return done.fail(err);
                   expect(userAppMetadataUpdateScope.isDone()).toBe(false);
                   expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
                   done();
                 });
              });
            });
          });
        });

        describe('successfully', () => {

          beforeEach(done => {
            // No accounts with matching email
            stubUserUnlinkAccount(profile, (err, apiScopes) => {
              if (err) return done.fail(err);
              ({userUnlinkAccountScope, userUnlinkAccountOauthTokenScope} = apiScopes);

              done();
            });
          });

          describe('session access', () => {

            it('returns the new unlinked identity array', done => {
              authenticatedSession
                .delete(`/agent/link/twitter/abc-123`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  expect(res.body.length).toEqual(1);
                  expect(res.body[0].connection).toEqual(_identities[0].connection);
                  expect(res.body[0].provider).toEqual('google-oauth2');

                  done();
                });
            });

            it('sets the `manually_unlinked` flag in `user_metadata`', done => {
              expect(secondaryProfile.user_metadata).toBeUndefined();

              authenticatedSession
                .delete(`/agent/link/twitter/abc-123`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  expect(secondaryProfile.user_metadata.manually_unlinked).toBe(true);

                  done();
                });
            });

            describe('Auth0', () => {

              it('is called to unlink the secondary account from the primary', done => {
                authenticatedSession
                  .delete(`/agent/link/twitter/abc-123`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(200)
                  .end((err, res) => {
                    if (err) return done.fail(err);
                    expect(userUnlinkAccountScope.isDone()).toBe(true);
                    expect(userUnlinkAccountOauthTokenScope.isDone()).toBe(true);
                    done();
                  });
              });

              it('is called to update the user_metadata', done => {
                authenticatedSession
                 .delete(`/agent/link/twitter/abc-123`)
                 .set('Accept', 'application/json')
                 .expect('Content-Type', /json/)
                 .expect(200)
                 .end((err, res) => {
                   if (err) return done.fail(err);
                   expect(userAppMetadataUpdateScope.isDone()).toBe(true);
                   expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
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

            it('returns the identities array', done => {
              request(app)
                .delete(`/agent/link/twitter/abc-123`)
                .set('Authorization', `Bearer ${accessToken}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  expect(res.body.length).toEqual(1);
                  expect(res.body[0].connection).toEqual(_identities[0].connection);
                  expect(res.body[0].provider).toEqual('google-oauth2');

                  done();
                });
            });

            it('sets the `manually_unlinked` flag in `user_metadata`', done => {
              expect(secondaryProfile.user_metadata).toBeUndefined();

              request(app)
                .delete(`/agent/link/twitter/abc-123`)
                .set('Authorization', `Bearer ${accessToken}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  expect(secondaryProfile.user_metadata.manually_unlinked).toBe(true);

                  done();
                });
            });

            describe('Auth0', () => {

              it('is called to link the secondary account to the primary', done => {
                request(app)
                  .delete(`/agent/link/twitter/abc-123`)
                  .set('Authorization', `Bearer ${accessToken}`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(200)
                  .end((err, res) => {
                    if (err) return done.fail(err);
                    expect(userUnlinkAccountScope.isDone()).toBe(true);
                    expect(userUnlinkAccountOauthTokenScope.isDone()).toBe(true);
                    done();
                  });
              });

              it('is called to update the user_metadata', done => {
                request(app)
                  .delete(`/agent/link/twitter/abc-123`)
                  .set('Authorization', `Bearer ${accessToken}`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(200)
                  .end((err, res) => {
                    if (err) return done.fail(err);
                    expect(userAppMetadataUpdateScope.isDone()).toBe(true);
                    expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
                    done();
                  });
              });
            });
          });
        });
      });
    });
  });

  describe('unauthenticated', () => {

    describe('/agent/profiles', () => {

      it('redirects to login', done => {
        request(app)
          .get('/agent/profiles')
          .set('Accept', 'application/json')
          .expect(302)
          .end((err, res) => {
            if (err) return done.fail(err);
            expect(res.headers.location).toEqual('/login');
            done();
          });
      });
    });

    describe('/agent/link', () => {

      it('redirects to login', done => {
        request(app)
          .put('/agent/link')
          .send({
            // From where do I get connection_id?
            //connection_id: 'twitter',
            user_id: 'abc-123',
            provider: 'twitter',
          })
          .set('Accept', 'application/json')
          .expect(302)
          .end((err, res) => {
            if (err) return done.fail(err);
            expect(res.headers.location).toEqual('/login');
            done();
          });
      });
    });
  });
});
