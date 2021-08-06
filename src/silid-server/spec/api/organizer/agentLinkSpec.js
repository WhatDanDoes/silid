const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001;
const app = require('../../../app');
const fixtures = require('sequelize-fixtures');
const models = require('../../../models');
const request = require('supertest');
const nock = require('nock');
const stubAuth0Sessions = require('../../support/stubAuth0Sessions');
const stubAuth0ManagementApi = require('../../support/stubAuth0ManagementApi');
const stubUserReadByEmail = require('../../support/auth0Endpoints/stubUserReadByEmail');
const stubUserLinkAccount = require('../../support/auth0Endpoints/stubUserLinkAccount');
const stubUserUnlinkAccount = require('../../support/auth0Endpoints/stubUserUnlinkAccount');
const stubUserAppMetadataUpdate = require('../../support/auth0Endpoints/stubUserAppMetadataUpdate');
const scope = require('../../../config/permissions');
const roles = require('../../../config/roles');
const apiScope = require('../../../config/apiPermissions');

const _profile = require('../../fixtures/sample-auth0-profile-response');

describe('organizer/agentLinkSpec', () => {

  /**
   * 2019-11-13
   * Sample tokens taken from:
   *
   * https://auth0.com/docs/api-auth/tutorials/adoption/api-tokens
   */
  const _identity = { ...require('../../fixtures/sample-auth0-identity-token'), iss: `https://${process.env.AUTH0_CUSTOM_DOMAIN}/`};
  const _access = require('../../fixtures/sample-auth0-access-token');
  const _roles = require('../../fixtures/roles');

  let login, pub, prv, keystore,
      agent;

  beforeEach(done => {
    stubAuth0Sessions((err, sessionStuff) => {
      if (err) return done.fail(err);
      ({ login, pub, prv, keystore } = sessionStuff);

      models.sequelize.sync({force: true}).then(() => {
        fixtures.loadFile(`${__dirname}/../../fixtures/agents.json`, models).then(() => {
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

      let organizerSession, accessToken;
      beforeEach(done => {
        stubAuth0ManagementApi({ userRoles: [_roles[0], _roles[2]] }, (err, apiScopes) => {
          if (err) return done.fail(err);

          login({..._identity, email: _profile.email}, roles.organizer.concat(roles.viewer), (err, session, token) => {
            if (err) return done.fail(err);
            accessToken = token;
            organizerSession = session;
            done();
          });
        });
      });

      describe('access another agent\'s account', () => {

        describe('/agent/profiles', () => {

          describe('primary email verified', () => {

            describe('no linkable accounts', () => {

              beforeEach(done => {
                // No accounts with matching email
                stubUserReadByEmail([{..._identity, email: 'someotherguy@example.com', name: 'Some Other Guy'}], (err, apiScopes) => {
                  if (err) return done.fail(err);
                  ({userReadByEmailScope, userReadByEmailOauthTokenScope} = apiScopes);

                  done();
                });
              });

              describe('session access', () => {

                it('returns the lone profile (in real life)', done => {
                  organizerSession
                    .get('/agent/profiles/someotherguy@example.com')
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(200)
                    .end((err, res) => {
                      if (err) return done.fail(err);

                      expect(res.body[0].email).toEqual('someotherguy@example.com');
                      done();
                    });
                });

                describe('Auth0', () => {

                  it('is called to retrieve all profiles with the same email as the primary account', done => {
                    organizerSession
                      .get('/agent/profiles/someotherguy@example.com')
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
                    .reply(200, {..._identity, permissions: [scope.read.agents, scope.update.agents] });
                });

                it('returns the lone profile (in real life)', done => {
                  request(app)
                    .get('/agent/profiles/someotherguy@example.com')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(200)
                    .end((err, res) => {
                      if (err) return done.fail(err);

                      expect(res.body.length).toEqual(1);
                      expect(res.body[0].email).toEqual('someotherguy@example.com');
                      done();
                    });
                });

                describe('Auth0', () => {

                  it('is called to retrieve all profiles with the same email as the primary account', done => {
                    request(app)
                      .get('/agent/profiles/someotherguy@example.com')
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
                    email: 'someotherguy@example.com',
                    name: 'Some Other Guy'
                  },
                  {
                    ..._profile,
                    email: 'pretendthisisthesameemail@example.com',
                    name: 'Some Other Guy'
                  }
                ], (err, apiScopes) => {
                  if (err) return done.fail(err);
                  ({userReadByEmailScope, userReadByEmailOauthTokenScope} = apiScopes);

                  done();
                });
              });

              describe('session access', () => {

                it('returns all matching agent profiles (in real life)', done => {
                  organizerSession
                    .get('/agent/profiles/someotherguy@example.com')
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(200)
                    .end((err, res) => {
                      if (err) return done.fail(err);

                      expect(res.body.length).toEqual(2);
                      expect(res.body[0].email).toEqual('someotherguy@example.com');
                      expect(res.body[0].email_verified).toBe(true);
                      expect(res.body[1].email).toEqual('pretendthisisthesameemail@example.com');
                      expect(res.body[1].email_verified).toBe(true);

                      done();
                    });
                });

                describe('Auth0', () => {

                  it('is called to retrieve all profiles with the same email as the primary account', done => {
                    organizerSession
                      .get('/agent/profiles/someotherguy@example.com')
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
                    .reply(200, {..._identity, permissions: [scope.read.agents, scope.update.agents] });
                });

                it('returns all matching agent profiles (in real life)', done => {
                  request(app)
                    .get('/agent/profiles/someotherguy@example.com')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(200)
                    .end((err, res) => {
                      if (err) return done.fail(err);

                      expect(res.body.length).toEqual(2);
                      expect(res.body[0].email).toEqual('someotherguy@example.com');
                      expect(res.body[0].email_verified).toBe(true);
                      expect(res.body[1].email).toEqual('pretendthisisthesameemail@example.com');
                      expect(res.body[1].email_verified).toBe(true);

                      done();
                    });
                });

                describe('Auth0', () => {

                  it('is called to retrieve all profiles with the same email as the primary account', done => {
                    request(app)
                      .get('/agent/profiles/someotherguy@example.com')
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
                  {..._profile, email: 'someotherguy@example.com' },
                  {..._profile, email: 'someotherguyunverified@example.com', email_verified: false },
                  {..._profile, email: 'someverifiedguy@example.com' },
                ], (err, apiScopes) => {
                  if (err) return done.fail(err);
                  ({userReadByEmailScope, userReadByEmailOauthTokenScope} = apiScopes);

                  done();
                });
              });

              describe('session access', () => {

                it('returns all matching agent profiles (in real life)', done => {
                  organizerSession
                    .get('/agent/profiles/someotherguy@example.com')
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(200)
                    .end((err, res) => {
                      if (err) return done.fail(err);

                      expect(res.body.length).toEqual(2);
                      expect(res.body[0].email).toEqual('someotherguy@example.com');
                      expect(res.body[0].email_verified).toBe(true);
                      expect(res.body[1].email).toEqual('someverifiedguy@example.com');
                      expect(res.body[1].email_verified).toBe(true);

                      done();
                    });
                });

                describe('Auth0', () => {

                  it('is called to retrieve all profiles with the same email as the primary account', done => {
                    organizerSession
                      .get('/agent/profiles/someotherguy@example.com')
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
                    .reply(200, {..._identity, permissions: [scope.read.agents, scope.update.agents] });
                });

                it('returns all matching agent profiles (in real life)', done => {
                  request(app)
                    .get('/agent/profiles/someotherguy@example.com')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(200)
                    .end((err, res) => {
                      if (err) return done.fail(err);

                      expect(res.body.length).toEqual(2);
                      expect(res.body[0].email).toEqual('someotherguy@example.com');
                      expect(res.body[0].email_verified).toBe(true);
                      expect(res.body[1].email).toEqual('someverifiedguy@example.com');
                      expect(res.body[1].email_verified).toBe(true);

                      done();
                    });
                });

                describe('Auth0', () => {

                  it('is called to retrieve all profiles with the same email as the primary account', done => {
                    request(app)
                      .get('/agent/profiles/someotherguy@example.com')
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
              stubUserReadByEmail([_profile, {..._profile, email: 'someotherguy@example.com', email_verified: false }], (err, apiScopes) => {
                if (err) return done.fail(err);
                ({userReadByEmailScope, userReadByEmailOauthTokenScope} = apiScopes);

                done();
              });
            });

            describe('session access', () => {

              it('returns 400', done => {
                organizerSession
                  .get('/agent/profiles/someotherguy@example.com')
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(400)
                  .end((err, res) => {
                    if (err) return done.fail(err);

                    expect(res.body.message).toEqual('Primary email is not verified');
                    done();
                  });
              });

              describe('Auth0', () => {

                it('is called', done => {
                  organizerSession
                    .get('/agent/profiles/someotherguy@example.com')
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(400)
                    .end((err, res) => {
                      if (err) return done.fail(err);

                      expect(userReadByEmailOauthTokenScope.isDone()).toBe(false);
                      expect(userReadByEmailScope.isDone()).toBe(true);
                      done();
                    });
                });
              });
            });

            describe('Bearer token access', () => {

              beforeEach(() => {
                const userInfoScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
                  .get(/userinfo/)
                  .reply(200, {..._identity, permissions: [scope.read.agents, scope.update.agents] });
              });

              it('returns 401 unauthenticated', done => {
                request(app)
                  .get('/agent/profiles/someotherguy@example.com')
                  .set('Authorization', `Bearer ${accessToken}`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(400)
                  .end((err, res) => {
                    if (err) return done.fail(err);

                    expect(res.body.message).toEqual('Primary email is not verified');
                    done();
                  });
              });

              describe('Auth0', () => {

                it('is called', done => {
                  request(app)
                    .get('/agent/profiles/someotherguy@example.com')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(400)
                    .end((err, res) => {
                      if (err) return done.fail(err);

                      expect(userReadByEmailOauthTokenScope.isDone()).toBe(false);
                      expect(userReadByEmailScope.isDone()).toBe(true);
                      done();
                    });
                });
              });
            });
          });
        });

        describe('PUT /agent/link', () => {

          describe('primary email verified', () => {

            describe('secondary account does not exist', () => {

              beforeEach(done => {
                // No accounts with matching email
                stubUserLinkAccount({..._profile, email: 'someotherguy@example.com', user_id: 'some-other-guys-user-id-abc-123'}, {
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
                  organizerSession
                    .put('/agent/link/some-other-guys-user-id-abc-123')
                    .send({
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
                    organizerSession
                      .put('/agent/link/some-other-guys-user-id-abc-123')
                      .send({
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
                    .put('/agent/link/some-other-guys-user-id-abc-123')
                    .send({
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
                      .put('/agent/link/some-other-guys-user-id-abc-123')
                      .send({
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
                });
              });
            });

            describe('secondary account exists', () => {

              let secondaryProfile;

              beforeEach(done => {

                secondaryProfile = {
                  ..._profile,
                  email: 'thesameguy@example.com',
                  identities: [{
                    connection: 'twitter',
                    user_id: 'abc-123',
                    provider: 'twitter',
                  }]
                };

                stubUserLinkAccount({..._profile, email: 'someotherguy@example.com', user_id: 'some-other-guys-user-id-abc-123'}, secondaryProfile, (err, apiScopes) => {
                  if (err) return done.fail(err);
                  ({userLinkAccountScope, userLinkAccountOauthTokenScope} = apiScopes);

                  done();
                });
              });

              describe('session access', () => {

                it('returns the identities array', done => {
                  organizerSession
                    .put('/agent/link/some-other-guys-user-id-abc-123')
                    .send({
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
                    organizerSession
                      .put('/agent/link/some-other-guys-user-id-abc-123')
                      .send({
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
                    .reply(200, {..._identity, permissions: [scope.read.agents, scope.update.agents] });
                });

                it('returns the identities array', done => {
                  request(app)
                    .put('/agent/link/some-other-guys-user-id-abc-123')
                    .send({
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
                      .put('/agent/link/some-other-guys-user-id-abc-123')
                      .send({
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
                });
              });
            });
          });
        });

        describe('DELETE /agent/link', () => {

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
                email: 'thesamesomeotherguy@example.com',
                email_verified: true,
                name: 'Some Guy',
                given_name: 'Some',
                family_name: 'Guy'
              }
            }
          ];

          beforeEach(done => {
            // For setting `manually_unlinked` flag.
            // See viewer specs for robust tests.
            stubUserAppMetadataUpdate({..._profile, identities: _identities}, (err, apiScopes) => {
              if (err) return done.fail(err);
              ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);

              done();
            });
          });

          describe('general error handling (e.g., secondary account does not exist)', () => {

            beforeEach(done => {
              // No accounts with matching email
              stubUserUnlinkAccount({..._profile, email: 'someotherguy@example.com', identities: _identities}, { status: 400 }, (err, apiScopes) => {
                if (err) return done.fail(err);
                ({userUnlinkAccountScope, userUnlinkAccountOauthTokenScope} = apiScopes);

                done();
              });
            });

            describe('session access', () => {

              it('returns an error', done => {
                organizerSession
                  .delete('/agent/link/twitter/some-other-guys-user-id-abc-123')
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
                  organizerSession
                    .delete('/agent/link/twitter/some-other-guys-user-id-abc-123')
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
                  .delete('/agent/link/twitter/some-other-guys-user-id-abc-123')
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
                    .delete('/agent/link/twitter/some-other-guys-user-id-abc-123')
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
              });
            });
          });

          describe('successfully', () => {

            beforeEach(done => {
              stubUserUnlinkAccount({..._profile, email: 'someotherguy@example.com', identities: _identities}, (err, apiScopes) => {
                if (err) return done.fail(err);
                ({userUnlinkAccountScope, userUnlinkAccountOauthTokenScope} = apiScopes);

                done();
              });
            });

            describe('session access', () => {

              it('returns the new unlinked identity array', done => {
                organizerSession
                  .delete('/agent/link/twitter/some-other-guys-user-id-abc-123')
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

              describe('Auth0', () => {

                it('is called to link the secondary account to the primary', done => {
                  organizerSession
                    .delete('/agent/link/twitter/some-other-guys-user-id-abc-123')
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
                  .delete('/agent/link/twitter/some-other-guys-user-id-abc-123')
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

              describe('Auth0', () => {

                it('is called to link the secondary account to the primary', done => {
                  request(app)
                    .delete('/agent/link/twitter/some-other-guys-user-id-abc-123')
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
              });
            });
          });
        });
      });
    });

    describe('unauthorized', () => {

      let authenticatedSession, accessToken;
      beforeEach(done => {
        stubAuth0ManagementApi((err, apiScopes) => {
          if (err) return done.fail(err);

          login({..._identity, email: _profile.email}, (err, session, token) => {
            if (err) return done.fail(err);
            accessToken = token;
            authenticatedSession = session;

            // No accounts with matching email
            stubUserReadByEmail([{..._identity, email: 'someotherguy@example.com', name: 'Some Other Guy'}], (err, apiScopes) => {
              if (err) return done.fail(err);
              ({userReadByEmailScope, userReadByEmailOauthTokenScope} = apiScopes);

              done();
            });
          });
        });
      });

      describe('/agent/profiles', () => {

        describe('session access', () => {

          it('returns an error', done => {
            authenticatedSession
              .get('/agent/profiles/someotherguy@example.com')
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(403)
              .end((err, res) => {
                if (err) return done.fail(err);

                expect(res.body.message).toEqual('Forbidden');
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

          it('returns the lone profile (in real life)', done => {
            request(app)
              .get('/agent/profiles/someotherguy@example.com')
              .set('Authorization', `Bearer ${accessToken}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(403)
              .end((err, res) => {
                if (err) return done.fail(err);

                expect(res.body.message).toEqual('Forbidden');
                done();
              });
          });

          describe('Auth0', () => {

            it('is called to retrieve all profiles with the same email as the primary account', done => {
              request(app)
                .get('/agent/profiles/someotherguy@example.com')
                .set('Authorization', `Bearer ${accessToken}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(403)
                .end((err, res) => {
                  if (err) return done.fail(err);
                  expect(userReadByEmailScope.isDone()).toBe(false);
                  expect(userReadByEmailOauthTokenScope.isDone()).toBe(false);
                  done();
                });
            });
          });
        });
      });

      describe('PUT /agent/link', () => {

        beforeEach(done => {
          stubUserLinkAccount({..._profile, email: 'someotherguy@example.com'}, {
            ..._profile,
            email: 'someotherguy@example.com',
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
              .put('/agent/link/some-other-guys-user-id-abc-123')
              .send({
                user_id: 'abc-123',
                provider: 'twitter',
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(403)
              .end((err, res) => {
                if (err) return done.fail(err);

                expect(res.body.message).toEqual('Forbidden');

                done();
              });
          });

          describe('Auth0', () => {

            it('is not called', done => {
              authenticatedSession
                .put('/agent/link/some-other-guys-user-id-abc-123')
                .send({
                  user_id: 'abc-123',
                  provider: 'twitter',
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(403)
                .end((err, res) => {
                  if (err) return done.fail(err);
                  expect(userLinkAccountScope.isDone()).toBe(false);
                  expect(userLinkAccountOauthTokenScope.isDone()).toBe(false);
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

          it('returns an error', done => {
            request(app)
              .put('/agent/link/some-other-guys-user-id-abc-123')
              .send({
                user_id: 'abc-123',
                provider: 'twitter',
              })
              .set('Authorization', `Bearer ${accessToken}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(403)
              .end((err, res) => {
                if (err) return done.fail(err);

                expect(res.body.message).toEqual('Forbidden');

                done();
              });
          });

          describe('Auth0', () => {

            it('is called to link the secondary account to the primary', done => {
              request(app)
                .put('/agent/link/some-other-guys-user-id-abc-123')
                .send({
                  user_id: 'abc-123',
                  provider: 'twitter',
                })
                .set('Authorization', `Bearer ${accessToken}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(403)
                .end((err, res) => {
                  if (err) return done.fail(err);
                  expect(userLinkAccountScope.isDone()).toBe(false);
                  expect(userLinkAccountOauthTokenScope.isDone()).toBe(false);
                  done();
                });
            });
          });
        });
      });

      describe('DELETE /agent/link', () => {

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
              email: 'thesamesomeotherguy@example.com',
              email_verified: true,
              name: 'Some Guy',
              given_name: 'Some',
              family_name: 'Guy'
            }
          }
        ];

        describe('general error handling (e.g., secondary account does not exist)', () => {

          beforeEach(done => {
            // No accounts with matching email
            stubUserUnlinkAccount({..._profile, email: 'someotherguy@example.com', identities: _identities}, { status: 400 }, (err, apiScopes) => {
              if (err) return done.fail(err);
              ({userUnlinkAccountScope, userUnlinkAccountOauthTokenScope} = apiScopes);

              done();
            });
          });

          describe('session access', () => {

            it('returns an error', done => {
              authenticatedSession
                .delete('/agent/link/twitter/some-secondary-linked-account/some-other-guys-user-id-abc-123')
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(403)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  expect(res.body.message).toEqual('Forbidden');
                  done();
                });
            });

            describe('Auth0', () => {

              it('is called to attempt unlinking the secondary account from the primary account', done => {
                authenticatedSession
                  .delete('/agent/link/twitter/some-secondary-linked-account/some-other-guys-user-id-abc-123')
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(403)
                  .end((err, res) => {
                    if (err) return done.fail(err);
                    expect(userUnlinkAccountScope.isDone()).toBe(false);
                    expect(userUnlinkAccountOauthTokenScope.isDone()).toBe(false);
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
                .delete('/agent/link/twitter/some-secondary-linked-account/some-other-guys-user-id-abc-123')
                .set('Authorization', `Bearer ${accessToken}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(403)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  expect(res.body.message).toEqual('Forbidden');
                  done();
                });
            });

            describe('Auth0', () => {

              it('is called to attempt unlinking the secondary account from the primary account', done => {
                request(app)
                  .delete('/agent/link/twitter/some-secondary-linked-account/some-other-guys-user-id-abc-123')
                  .set('Authorization', `Bearer ${accessToken}`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(403)
                  .end((err, res) => {
                    if (err) return done.fail(err);
                    expect(userUnlinkAccountScope.isDone()).toBe(false);
                    expect(userUnlinkAccountOauthTokenScope.isDone()).toBe(false);
                    done();
                  });
              });
            });
          });
        });
      });
    });
  });
});
