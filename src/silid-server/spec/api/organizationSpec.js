const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001;
const app = require('../../app');
const fixtures = require('sequelize-fixtures');
const models = require('../../models');
const request = require('supertest');
const uuid = require('uuid');
const stubAuth0Sessions = require('../support/stubAuth0Sessions');
const stubAuth0ManagementApi = require('../support/stubAuth0ManagementApi');
const stubUserRead = require('../support/auth0Endpoints/stubUserRead');
const stubUserAppMetadataRead = require('../support/auth0Endpoints/stubUserAppMetadataRead');
const stubUserAppMetadataUpdate = require('../support/auth0Endpoints/stubUserAppMetadataUpdate');
const stubOrganizationRead = require('../support/auth0Endpoints/stubOrganizationRead');
const stubTeamRead = require('../support/auth0Endpoints/stubTeamRead');
const mailer = require('../../mailer');
const scope = require('../../config/permissions');
const nock = require('nock');

/**
 * 2019-11-13
 * Sample tokens taken from:
 *
 * https://auth0.com/docs/api-auth/tutorials/adoption/api-tokens
 */
const _identity = { ...require('../fixtures/sample-auth0-identity-token'), iss: `https://${process.env.AUTH0_CUSTOM_DOMAIN}/`};
const _profile = require('../fixtures/sample-auth0-profile-response');

describe('organizationSpec', () => {

  let login, pub, prv, keystore;
  beforeEach(done => {
    stubAuth0Sessions((err, sessionStuff) => {
      if (err) return done.fail(err);
      ({ login, pub, prv, keystore } = sessionStuff);
      done();
    });
  });

  let originalProfile, agent;
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

  afterEach(() => {
    // Through the magic of node I am able to adjust the profile data returned.
    // This resets the default values
    _profile.email_verified = true;
    delete _profile.user_metadata;
    _profile.email = originalProfile.email;
    _profile.name = originalProfile.name;
  });

  let accessToken;
  describe('authenticated', () => {

    describe('authorized', () => {

      describe('create', () => {

        describe('successfully', () => {
          beforeEach(done => {
            stubAuth0ManagementApi((err, apiScopes) => {
              if (err) return done.fail();

              login(_identity, [scope.create.organizations], (err, session, token) => {
                if (err) return done.fail(err);

                accessToken = token;
                authenticatedSession = session;

                // Search for existing organization name
                stubOrganizationRead([], (err, apiScopes) => {
                  if (err) return done.fail();
                  ({organizationReadScope, organizationReadOauthTokenScope} = apiScopes);

                  // Retrieve agent profile
                  stubUserAppMetadataRead((err, apiScopes) => {
                    if (err) return done.fail();
                    ({userAppMetadataReadScope, userAppMetadataReadOauthTokenScope} = apiScopes);

                    stubUserAppMetadataUpdate((err, apiScopes) => {
                      if (err) return done.fail();
                      ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);
                      done();
                    });
                  });
                });
              });
            });
          });

          describe('session access', () => {

            it('returns the agent profile', done => {
              authenticatedSession
                .post('/organization')
                .send({
                  name: 'One Book Canada'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end((err, res) => {
                  if (err) return done.fail(err);
                  expect(res.body.email).toEqual(_profile.email);
                  expect(res.body.user_metadata.organizations.length).toEqual(1);
                  done();
                });
            });

            it('updates the user session data', done => {
              models.Session.findAll().then(results => {
                expect(results.length).toEqual(1);
                let session = JSON.parse(results[0].data).passport.user;
                expect(session.user_metadata.organizations).toBeUndefined();

                authenticatedSession
                  .post('/organization')
                  .send({
                    name: 'One Book Canada'
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end((err, res) => {
                    if (err) return done.fail(err);

                    models.Session.findAll().then(results => {
                      expect(results.length).toEqual(1);
                      session = JSON.parse(results[0].data).passport.user;
                      expect(session.user_metadata.organizations.length).toEqual(1);

                      done();
                    }).catch(err => {
                      done.fail(err);
                    });
                  });
              }).catch(err => {
                done.fail(err);
              });
            });

            describe('Auth0', () => {

              it('is called to see if organization name is already registered', done => {
                authenticatedSession
                  .post('/organization')
                  .send({
                    name: 'One Book Canada'
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end((err, res) => {
                    if (err) return done.fail(err);

                    expect(organizationReadOauthTokenScope.isDone()).toBe(true);
                    expect(organizationReadScope.isDone()).toBe(true);
                    done();
                  });
              });

              it('calls Auth0 to retrieve the agent user_metadata', done => {
                authenticatedSession
                  .post('/organization')
                  .send({
                    name: 'One Book Canada'
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end((err, res) => {
                    if (err) return done.fail(err);

                    // 2020-6-17 Reuse token from above? This needs to be confirmed in production
                    expect(userAppMetadataReadOauthTokenScope.isDone()).toBe(false);
                    expect(userAppMetadataReadScope.isDone()).toBe(true);
                    done();
                  });
              });

              it('calls Auth0 to update the agent', done => {
                authenticatedSession
                  .post('/organization')
                  .send({
                    name: 'One Book Canada'
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end((err, res) => {
                    if (err) return done.fail(err);

                    // 2020-6-17 Reuse token from above? This needs to be confirmed in production
                    expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
                    expect(userAppMetadataUpdateScope.isDone()).toBe(true);
                    done();
                  });
              });
            });
          });

          describe('Bearer token access', () => {

            beforeEach(() => {
              const userInfoScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
                .get(/userinfo/)
                .reply(200, {
                  ..._identity,
                  permissions: [scope.create.organizations],
                });
            });

            it('returns the agent profile', done => {
              request(app)
                .post('/organization')
                .send({
                  name: 'One Book Canada'
                })
                .set('Authorization', `Bearer ${accessToken}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end((err, res) => {
                  if (err) return done.fail(err);
                  expect(res.body.email).toEqual(_profile.email);
                  expect(res.body.user_metadata.organizations.length).toEqual(1);
                  done();
                });
            });

            describe('Auth0', () => {

              it('is called to see if organization name is already registered', done => {
                request(app)
                  .post('/organization')
                  .send({
                    name: 'One Book Canada'
                  })
                  .set('Authorization', `Bearer ${accessToken}`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end((err, res) => {
                    if (err) return done.fail(err);

                    expect(organizationReadOauthTokenScope.isDone()).toBe(true);
                    expect(organizationReadScope.isDone()).toBe(true);
                    done();
                  });
              });

              it('calls Auth0 to retrieve the agent user_metadata', done => {
                request(app)
                  .post('/organization')
                  .send({
                    name: 'One Book Canada'
                  })
                  .set('Authorization', `Bearer ${accessToken}`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end((err, res) => {
                    if (err) return done.fail(err);

                    // 2020-6-17 Reuse token from above? This needs to be confirmed in production
                    expect(userAppMetadataReadOauthTokenScope.isDone()).toBe(false);
                    expect(userAppMetadataReadScope.isDone()).toBe(true);
                    done();
                  });
              });

              it('calls Auth0 to update the agent', done => {
                request(app)
                  .post('/organization')
                  .send({
                    name: 'One Book Canada'
                  })
                  .set('Authorization', `Bearer ${accessToken}`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end((err, res) => {
                    if (err) return done.fail(err);

                    // 2020-6-17 Reuse token from above? This needs to be confirmed in production
                    expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
                    expect(userAppMetadataUpdateScope.isDone()).toBe(true);
                    done();
                  });
              });
            });
          });
        });

        describe('unsuccessfully', () => {
          beforeEach(done => {
            // Witness node module caching magic
            _profile.user_metadata = { organizations: [ {name: 'One Book Canada', organizer: _profile.email } ] };
            stubAuth0ManagementApi((err, apiScopes) => {
              if (err) return done.fail();

              login(_identity, [scope.create.organizations], (err, session) => {
                if (err) return done.fail(err);
                authenticatedSession = session;

                // Search for existing organization name
                stubOrganizationRead((err, apiScopes) => {
                  if (err) return done.fail();
                  ({organizationReadScope, organizationReadOauthTokenScope} = apiScopes);

                  // This stubs calls subsequent to the inital login/permission checking step
                  stubUserAppMetadataRead((err, apiScopes) => {
                    if (err) return done.fail();
                    ({userAppMetadataReadScope, userAppMetadataReadOauthTokenScope} = apiScopes);

                    stubUserAppMetadataUpdate((err, apiScopes) => {
                      if (err) return done.fail();
                      ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);
                      done();
                    });
                  });
                });
              });
            });
          });

          describe('add a duplicate organization name', () => {

            describe('session access', () => {

              it('returns an error if record already exists', done => {
                authenticatedSession
                  .post('/organization')
                  .send({
                    name: 'One Book Canada'
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(400)
                  .end((err, res) => {
                    if (err) return done.fail(err);
                    expect(res.body.errors.length).toEqual(1);
                    expect(res.body.errors[0].message).toEqual('That organization is already registered');
                    done();
                  });
              });

              describe('Auth0', () => {
                it('is called to see if organization name is already registered', done => {
                  authenticatedSession
                    .post('/organization')
                    .send({
                      name: 'One Book Canada'
                    })
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(400)
                    .end((err, res) => {
                      if (err) return done.fail(err);

                      expect(organizationReadOauthTokenScope.isDone()).toBe(true);
                      expect(organizationReadScope.isDone()).toBe(true);
                      done();
                    });
                });

                it('does not call Auth0 to retrieve the agent user_metadata', done => {
                  authenticatedSession
                    .post('/organization')
                    .send({
                      name: 'One Book Canada'
                    })
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(400)
                    .end((err, res) => {
                      if (err) return done.fail(err);

                      expect(userAppMetadataReadOauthTokenScope.isDone()).toBe(false);
                      expect(userAppMetadataReadScope.isDone()).toBe(false);
                      done();
                    });
                });

                it('does not call Auth0 to update the agent user_metadata', done => {
                  authenticatedSession
                    .post('/organization')
                    .send({
                      name: 'One Book Canada'
                    })
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(400)
                    .end((err, res) => {
                      if (err) return done.fail(err);

                      expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
                      expect(userAppMetadataUpdateScope.isDone()).toBe(false);
                      done();
                    });
                });
              });
            });

            describe('Bearer token access', () => {

              beforeEach(() => {
                const userInfoScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
                  .get(/userinfo/)
                  .reply(200, {
                    ..._identity,
                    permissions: [scope.create.organizations],
                  });
              });

              it('returns an error if record already exists', done => {
                request(app)
                  .post('/organization')
                  .send({
                    name: 'One Book Canada'
                  })
                  .set('Authorization', `Bearer ${accessToken}`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(400)
                  .end((err, res) => {
                    if (err) return done.fail(err);
                    expect(res.body.errors.length).toEqual(1);
                    expect(res.body.errors[0].message).toEqual('That organization is already registered');
                    done();
                  });
              });

              describe('Auth0', () => {

                it('is called to see if organization name is already registered', done => {
                  request(app)
                    .post('/organization')
                    .send({
                      name: 'One Book Canada'
                    })
                    .set('Authorization', `Bearer ${accessToken}`)
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(400)
                    .end((err, res) => {
                      if (err) return done.fail(err);

                      expect(organizationReadOauthTokenScope.isDone()).toBe(true);
                      expect(organizationReadScope.isDone()).toBe(true);
                      done();
                    });
                });

                it('does not call Auth0 to retrieve the agent user_metadata', done => {
                  request(app)
                    .post('/organization')
                    .send({
                      name: 'One Book Canada'
                    })
                    .set('Authorization', `Bearer ${accessToken}`)
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(400)
                    .end((err, res) => {
                      if (err) return done.fail(err);

                      expect(userAppMetadataReadOauthTokenScope.isDone()).toBe(false);
                      expect(userAppMetadataReadScope.isDone()).toBe(false);
                      done();
                    });
                });

                it('does not call Auth0 to update the agent user_metadata', done => {
                  request(app)
                    .post('/organization')
                    .send({
                      name: 'One Book Canada'
                    })
                    .set('Authorization', `Bearer ${accessToken}`)
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(400)
                    .end((err, res) => {
                      if (err) return done.fail(err);

                      expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
                      expect(userAppMetadataUpdateScope.isDone()).toBe(false);
                      done();
                    });
                });
              });
            });
          });

          describe('session access', () => {

            it('returns an error if empty organization name provided', done => {
              authenticatedSession
                .post('/organization')
                .send({
                  name: '   '
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(400)
                .end((err, res) => {
                  if (err) return done.fail(err);
                  expect(res.body.errors.length).toEqual(1);
                  expect(res.body.errors[0].message).toEqual('Organization requires a name');
                  done();
                });
            });

            it('returns an error if no organization name provided', done => {
              authenticatedSession
                .post('/organization')
                .send({})
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(400)
                .end((err, res) => {
                  if (err) return done.fail(err);
                  expect(res.body.errors.length).toEqual(1);
                  expect(res.body.errors[0].message).toEqual('Organization requires a name');
                  done();
                });
            });

            it('returns an error if organization name is over 128 characters long', done => {
              authenticatedSession
                .post('/organization')
                .send({
                  name: '!'.repeat(129)
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(400)
                .end((err, res) => {
                  if (err) return done.fail(err);
                  expect(res.body.errors.length).toEqual(1);
                  expect(res.body.errors[0].message).toEqual('Organization name is too long');
                  done();
                });
            });
          });

          describe('Bearer token access', () => {

            beforeEach(() => {
              const userInfoScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
                .get(/userinfo/)
                .reply(200, {
                  ..._identity,
                  permissions: [scope.create.organizations],
                });
            });

            it('returns an error if empty organization name provided', done => {
              request(app)
                .post('/organization')
                .send({
                  name: '   '
                })
                .set('Authorization', `Bearer ${accessToken}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(400)
                .end((err, res) => {
                  if (err) return done.fail(err);
                  expect(res.body.errors.length).toEqual(1);
                  expect(res.body.errors[0].message).toEqual('Organization requires a name');
                  done();
                });
            });

            it('returns an error if no organization name provided', done => {
              request(app)
                .post('/organization')
                .send({})
                .set('Authorization', `Bearer ${accessToken}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(400)
                .end((err, res) => {
                  if (err) return done.fail(err);
                  expect(res.body.errors.length).toEqual(1);
                  expect(res.body.errors[0].message).toEqual('Organization requires a name');
                  done();
                });
            });

            it('returns an error if organization name is over 128 characters long', done => {
              request(app)
                .post('/organization')
                .send({
                  name: '!'.repeat(129)
                })
                .set('Authorization', `Bearer ${accessToken}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(400)
                .end((err, res) => {
                  if (err) return done.fail(err);
                  expect(res.body.errors.length).toEqual(1);
                  expect(res.body.errors[0].message).toEqual('Organization name is too long');
                  done();
                });
            });
          });
        });
      });

      describe('update', () => {

        let teamId, team1Id, team2Id, organizationId,
            organizationReadByIdScope, organizationReadByIdOauthTokenScope,
            organizationReadByNameScope, organizationReadByNameOauthTokenScope,
            teamReadRsvpsScope, teamReadRsvpsOauthTokenScope;

        const rsvpList = [];

        beforeEach(done => {
          teamId = uuid.v4();
          team1Id = uuid.v4();
          team2Id = uuid.v4();
          organizationId = uuid.v4();

          _profile.user_metadata = {
            organizations: [{ name: 'One Book Canada', organizer: _profile.email, id: organizationId }],
            pendingInvitations: [
              { name: 'One Book Canada', recipient: 'someotherguy@example.com', uuid: organizationId, type: 'organization', teamId: teamId },
              { name: 'One Book Canada', recipient: 'yetanotherguy@example.com', uuid: organizationId, type: 'organization', teamId: team2Id }
            ],
            teams: [
              { name: 'Guinea-Bissau', leader: 'yetanotherguy@example.com', id: team2Id, organizationId: organizationId },
              { name: 'Mystery Incorporated', leader: 'thelma@example.com', id: uuid.v4(), organizationId: uuid.v4() }
            ]
          };

          stubAuth0ManagementApi((err, apiScopes) => {
            if (err) return done.fail();

            login(_identity, [scope.update.organizations], (err, session, token) => {
              if (err) return done.fail(err);

              accessToken = token;
              authenticatedSession = session;

              // See if organization name is already registered
              stubOrganizationRead((err, apiScopes) => {
                if (err) return done.fail();
                ({organizationReadScope: organizationReadByNameScope, organizationReadOauthTokenScope: organizationReadByNameOauthTokenScope} = apiScopes);

                // Get organization by ID
                stubOrganizationRead((err, apiScopes) => {
                  if (err) return done.fail();
                  ({organizationReadScope: organizationReadByIdScope, organizationReadOauthTokenScope: organizationReadByIdOauthTokenScope} = apiScopes);

                  // Get member teams
                  stubTeamRead([{..._profile },
                                {..._profile,
                                  name: 'A Aaronson',
                                  email: 'aaaronson@example.com',
                                  user_id: _profile.user_id + 1,
                                  user_metadata: {
                                    teams: [
                                      { name: 'Asia Sensitive', leader: 'teamleader@example.com', id: team1Id, organizationId: organizationId },
                                      { name: 'The A-Team', leader: 'babaracus@example.com', id: uuid.v4(), organizationId: uuid.v4() }
                                    ]
                                  }
                                }], (err, apiScopes) => {
                    if (err) return done.fail();
                    ({teamReadScope: teamMembershipReadScope, teamReadOauthTokenScope: teamMembershipReadOauthTokenScope} = apiScopes);

                    stubUserAppMetadataUpdate((err, apiScopes) => {
                      if (err) return done.fail();
                      ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);
                      done();
                    });
                  });
                });
              });
            });
          });
        });

        afterEach(() => {
          // 2020-6-16 https://stackoverflow.com/a/1232046/1356582
          // Empty/reset list
          rsvpList.length = 0;
        });

        describe('session access', () => {

          it('allows a team creator to update an existing record', done => {
            authenticatedSession
              .put(`/organization/${organizationId}`)
              .send({
                name: 'Two Testaments Bolivia'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end((err, res) => {
                if (err) return done.fail(err);

                expect(res.body.name).toEqual('Two Testaments Bolivia');
                expect(res.body.organizer).toEqual(_profile.email);
                expect(res.body.id).toEqual(organizationId);
                expect(res.body.teams.length).toEqual(2);
                expect(res.body.teams[0]).toEqual({ name: 'Asia Sensitive', leader: 'teamleader@example.com', id: team1Id, organizationId: organizationId });
                expect(res.body.teams[1]).toEqual({ name: 'Guinea-Bissau', leader: 'yetanotherguy@example.com', id: team2Id, organizationId: organizationId });

                done();
              });
          });

          it('updates the user session data', done => {
            models.Session.findAll().then(results => {
              expect(results.length).toEqual(1);
              let session = JSON.parse(results[0].data).passport.user;
              expect(session.user_metadata.organizations.length).toEqual(1);
              expect(session.user_metadata.organizations[0].name).toEqual('One Book Canada');

              authenticatedSession
                .put(`/organization/${organizationId}`)
                .send({
                  name: 'Two Testaments Bolivia'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  models.Session.findAll().then(results => {
                    expect(results.length).toEqual(1);
                    session = JSON.parse(results[0].data).passport.user;
                    expect(session.user_metadata.organizations.length).toEqual(1);
                    expect(session.user_metadata.organizations[0].name).toEqual('Two Testaments Bolivia');

                    done();
                  }).catch(err => {
                    done.fail(err);
                  });
                });
            }).catch(err => {
              done.fail(err);
            });
          });

          it('returns an error if empty organization name provided', done => {
            authenticatedSession
              .put(`/organization/${organizationId}`)
              .send({
                name: '   '
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(400)
              .end((err, res) => {
                if (err) return done.fail(err);
                expect(res.body.errors.length).toEqual(1);
                expect(res.body.errors[0].message).toEqual('Organization requires a name');
                done();
              });
          });

          it('returns an error if record already exists', done => {
            authenticatedSession
              .put(`/organization/${organizationId}`)
              .send({
                name: 'One Book Canada'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(400)
              .end((err, res) => {
                if (err) return done.fail(err);
                expect(res.body.errors.length).toEqual(1);
                expect(res.body.errors[0].message).toEqual('That organization is already registered');
                done();
              });
          });

          it('doesn\'t barf if team doesn\'t exist', done => {
            authenticatedSession
              .put('/organization/333')
              .send({
                name: 'Two Testaments Bolivia'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(404)
              .end((err, res) => {
                if (err) return done.fail(err);
                expect(res.body.message).toEqual('No such organization');
                done();
              });
          });

          describe('Auth0', () => {
            it('is called to see if organization name is already registered', done => {
              authenticatedSession
                .put(`/organization/${organizationId}`)
                .send({
                  name: 'Two Testaments Bolivia'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  expect(organizationReadByNameOauthTokenScope.isDone()).toBe(true);
                  expect(organizationReadByNameScope.isDone()).toBe(true);
                  done();
                });
            });

            it('is called to retrieve organization leadership', done => {
              authenticatedSession
                .put(`/organization/${organizationId}`)
                .send({
                  name: 'Two Testaments Bolivia'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  // Token re-used from first call
                  expect(organizationReadByIdOauthTokenScope.isDone()).toBe(false);
                  expect(organizationReadByIdScope.isDone()).toBe(true);
                  done();
                });
            });

            it('is called to retrieve team membership', done => {
              authenticatedSession
                .put(`/organization/${organizationId}`)
                .send({
                  name: 'Two Testaments Bolivia'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  // 2020-6-17 Reuse token from above? This needs to be confirmed in production
                  expect(teamMembershipReadOauthTokenScope.isDone()).toBe(false);
                  expect(teamMembershipReadScope.isDone()).toBe(true);
                  done();
                });
            });

            it('is called to update the agent user_metadata', done => {
              authenticatedSession
                .put(`/organization/${organizationId}`)
                .send({
                  name: 'Two Testaments Bolivia'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  // 2020-6-17 Reuse token from above? This needs to be confirmed in production
                  expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
                  expect(userAppMetadataUpdateScope.isDone()).toBe(true);
                  done();
                });
            });
          });
        });

        describe('Bearer token access', () => {

          beforeEach(() => {
            const userInfoScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
              .get(/userinfo/)
              .reply(200, {
                ..._identity,
                permissions: [scope.update.organizations],
              });
          });

          it('allows a team creator to update an existing record', done => {
            request(app)
              .put(`/organization/${organizationId}`)
              .send({
                name: 'Two Testaments Bolivia'
              })
              .set('Authorization', `Bearer ${accessToken}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end((err, res) => {
                if (err) return done.fail(err);

                expect(res.body.name).toEqual('Two Testaments Bolivia');
                expect(res.body.organizer).toEqual(_profile.email);
                expect(res.body.id).toEqual(organizationId);
                expect(res.body.teams.length).toEqual(2);
                expect(res.body.teams[0]).toEqual({ name: 'Asia Sensitive', leader: 'teamleader@example.com', id: team1Id, organizationId: organizationId });
                expect(res.body.teams[1]).toEqual({ name: 'Guinea-Bissau', leader: 'yetanotherguy@example.com', id: team2Id, organizationId: organizationId });

                done();
              });
          });

          it('returns an error if empty organization name provided', done => {
            request(app)
              .put(`/organization/${organizationId}`)
              .send({
                name: '   '
              })
              .set('Authorization', `Bearer ${accessToken}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(400)
              .end((err, res) => {
                if (err) return done.fail(err);
                expect(res.body.errors.length).toEqual(1);
                expect(res.body.errors[0].message).toEqual('Organization requires a name');
                done();
              });
          });

          it('returns an error if record already exists', done => {
            request(app)
              .put(`/organization/${organizationId}`)
              .send({
                name: 'One Book Canada'
              })
              .set('Authorization', `Bearer ${accessToken}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(400)
              .end((err, res) => {
                if (err) return done.fail(err);
                expect(res.body.errors.length).toEqual(1);
                expect(res.body.errors[0].message).toEqual('That organization is already registered');
                done();
              });
          });

          it('doesn\'t barf if team doesn\'t exist', done => {
            request(app)
              .put('/organization/333')
              .send({
                name: 'Two Testaments Bolivia'
              })
              .set('Authorization', `Bearer ${accessToken}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(404)
              .end((err, res) => {
                if (err) return done.fail(err);
                expect(res.body.message).toEqual('No such organization');
                done();
              });
          });

          describe('Auth0', () => {

            it('is called to see if organization name is already registered', done => {
              request(app)
                .put(`/organization/${organizationId}`)
                .send({
                  name: 'Two Testaments Bolivia'
                })
                .set('Authorization', `Bearer ${accessToken}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  expect(organizationReadByNameOauthTokenScope.isDone()).toBe(true);
                  expect(organizationReadByNameScope.isDone()).toBe(true);
                  done();
                });
            });

            it('is called to retrieve organization leadership', done => {
              request(app)
                .put(`/organization/${organizationId}`)
                .send({
                  name: 'Two Testaments Bolivia'
                })
                .set('Authorization', `Bearer ${accessToken}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  // Token re-used from first call
                  expect(organizationReadByIdOauthTokenScope.isDone()).toBe(false);
                  expect(organizationReadByIdScope.isDone()).toBe(true);
                  done();
                });
            });

            it('is called to retrieve team membership', done => {
              request(app)
                .put(`/organization/${organizationId}`)
                .send({
                  name: 'Two Testaments Bolivia'
                })
                .set('Authorization', `Bearer ${accessToken}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  // 2020-6-17 Reuse token from above? This needs to be confirmed in production
                  expect(teamMembershipReadOauthTokenScope.isDone()).toBe(false);
                  expect(teamMembershipReadScope.isDone()).toBe(true);
                  done();
                });
            });

            it('is called to update the agent user_metadata', done => {
              request(app)
                .put(`/organization/${organizationId}`)
                .send({
                  name: 'Two Testaments Bolivia'
                })
                .set('Authorization', `Bearer ${accessToken}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  // 2020-6-17 Reuse token from above? This needs to be confirmed in production
                  expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
                  expect(userAppMetadataUpdateScope.isDone()).toBe(true);
                  done();
                });
            });
          });
        });
      });

      describe('delete', () => {

        let organizationId;
        beforeEach(() => {
          organizationId = uuid.v4();
        });

        describe('by organizer', () => {

          describe('successfully', () => {

            beforeEach(done => {

              _profile.user_metadata = {
                organizations: [{ name: 'One Book Canada', organizer: _profile.email, id: organizationId }],
              };

              stubAuth0ManagementApi((err, apiScopes) => {
                if (err) return done.fail();

                login(_identity, [scope.delete.organizations], (err, session) => {
                  if (err) return done.fail(err);
                  authenticatedSession = session;

                  // Make sure there are no member teams
                  stubTeamRead([], (err, apiScopes) => {
                    if (err) return done.fail();
                    ({teamReadScope, teamReadOauthTokenScope} = apiScopes);

                    // Get organizer profile
                    stubOrganizationRead((err, apiScopes) => {
                      if (err) return done.fail();
                      ({organizationReadScope, organizationReadOauthTokenScope} = apiScopes);

                      // Update former organizer's record
                      stubUserAppMetadataUpdate((err, apiScopes) => {
                        if (err) return done.fail();
                        ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);
                        done();
                      });
                    });
                  });
                });
              });
            });

            describe('session access', () => {

              it('removes organization from Auth0', done => {
                expect(_profile.user_metadata.organizations.length).toEqual(1);
                authenticatedSession
                  .delete(`/organization/${organizationId}`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end((err, res) => {
                    if (err) return done.fail(err);
                    expect(res.body.message).toEqual('Organization deleted');
                    expect(_profile.user_metadata.organizations.length).toEqual(0);
                    done();
                  });
              });

              it('updates the user session data', done => {
                models.Session.findAll().then(results => {
                  expect(results.length).toEqual(1);
                  let session = JSON.parse(results[0].data).passport.user;
                  expect(session.user_metadata.organizations.length).toEqual(1);
                  expect(session.user_metadata.organizations[0].name).toEqual('One Book Canada');

                  authenticatedSession
                    .delete(`/organization/${organizationId}`)
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end((err, res) => {
                      if (err) return done.fail(err);

                      models.Session.findAll().then(results => {
                        expect(results.length).toEqual(1);
                        session = JSON.parse(results[0].data).passport.user;
                        expect(session.user_metadata.organizations.length).toEqual(0);

                        done();
                      }).catch(err => {
                        done.fail(err);
                      });
                    });
                }).catch(err => {
                  done.fail(err);
                });
              });

              describe('Auth0', () => {
                it('is called to retrieve any existing member teams', done => {
                  authenticatedSession
                    .delete(`/organization/${organizationId}`)
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end((err, res) => {
                      if (err) return done.fail(err);

                      expect(teamReadOauthTokenScope.isDone()).toBe(true);
                      expect(teamReadScope.isDone()).toBe(true);
                      done();
                    });
                });

                it('is called to retrieve the organizer\'s profile', done => {
                  authenticatedSession
                    .delete(`/organization/${organizationId}`)
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end((err, res) => {
                      if (err) return done.fail(err);

                      // 2020-6-18 Reuse token from above? This needs to be confirmed in production
                      expect(organizationReadOauthTokenScope.isDone()).toBe(false);
                      expect(organizationReadScope.isDone()).toBe(true);
                      done();
                    });
                });

                it('is called to update the former organizer agent', done => {
                  authenticatedSession
                    .delete(`/organization/${organizationId}`)
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end((err, res) => {
                      if (err) return done.fail(err);

                      // 2020-6-18 Reuse token from above? This needs to be confirmed in production
                      expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
                      expect(userAppMetadataUpdateScope.isDone()).toBe(true);
                      done();
                    });
                });
              });
            });

            describe('Bearer token access', () => {

              beforeEach(() => {
                const userInfoScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
                  .get(/userinfo/)
                  .reply(200, {
                    ..._identity,
                    permissions: [scope.delete.organizations],
                  });
              });

              it('removes organization from Auth0', done => {
                expect(_profile.user_metadata.organizations.length).toEqual(1);
                request(app)
                  .delete(`/organization/${organizationId}`)
                  .set('Authorization', `Bearer ${accessToken}`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end((err, res) => {
                    if (err) return done.fail(err);
                    expect(res.body.message).toEqual('Organization deleted');
                    expect(_profile.user_metadata.organizations.length).toEqual(0);
                    done();
                  });
              });

              describe('Auth0', () => {

                it('is called to retrieve any existing member teams', done => {
                  request(app)
                    .delete(`/organization/${organizationId}`)
                    .set('Authorization', `Bearer ${accessToken}`)
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end((err, res) => {
                      if (err) return done.fail(err);

                      expect(teamReadOauthTokenScope.isDone()).toBe(true);
                      expect(teamReadScope.isDone()).toBe(true);
                      done();
                    });
                });

                it('is called to retrieve the organizer\'s profile', done => {
                  request(app)
                    .delete(`/organization/${organizationId}`)
                    .set('Authorization', `Bearer ${accessToken}`)
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end((err, res) => {
                      if (err) return done.fail(err);

                      // 2020-6-18 Reuse token from above? This needs to be confirmed in production
                      expect(organizationReadOauthTokenScope.isDone()).toBe(false);
                      expect(organizationReadScope.isDone()).toBe(true);
                      done();
                    });
                });

                it('is called to update the former organizer agent', done => {
                  request(app)
                    .delete(`/organization/${organizationId}`)
                    .set('Authorization', `Bearer ${accessToken}`)
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end((err, res) => {
                      if (err) return done.fail(err);

                      // 2020-6-18 Reuse token from above? This needs to be confirmed in production
                      expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
                      expect(userAppMetadataUpdateScope.isDone()).toBe(true);
                      done();
                    });
                });
              });
            });
          });

          describe('unsuccessfully', () => {
            const memberTeams = [];

            beforeEach(done => {
              _profile.user_metadata = {
                organizations: [{ name: 'One Book Canada', organizer: _profile.email, id: organizationId }],
                pendingInvitations: [
                  { name: 'One Book Canada', recipient: 'someotherguy@example.com', uuid: organizationId, type: 'organization', teamId: uuid.v4() },
                  { name: 'One Book Canada', recipient: 'yetanotherguy@example.com', uuid: organizationId, type: 'organization', teamId: uuid.v4() }
                ],
              };

              stubAuth0ManagementApi((err, apiScopes) => {
                if (err) return done.fail();

                login(_identity, [scope.delete.organizations], (err, session) => {
                  if (err) return done.fail(err);
                  authenticatedSession = session;

                  // Check for member teams
                  memberTeams.push({
                    ..._profile,
                    name: 'A Aaronson',
                    email: 'aaaronson@example.com',
                    user_id: _profile.user_id + 1,
                    user_metadata: {
                      teams: [
                        { name: 'Asia Sensitive', leader: 'teamleader@example.com', id: uuid.v4(), organizationId: organizationId },
                      ]
                    }
                  });

                  stubTeamRead(memberTeams, (err, apiScopes) => {

                    if (err) return done.fail();
                    ({teamReadScope, teamReadOauthTokenScope} = apiScopes);

                    // Get organizer profile
                    stubOrganizationRead((err, apiScopes) => {
                      if (err) return done.fail();
                      ({organizationReadScope, organizationReadOauthTokenScope} = apiScopes);

                      // Update former organizer's record
                      stubUserAppMetadataUpdate((err, apiScopes) => {
                        if (err) return done.fail();
                        ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);
                        done();
                      });
                    });
                  });
                });
              });
            });

            afterEach(() => {
              memberTeams.length = 0;
            });

            describe('session access', () => {

              it('doesn\'t barf if organization doesn\'t exist', done => {
                authenticatedSession
                  .delete('/organization/333')
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(404)
                  .end((err, res) => {
                    if (err) return done.fail(err);
                    expect(res.body.message).toEqual('No such organization');
                    done();
                  });
              });

              it('doesn\'t delete if there are pending invitations', done => {
                memberTeams.length = 0;
                expect(_profile.user_metadata.pendingInvitations.length).toEqual(2);
                authenticatedSession
                  .delete(`/organization/${organizationId}`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(400)
                  .end((err, res) => {
                    if (err) return done.fail(err);

                    expect(res.body.message).toEqual('Organization has invitations pending. Cannot delete');
                    done();
                  });
              });

              it('doesn\'t delete if there are member teams', done => {
                authenticatedSession
                  .delete(`/organization/${organizationId}`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(400)
                  .end((err, res) => {
                    if (err) return done.fail(err);

                    expect(res.body.message).toEqual('Organization has member teams. Cannot delete');
                    done();
                  });
              });

              describe('Auth0', () => {
                it('is called to retrieve any existing member teams', done => {
                  authenticatedSession
                    .delete(`/organization/${organizationId}`)
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(400)
                    .end((err, res) => {
                      if (err) return done.fail(err);

                      expect(teamReadOauthTokenScope.isDone()).toBe(true);
                      expect(teamReadScope.isDone()).toBe(true);
                      done();
                    });
                });

                it('is not called to retrieve the organizer\'s profile', done => {
                  authenticatedSession
                    .delete(`/organization/${organizationId}`)
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(400)
                    .end((err, res) => {
                      if (err) return done.fail(err);

                      expect(organizationReadOauthTokenScope.isDone()).toBe(false);
                      expect(organizationReadScope.isDone()).toBe(false);
                      done();
                    });
                });

                it('is not called to update the former organizer agent', done => {
                  authenticatedSession
                    .delete(`/organization/${organizationId}`)
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(400)
                    .end((err, res) => {
                      if (err) return done.fail(err);

                      expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
                      expect(userAppMetadataUpdateScope.isDone()).toBe(false);
                      done();
                    });
                });
              });
            });

            describe('Bearer token access', () => {

              beforeEach(() => {
                const userInfoScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
                  .get(/userinfo/)
                  .reply(200, {
                    ..._identity,
                    permissions: [scope.delete.organizations],
                  });
              });

              it('doesn\'t barf if organization doesn\'t exist', done => {
                request(app)
                  .delete('/organization/333')
                  .set('Authorization', `Bearer ${accessToken}`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(404)
                  .end((err, res) => {
                    if (err) return done.fail(err);
                    expect(res.body.message).toEqual('No such organization');
                    done();
                  });
              });

              it('doesn\'t delete if there are pending invitations', done => {
                memberTeams.length = 0;
                expect(_profile.user_metadata.pendingInvitations.length).toEqual(2);
                request(app)
                  .delete(`/organization/${organizationId}`)
                  .set('Authorization', `Bearer ${accessToken}`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(400)
                  .end((err, res) => {
                    if (err) return done.fail(err);

                    expect(res.body.message).toEqual('Organization has invitations pending. Cannot delete');
                    done();
                  });
              });

              it('doesn\'t delete if there are member teams', done => {
                request(app)
                  .delete(`/organization/${organizationId}`)
                  .set('Authorization', `Bearer ${accessToken}`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(400)
                  .end((err, res) => {
                    if (err) return done.fail(err);

                    expect(res.body.message).toEqual('Organization has member teams. Cannot delete');
                    done();
                  });
              });

              describe('Auth0', () => {

                it('is called to retrieve any existing member teams', done => {
                  request(app)
                    .delete(`/organization/${organizationId}`)
                    .set('Authorization', `Bearer ${accessToken}`)
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(400)
                    .end((err, res) => {
                      if (err) return done.fail(err);

                      expect(teamReadOauthTokenScope.isDone()).toBe(true);
                      expect(teamReadScope.isDone()).toBe(true);
                      done();
                    });
                });

                it('is not called to retrieve the organizer\'s profile', done => {
                  request(app)
                    .delete(`/organization/${organizationId}`)
                    .set('Authorization', `Bearer ${accessToken}`)
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(400)
                    .end((err, res) => {
                      if (err) return done.fail(err);

                      expect(organizationReadOauthTokenScope.isDone()).toBe(false);
                      expect(organizationReadScope.isDone()).toBe(false);
                      done();
                    });
                });

                it('is not called to update the former organizer agent', done => {
                  request(app)
                    .delete(`/organization/${organizationId}`)
                    .set('Authorization', `Bearer ${accessToken}`)
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(400)
                    .end((err, res) => {
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

    describe('not verified', () => {

      let invitedAgent;
      beforeEach(done => {
        models.Agent.create({ email: 'invitedagent@example.com' }).then(a => {
          invitedAgent = a;
          done();
        }).catch(err => {
          done.fail(err);
        });
      });

      describe('update', () => {

        describe('PUT', () => {

          let unverifiedSession, organizationId,
              organizationReadByNameScope, organizationReadByNameOauthTokenScope,
              organizationReadByIdScope, organizationReadByIdOauthTokenScope;

          beforeEach(done => {
            organizationId = uuid.v4();

            _profile.email = invitedAgent.email;
            _profile.name = invitedAgent.name;

            stubAuth0ManagementApi((err, apiScopes) => {
              if (err) return done.fail(err);

              login({ ..._identity, email: invitedAgent.email }, [scope.update.organizations], (err, session, token) => {
                if (err) return done.fail(err);
                accessToken = token;
                unverifiedSession = session;

                // See if organization name is already registered
                stubOrganizationRead([], (err, apiScopes) => {
                  if (err) return done.fail(err);
                  ({organizationReadScope: organizationReadByNameScope, organizationReadOauthTokenScope: organizationReadByNameOauthTokenScope} = apiScopes);

                  // Get organization by ID
                  stubOrganizationRead([
                                         {..._profile, email: 'someguy@example.com', name: 'Some Guy',
                                            user_metadata: { organizations: [{ name: 'One Book Canada', organizer: _profile.email, id: organizationId }] }
                                         }
                                       ], (err, apiScopes) => {
                    if (err) return done.fail(err);
                    ({organizationReadScope: organizationReadByIdScope, organizationReadOauthTokenScope: organizationReadByIdOauthTokenScope} = apiScopes);

                    done();
                  });
                });
              });
            });
          });

          describe('session access', () => {

            it('returns 403', done => {
              unverifiedSession
                .put(`/organization/${organizationId}`)
                .send({
                  name: 'Two Testaments Bolivia'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(403)
                .end((err, res) => {
                  if (err) done.fail(err);
                  expect(res.body.message).toEqual('You are not an organizer');
                  done();
                });
            });
          });

          describe('Bearer token access', () => {

            beforeEach(() => {
              const userInfoScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
                .get(/userinfo/)
                .reply(200, {
                  ..._identity,
                  email: _profile.email,
                  permissions: [scope.update.organizations],
                });
            });

            it('returns 403', done => {
              request(app)
                .put(`/organization/${organizationId}`)
                .send({
                  name: 'Two Testaments Bolivia'
                })
                .set('Authorization', `Bearer ${accessToken}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(403)
                .end((err, res) => {
                  if (err) done.fail(err);
                  expect(res.body.message).toEqual('You are not an organizer');
                  done();
                });
            });
          });
        });
      });
    });

    describe('forbidden', () => {

      let unauthorizedSession;
      beforeEach(done => {
        models.Agent.create({ email: 'suspiciousagent@example.com', name: 'Suspicious Guy' }).then(a => {

          _profile.email = a.email;
          _profile.name = a.name;

          stubAuth0ManagementApi((err, apiScopes) => {
            if (err) return done.fail();

            login({..._identity, email: a.email}, [scope.update.organizations, scope.read.organizations, scope.delete.organizations], (err, session) => {
              if (err) return done.fail(err);
              unauthorizedSession = session;

              done();
            });
          });
        }).catch(err => {
          done.fail(err);
        });
      });

      describe('update', () => {

        describe('PUT', () => {

          let organizationId,
              organizationReadByNameScope, organizationReadByNameOauthTokenScope,
              organizationReadByIdScope, organizationReadByIdOauthTokenScope;

          beforeEach(done => {
            organizationId = uuid.v4();

            // See if organization name is already registered
            stubOrganizationRead([], (err, apiScopes) => {
              if (err) return done.fail(err);
              ({organizationReadScope: organizationReadByNameScope, organizationReadOauthTokenScope: organizationReadByNameOauthTokenScope} = apiScopes);

              // Get organization by ID
              stubOrganizationRead([
                                     {..._profile, email: 'someguy@example.com', name: 'Some Guy',
                                        user_metadata: { organizations: [{ name: 'One Book Canada', organizer: _profile.email, id: organizationId }] }
                                     }
                                   ], (err, apiScopes) => {
                if (err) return done.fail(err);
                ({organizationReadScope: organizationReadByIdScope, organizationReadOauthTokenScope: organizationReadByIdOauthTokenScope} = apiScopes);

                done();
              });
            });
          });

          describe('session access', () => {

            it('returns 403', done => {
              unauthorizedSession
                .put(`/organization/${organizationId}`)
                .send({
                  name: 'Two Testaments Bolivia'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(403)
                .end((err, res) => {
                  if (err) done.fail(err);
                  expect(res.body.message).toEqual('You are not an organizer');
                  done();
                });
            });
          });

          describe('Bearer token access', () => {

            beforeEach(() => {
              const userInfoScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
                .get(/userinfo/)
                .reply(200, {
                  ..._identity,
                  email: _profile.email,
                  permissions: [scope.update.organizations],
                });
            });

            it('returns 403', done => {
              unauthorizedSession
                .put(`/organization/${organizationId}`)
                .send({
                  name: 'Two Testaments Bolivia'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(403)
                .end((err, res) => {
                  if (err) done.fail(err);
                  expect(res.body.message).toEqual('You are not an organizer');
                  done();
                });
            });
          });
        });
      });

      describe('delete', () => {

        let organizationId;
        beforeEach(done => {
          organizationId = uuid.v4();

          // No member teams. Ready for deletion
          stubTeamRead([], (err, apiScopes) => {
            if (err) return done.fail();
            ({teamReadScope, teamReadOauthTokenScope} = apiScopes);

            // Get organizer profile
            stubOrganizationRead([{
              ..._profile,
              name: 'Some Guy',
              email: 'someguy@example.com',
              user_metadata: {
                organizations: [{ name: 'One Book Canada', organizer: 'someguy@example.com', id: organizationId }],
              }
            }], (err, apiScopes) => {
              if (err) return done.fail();
              ({organizationReadScope, organizationReadOauthTokenScope} = apiScopes);

              // Update former organizer's record
              stubUserAppMetadataUpdate((err, apiScopes) => {
                if (err) return done.fail();
                ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);
                done();
              });
            });
          });
        });

        describe('session access', () => {

          it('returns 403', done => {
            unauthorizedSession
              .delete(`/organization/${organizationId}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(403)
              .end((err, res) => {
                if (err) return done.fail(err);
                expect(res.body.message).toEqual('You are not the organizer');
                done();
              });
          });

          describe('Auth0', () => {

            it('is called to retrieve any existing member teams', done => {
              unauthorizedSession
                .delete(`/organization/${organizationId}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(403)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  expect(teamReadOauthTokenScope.isDone()).toBe(true);
                  expect(teamReadScope.isDone()).toBe(true);
                  done();
                });
            });

            it('is called to retrieve the organizer\'s profile', done => {
              unauthorizedSession
                .delete(`/organization/${organizationId}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(403)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  expect(organizationReadOauthTokenScope.isDone()).toBe(false);
                  expect(organizationReadScope.isDone()).toBe(true);
                  done();
                });
            });

            it('is not called to update the former organizer agent', done => {
              unauthorizedSession
                .delete(`/organization/${organizationId}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(403)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
                  expect(userAppMetadataUpdateScope.isDone()).toBe(false);
                  done();
                });
            });
          });
        });

        describe('Bearer token access', () => {

          beforeEach(() => {
            const userInfoScope = nock(`https://${process.env.AUTH0_CUSTOM_DOMAIN}`)
              .get(/userinfo/)
              .reply(200, {
                ..._identity,
                email: _profile.email,
                permissions: [scope.delete.organizations],
              });
          });

          it('returns 403', done => {
            request(app)
              .delete(`/organization/${organizationId}`)
              .set('Authorization', `Bearer ${accessToken}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(403)
              .end((err, res) => {
                if (err) return done.fail(err);
                expect(res.body.message).toEqual('You are not the organizer');
                done();
              });
          });

          describe('Auth0', () => {

            it('is called to retrieve any existing member teams', done => {
              request(app)
                .delete(`/organization/${organizationId}`)
                .set('Authorization', `Bearer ${accessToken}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(403)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  expect(teamReadOauthTokenScope.isDone()).toBe(true);
                  expect(teamReadScope.isDone()).toBe(true);
                  done();
                });
            });

            it('is called to retrieve the organizer\'s profile', done => {
              request(app)
                .delete(`/organization/${organizationId}`)
                .set('Authorization', `Bearer ${accessToken}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(403)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  expect(organizationReadOauthTokenScope.isDone()).toBe(false);
                  expect(organizationReadScope.isDone()).toBe(true);
                  done();
                });
            });

            it('is not called to update the former organizer agent', done => {
              request(app)
                .delete(`/organization/${organizationId}`)
                .set('Authorization', `Bearer ${accessToken}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(403)
                .end((err, res) => {
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

  describe('not authenticated', () => {
    it('redirects to login', done => {
      request(app)
        .get('/organization')
        .send({ name: 'Some org' })
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
