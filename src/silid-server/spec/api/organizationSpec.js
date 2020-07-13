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
const _identity = require('../fixtures/sample-auth0-identity-token');
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

  let originalProfile;
  let organization, agent;
  beforeEach(done => {
    originalProfile = {..._profile};

    models.sequelize.sync({force: true}).then(() => {
      fixtures.loadFile(`${__dirname}/../fixtures/agents.json`, models).then(() => {
        models.Agent.findAll().then(results => {
          agent = results[0];
          fixtures.loadFile(`${__dirname}/../fixtures/organizations.json`, models).then(() => {
            models.Organization.findAll().then(results => {
              organization = results[0];
              done();
            });
          }).catch(err => {
            done.fail(err);
          });
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

  let oauthTokenScope, authenticatedSession,
      userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope,
      userAppMetadataReadScope, userAppMetadataReadOauthTokenScope,
      teamReadScope, teamReadOauthTokenScope,
      organizationReadScope, organizationReadOauthTokenScope;

  describe('authenticated', () => {

    describe('authorized', () => {

      describe('create', () => {

        describe('successfully', () => {
          beforeEach(done => {
            stubAuth0ManagementApi((err, apiScopes) => {
              if (err) return done.fail();

              login(_identity, [scope.create.organizations], (err, session) => {
                if (err) return done.fail(err);
                authenticatedSession = session;

                // Cached profile doesn't match "live" data, so agent needs to be updated
                // with a call to Auth0
                stubUserRead((err, apiScopes) => {
                  if (err) return done.fail();

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
          });

          it('returns the agent profile', done => {
            authenticatedSession
              .post('/organization')
              .send({
                name: 'One Book Canada'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);
                expect(res.body.email).toEqual(_profile.email);
                expect(res.body.user_metadata.organizations.length).toEqual(1);
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
                .expect(201)
                .end(function(err, res) {
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
                .end(function(err, res) {
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
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  // 2020-6-17 Reuse token from above? This needs to be confirmed in production
                  expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
                  expect(userAppMetadataUpdateScope.isDone()).toBe(true);
                  done();
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

                // Cached profile doesn't match "live" data, so agent needs to be updated
                // with a call to Auth0
                stubUserRead((err, apiScopes) => {
                  if (err) return done.fail();

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
          });

          describe('add a duplicate organization name', () => {
            it('returns an error if record already exists', done => {
              authenticatedSession
                .post('/organization')
                .send({
                  name: 'One Book Canada'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(400)
                .end(function(err, res) {
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
                  .end(function(err, res) {
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
                  .end(function(err, res) {
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
                  .end(function(err, res) {
                    if (err) return done.fail(err);

                    expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
                    expect(userAppMetadataUpdateScope.isDone()).toBe(false);
                    done();
                  });
              });
            });
          });

          it('returns an error if empty organization name provided', done => {
            authenticatedSession
              .post('/organization')
              .send({
                name: '   '
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(400)
              .end(function(err, res) {
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
              .end(function(err, res) {
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
              .end(function(err, res) {
                if (err) return done.fail(err);
                expect(res.body.errors.length).toEqual(1);
                expect(res.body.errors[0].message).toEqual('Organization name is too long');
                done();
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

            login(_identity, [scope.update.organizations], (err, session) => {

              if (err) return done.fail(err);
              authenticatedSession = session;

              // Cached profile doesn't match "live" data, so agent needs to be updated
              // with a call to Auth0
              stubUserRead((err, apiScopes) => {
                if (err) return done.fail();

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

//                      // Get RSVPs
//                      rsvpList.push({
//                                      ..._profile,
//                                      name: 'Some Other Guy',
//                                      email: 'someotherguy@example.com',
//                                      user_id: _profile.user_id + 2,
//                                      user_metadata: {
//                                        rsvps: [
//                                          { name: 'One Book Canada', recipient: 'someotherguy@example.com', uuid: organizationId, type: 'organization', teamId: teamId }
//                                        ]
//                                      }
//                                    });
//                      rsvpList.push({
//                                      ..._profile,
//                                      name: 'Yet Another Guy',
//                                      email: 'yetanotherguy@example.com',
//                                      user_id: _profile.user_id + 3,
//                                      user_metadata: {
//                                        rsvps: [
//                                          { name: 'One Book Canada', recipient: 'yetanotherguy@example.com', uuid: organizationId, type: 'organization', teamId: team2Id }
//                                        ]
//                                      }
//                                    });
//                      stubTeamRead(rsvpList, (err, apiScopes) => {
//                        if (err) return done.fail();
//                        ({teamReadScope: teamReadRsvpsScope, teamReadOauthTokenScope: teamReadRsvpsOauthTokenScope} = apiScopes);

                        stubUserAppMetadataUpdate((err, apiScopes) => {
                          if (err) return done.fail();
                          ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);
                          done();
                        });
//                      });
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

        it('allows a team creator to update an existing record', done => {
          authenticatedSession
            .put(`/organization/${organizationId}`)
            .send({
              name: 'Two Testaments Bolivia'
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
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

//        fit('updates any pending invitations', done => {
//          expect(_profile.user_metadata.pendingInvitations.length).toEqual(2);
//          expect(_profile.user_metadata.pendingInvitations[0].name).toEqual('One Book Canada');
//          expect(_profile.user_metadata.pendingInvitations[1].name).toEqual('One Book Canada');
//
//          authenticatedSession
//            .put(`/organization/${organizationId}`)
//            .send({
//              name: 'Two Testaments Bolivia'
//            })
//            .set('Accept', 'application/json')
//            .expect('Content-Type', /json/)
//            .expect(201)
//            .end(function(err, res) {
//              if (err) return done.fail(err);
//
//              expect(_profile.user_metadata.pendingInvitations.length).toEqual(2);
//              expect(_profile.user_metadata.pendingInvitations[0].name).toEqual('Two Testaments Bolivia');
//              expect(_profile.user_metadata.pendingInvitations[1].name).toEqual('Two Testaments Bolivia');
//              done();
//            });
//        });

//        fit('updates any database updates', done => {
//          models.Update.create({ recipient: 'onecooldude@example.com', uuid: organizationId, type: 'team',
//                                 data: {name: 'One Book Canada', leader: '', organizationId: organizationId} }).then(results => {
//            authenticatedSession
//              .put(`/organization/${organizationId}`)
//              .send({
//                name: 'Two Testaments Bolivia'
//              })
//              .set('Accept', 'application/json')
//              .expect('Content-Type', /json/)
//              .expect(201)
//              .end(function(err, res) {
//                if (err) return done.fail(err);
//
//                models.Update.findByPk(results.id).then(updates => {
//                  expect(updates.name).toEqual('Two Testaments Bolivia');
//                  expect(updates.recipient).toEqual('onecooldude@example.com');
//                  expect(updates.uuid).toEqual(organizationId);
//                  expect(updates.teamId).toEqual(teamId);
//                  done();
//                }).catch(err => {
//                  done.fail(err);
//                });
//              });
//          }).catch(err => {
//            done.fail(err);
//          });
//        });

//        it('create update in DB to updates any RSVPs on next login', done => {
//          models.Update.findAll().then(updates => {
//            expect(updates.length).toEqual(0);
//
//            authenticatedSession
//              .put(`/organization/${organizationId}`)
//              .send({
//                name: 'Two Testaments Bolivia'
//              })
//              .set('Accept', 'application/json')
//              .expect('Content-Type', /json/)
//              .expect(201)
//              .end(function(err, res) {
//                if (err) return done.fail(err);
//
//                models.Update.findAll().then(updates => {
//                  expect(updates.length).toEqual(2);
//                  expect(updates[0].name).toEqual('Two Testaments Bolivia');
//                  expect(updates[1].name).toEqual('Two Testaments Bolivia');
//                  done();
//                }).catch(err => {
//                  done.fail(err);
//                });
//              });
//          }).catch(err => {
//            done.fail(err);
//          });
//        });

        it('returns an error if empty organization name provided', done => {
          authenticatedSession
            .put(`/organization/${organizationId}`)
            .send({
              name: '   '
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(400)
            .end(function(err, res) {
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
            .end(function(err, res) {
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
            .end(function(err, res) {
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
              .end(function(err, res) {
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
              .end(function(err, res) {
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
              .end(function(err, res) {
                if (err) return done.fail(err);

                // 2020-6-17 Reuse token from above? This needs to be confirmed in production
                expect(teamMembershipReadOauthTokenScope.isDone()).toBe(false);
                expect(teamMembershipReadScope.isDone()).toBe(true);
                done();
              });
          });

//          it('is called to retrieve outstanding RSVPs', done => {
//            authenticatedSession
//              .put(`/organization/${organizationId}`)
//              .send({
//                name: 'Two Testaments Bolivia'
//              })
//              .set('Accept', 'application/json')
//              .expect('Content-Type', /json/)
//              .expect(201)
//              .end(function(err, res) {
//                if (err) return done.fail(err);
//
//                // 2020-6-17 Reuse token from above? This needs to be confirmed in production
//                expect(teamReadRsvpsOauthTokenScope.isDone()).toBe(false);
//                expect(teamReadRsvpsScope.isDone()).toBe(true);
//                done();
//              });
//          });

          it('is called to update the agent user_metadata', done => {
            authenticatedSession
              .put(`/organization/${organizationId}`)
              .send({
                name: 'Two Testaments Bolivia'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);

                // 2020-6-17 Reuse token from above? This needs to be confirmed in production
                expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
                expect(userAppMetadataUpdateScope.isDone()).toBe(true);
                done();
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

                  // Cached profile doesn't match "live" data, so agent needs to be updated
                  // with a call to Auth0
                  stubUserRead((err, apiScopes) => {
                    if (err) return done.fail();

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
            });

            it('removes organization from Auth0', done => {
              expect(_profile.user_metadata.organizations.length).toEqual(1);
              authenticatedSession
                .delete(`/organization/${organizationId}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) return done.fail(err);
                  expect(res.body.message).toEqual('Organization deleted');
                  expect(_profile.user_metadata.organizations.length).toEqual(0);
                  done();
                });
            });

            describe('Auth0', () => {
              it('is called to retrieve any existing member teams', done => {
                authenticatedSession
                  .delete(`/organization/${organizationId}`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
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
                  .end(function(err, res) {
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
                  .end(function(err, res) {
                    if (err) return done.fail(err);

                    // 2020-6-18 Reuse token from above? This needs to be confirmed in production
                    expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
                    expect(userAppMetadataUpdateScope.isDone()).toBe(true);
                    done();
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

                  // Cached profile doesn't match "live" data, so agent needs to be updated
                  // with a call to Auth0
                  stubUserRead((err, apiScopes) => {
                    if (err) return done.fail();

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
            });

            afterEach(() => {
              memberTeams.length = 0;
            });

            it('doesn\'t barf if organization doesn\'t exist', done => {
              authenticatedSession
                .delete('/organization/333')
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(404)
                .end(function(err, res) {
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
                .end(function(err, res) {
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
                .end(function(err, res) {
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
                  .end(function(err, res) {
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
                  .end(function(err, res) {
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

    describe('not verified', () => {

      let invitedAgent;
      beforeEach(done => {
        models.Agent.create({ email: 'invitedagent@example.com' }).then(a => {
          invitedAgent = a;
          models.OrganizationMember.create({ AgentId: a.id, OrganizationId: organization.id }).then(o => {
            done();
          }).catch(err => {
            done.fail(err);
          });
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

              login({ ..._identity, email: invitedAgent.email }, [scope.update.organizations], (err, session) => {
                if (err) return done.fail(err);
                unverifiedSession = session;

                // Cached profile doesn't match "live" data, so agent needs to be updated
                // with a call to Auth0
                stubUserRead((err, apiScopes) => {
                  if (err) return done.fail(err);

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
          });

          it('returns 403', done => {
            unverifiedSession
              .put(`/organization/${organizationId}`)
              .send({
                name: 'Two Testaments Bolivia'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(403)
              .end(function(err, res) {
                if (err) done.fail(err);
                expect(res.body.message).toEqual('You are not an organizer');
                done();
              });
          });

          it('does not change the record in the database', done => {
            unverifiedSession
              .put(`/organization/${organizationId}`)
              .send({
                name: 'Two Testaments Bolivia'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(403)
              .end(function(err, res) {
                if (err) return done.fail(err);
                models.Organization.findOne({ where: { id: organization.id }}).then(results => {
                  expect(results.name).toEqual(organization.name);
                  done();
                }).catch(err => {
                  done.fail(err);
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

              // Cached profile doesn't match "live" data, so agent needs to be updated
              // with a call to Auth0
              stubUserRead((err, apiScopes) => {
                if (err) return done.fail();

                done();
              });
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

          it('returns 403', done => {
            unauthorizedSession
              .put(`/organization/${organizationId}`)
              .send({
                name: 'Two Testaments Bolivia'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(403)
              .end(function(err, res) {
                if (err) done.fail(err);
                expect(res.body.message).toEqual('You are not an organizer');
                done();
              });
          });

          it('does not change the record in the database', done => {
            unauthorizedSession
              .put(`/organization/${organizationId}`)
              .send({
                name: 'Two Testaments Bolivia'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(403)
              .end(function(err, res) {
                if (err) return done.fail(err);
                models.Organization.findOne({ where: { id: organization.id }}).then(results => {
                  expect(results.name).toEqual(organization.name);
                  done();
                }).catch(err => {
                  done.fail(err);
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

        it('returns 403', done => {
          unauthorizedSession
            .delete(`/organization/${organizationId}`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(403)
            .end(function(err, res) {
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
              .end(function(err, res) {
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
              .end(function(err, res) {
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

  describe('not authenticated', () => {
    it('redirects to login', done => {
      request(app)
        .get('/organization')
        .send({ name: 'Some org' })
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
