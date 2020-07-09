const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001;
const app = require('../../app');
const fixtures = require('sequelize-fixtures');
const models = require('../../models');
const request = require('supertest');
const stubAuth0Sessions = require('../support/stubAuth0Sessions');
const stubAuth0ManagementApi = require('../support/stubAuth0ManagementApi');
const stubAuth0ManagementEndpoint = require('../support/stubAuth0ManagementEndpoint');
const stubUserAppMetadataUpdate = require('../support/auth0Endpoints/stubUserAppMetadataUpdate');
const stubUserRead = require('../support/auth0Endpoints/stubUserRead');
const stubUserRolesRead = require('../support/auth0Endpoints/stubUserRolesRead');
const stubTeamRead = require('../support/auth0Endpoints/stubTeamRead');
const mailer = require('../../mailer');
const uuid = require('uuid');
const scope = require('../../config/permissions');
const apiScope = require('../../config/apiPermissions');

/**
 * 2019-11-13
 * Sample tokens taken from:
 *
 * https://auth0.com/docs/api-auth/tutorials/adoption/api-tokens
 */
const _identity = require('../fixtures/sample-auth0-identity-token');
const _profile = require('../fixtures/sample-auth0-profile-response');

describe('organizationMembershipSpec', () => {

  let login, pub, prv, keystore;
  beforeEach(done => {
    stubAuth0Sessions((err, sessionStuff) => {
      if (err) return done.fail(err);
      ({ login, pub, prv, keystore } = sessionStuff);
      done();
    });
  });

  afterEach(() => {
    mailer.transport.sentMail = [];
  });

  let agent;
  beforeEach(done => {
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

  describe('authenticated', () => {

    describe('authorized', () => {

      describe('create', () => {
        let authenticatedSession, organizationId, teamId,
            teamReadScope, teamReadOauthTokenScope,
            userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope;
        const coach = { ..._profile, name: 'Curt Malawsky', email: 'coach@example.com'};

        beforeEach(done => {
          organizationId = uuid.v4();
          teamId = uuid.v4();

          _profile.user_metadata = { organizations: [ {name: 'The National Lacrosse League', organizer: _profile.email, id: organizationId } ] };

          coach.user_metadata = { teams: [ {name: 'The Calgary Roughnecks', leader: 'coach@example.com', id: teamId } ] };

          stubAuth0ManagementApi((err, apiScopes) => {
            if (err) return done.fail(err);

            login(_identity, [scope.create.organizationMembers], (err, session) => {
              if (err) return done.fail(err);
              authenticatedSession = session;

              // Cached profile doesn't match "live" data, so agent needs to be updated
              // with a call to Auth0
              stubUserRead((err, apiScopes) => {
                if (err) return done.fail(err);

                // Get all team members in order to identify leader
                stubTeamRead([coach,
                  {
                    ..._profile,
                    name: 'Tracey Kelusky',
                    email: 'player@example.com',
                    user_metadata: { teams: [ {name: 'The Calgary Roughnecks', leader: 'coach@example.com', id: teamId } ] }
                  }
                ], (err, apiScopes) => {
                  if (err) return done.fail(err);
                  ({teamReadScope, teamReadOauthTokenScope} = apiScopes);

                  // Update team leader record
                  stubUserAppMetadataUpdate(coach, (err, apiScopes) => {
                    if (err) return done.fail(err);
                    ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);
                    done();
                  });
                });
              });
            });
          });
        });

        describe('successfully', () => {
          it('returns the organization with the new member team', done => {
            authenticatedSession
              .put(`/organization/${organizationId}/team`)
              .send({
                teamId: teamId
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);
                expect(res.body.name).toEqual('The National Lacrosse League');
                expect(res.body.organizer).toEqual(_profile.email);
                expect(res.body.id).toEqual(organizationId);
                expect(res.body.teams.length).toEqual(1);
                expect(res.body.teams[0]).toEqual({ name: 'The Calgary Roughnecks', leader: 'coach@example.com', id: teamId, organizationId: organizationId });

                done();
              });
          });

          it('adds organizationId to the team leader\'s team record', done => {
            expect(coach.user_metadata.teams.length).toEqual(1);
            expect(coach.user_metadata.teams[0].organizationId).toBeUndefined();
            authenticatedSession
              .put(`/organization/${organizationId}/team`)
              .send({
                teamId: teamId
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);

                expect(coach.user_metadata.teams.length).toEqual(1);
                expect(coach.user_metadata.teams[0].organizationId).toEqual(organizationId);

                done();
              });
          });

          it('creates invitation database records for all team members (excluding the leader)', done => {
            models.Invitation.findAll().then(results => {
              expect(results.length).toEqual(0);

              authenticatedSession
                .put(`/organization/${organizationId}/team`)
                .send({
                  teamId: teamId
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  models.Invitation.findAll().then(results => {
                    expect(results.length).toEqual(1);
                    expect(results[0].recipient).toEqual('player@example.com');
                    expect(results[0].name).toEqual('The National Lacrosse League');
                    expect(results[0].uuid).toEqual(organizationId);
                    expect(results[0].type).toEqual('organization');

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
            it('is called to retrieve team', done => {
              authenticatedSession
                .put(`/organization/${organizationId}/team`)
                .send({
                  teamId: teamId
                })
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

            it('is called to update team leader', done => {
              authenticatedSession
                .put(`/organization/${organizationId}/team`)
                .send({
                  teamId: teamId
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) return done.fail(err);
                  expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
                  expect(userAppMetadataUpdateScope.isDone()).toBe(true);

                  done();
                });
            });
          });
        });

        describe('unsuccessfully', () => {
          it('doesn\'t barf if organization doesn\'t exist', done => {
            authenticatedSession
              .put('/organization/no-such-organization-uuid-v4/team')
              .send({
                teamId: teamId
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

          it('doesn\'t barf if team doesn\'t exist', done => {
            authenticatedSession
              .put(`/organization/${organizationId}/team`)
              .send({
                teamId: 'no-such-team-uuid-v4'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(404)
              .end(function(err, res) {
                if (err) return done.fail(err);
                expect(res.body.message).toEqual('No such team');

                done();
              });
          });

          it('doesn\'t barf if team not provided', done => {
            authenticatedSession
              .put(`/organization/${organizationId}/team`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(400)
              .end(function(err, res) {
                if (err) return done.fail(err);
                expect(res.body.message).toEqual('No team provided');

                done();
              });
          });

          describe('team is already a member of different organization', () => {

            let anotherOrgId;
            beforeEach(done => {
              authenticatedSession
                .put(`/organization/${organizationId}/team`)
                .send({
                  teamId: teamId
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  anotherOrgId = uuid.v4();
                  _profile.user_metadata = { organizations: [ {name: 'The Western Lacrosse Association', organizer: _profile.email, id: anotherOrgId } ] };

                  stubAuth0ManagementApi((err, apiScopes) => {
                    if (err) return done.fail(err);

                    login(_identity, [scope.create.organizationMembers], (err, session) => {
                      if (err) return done.fail(err);
                      authenticatedSession = session;

                      // Cached profile doesn't match "live" data, so agent needs to be updated
                      // with a call to Auth0
                      stubUserRead((err, apiScopes) => {
                        if (err) return done.fail(err);

                        // Get all team members in order to identify leader
                        stubTeamRead([coach,
                          {
                            ..._profile,
                            name: 'Tracey Kelusky',
                            email: 'player@example.com',
                            user_metadata: { teams: [ {name: 'The Calgary Roughnecks', leader: 'coach@example.com', id: teamId, organizationId: organizationId} ] }
                          }
                        ], (err, apiScopes) => {
                          if (err) return done.fail(err);
                          ({teamReadScope, teamReadOauthTokenScope} = apiScopes);

                          // Update team leader record
                          stubUserAppMetadataUpdate(coach, (err, apiScopes) => {
                            if (err) return done.fail(err);
                            ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);

                            done();
                          });
                        });
                      });
                    });
                  });
                });
            });

            it('returns a friendly message', done => {
              authenticatedSession
                .put(`/organization/${anotherOrgId}/team`)
                .send({
                  teamId: teamId
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200)
                .end(function(err, res) {
                  if (err) return done.fail(err);
                  expect(res.body.message).toEqual('That team is already a member of another organization');

                  done();
                });
            });

            describe('Auth0', () => {
              it('is called to retrieve team', done => {
                authenticatedSession
                  .put(`/organization/${anotherOrgId}/team`)
                  .send({
                    teamId: teamId
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(200)
                  .end(function(err, res) {
                    if (err) return done.fail(err);
                    expect(teamReadOauthTokenScope.isDone()).toBe(true);
                    expect(teamReadScope.isDone()).toBe(true);

                    done();
                  });
              });

              it('is not called to update team leader', done => {
                authenticatedSession
                  .put(`/organization/${anotherOrgId}/team`)
                  .send({
                    teamId: teamId
                  })
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

          describe('team is already a member of the organization', () => {
            beforeEach(done => {
              authenticatedSession
                .put(`/organization/${organizationId}/team`)
                .send({
                  teamId: teamId
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  stubAuth0ManagementApi((err, apiScopes) => {
                    if (err) return done.fail(err);

                    // Cached profile doesn't match "live" data, so agent needs to be updated
                    // with a call to Auth0
                    stubUserRead((err, apiScopes) => {
                      if (err) return done.fail(err);

                      // Get all team members in order to identify leader
                      stubTeamRead([coach,
                        {
                          ..._profile,
                          name: 'Tracey Kelusky',
                          email: 'player@example.com',
                          user_metadata: { teams: [ {name: 'The Calgary Roughnecks', leader: 'coach@example.com', id: teamId } ] }
                        }
                      ], (err, apiScopes) => {
                        if (err) return done.fail(err);
                        ({teamReadScope, teamReadOauthTokenScope} = apiScopes);

                        // Update team leader record
                        stubUserAppMetadataUpdate(coach, (err, apiScopes) => {
                          if (err) return done.fail(err);
                          ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);

                          done();
                        });
                      });
                    });
                  });
                });
            });

            it('returns a friendly message', done => {
              authenticatedSession
                .put(`/organization/${organizationId}/team`)
                .send({
                  teamId: teamId
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200)
                .end(function(err, res) {
                  if (err) return done.fail(err);
                  expect(res.body.message).toEqual('That team is already a member of the organization');
                  done();
                });
            });

            describe('Auth0', () => {
              it('is called to retrieve team', done => {
                authenticatedSession
                  .put(`/organization/${organizationId}/team`)
                  .send({
                    teamId: teamId
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(200)
                  .end(function(err, res) {
                    if (err) return done.fail(err);
                    expect(teamReadOauthTokenScope.isDone()).toBe(true);
                    expect(teamReadScope.isDone()).toBe(true);

                    done();
                  });
              });

              it('is not called to update team leader', done => {
                authenticatedSession
                  .put(`/organization/${organizationId}/team`)
                  .send({
                    teamId: teamId
                  })
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

      describe('delete', () => {
        let authenticatedSession;
        beforeEach(done => {
          stubAuth0ManagementApi((err, apiScopes) => {
            if (err) return done.fail();

            login(_identity, [scope.delete.organizationMembers], (err, session) => {
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

        describe('successfully', () => {
          it('returns the organization with the new member team', done => {
            done.fail();
          });

          it('creates invitation records for all team members with organizationId attached', done => {
            done.fail();
          });
        });

        describe('unsuccessfully', () => {
          it('doesn\'t barf if organization doesn\'t exist', done => {
            done.fail();
          });

          it('doesn\'t barf if team doesn\'t exist', done => {
            done.fail();
          });

          it('returns a friendly message if team is already a member of different organization', done => {
            done.fail();
          });

          it('returns a friendly message if team is already a member of the organization', done => {
            done.fail();
          });
        });
      });
    });

//    describe('forbidden', () => {
//      let originalProfile;
//
//      let forbiddenSession, suspiciousAgent;
//      beforeEach(done => {
//
//        originalProfile = {..._profile};
//        _profile.email = 'suspiciousagent@example.com';
//        _profile.name = 'Suspicious Guy';
//
//        models.Agent.create({ email: 'suspiciousagent@example.com' }).then(a => {
//          suspiciousAgent = a;
//          stubAuth0ManagementApi((err, apiScopes) => {
//            if (err) return done.fail();
//
//            login({ ..._identity, email: suspiciousAgent.email }, [scope.create.organizationMembers], (err, session) => {
//              if (err) return done.fail(err);
//              forbiddenSession = session;
//
//              // Cached profile doesn't match "live" data, so agent needs to be updated
//              // with a call to Auth0
//              stubUserRead((err, apiScopes) => {
//                if (err) return done.fail();
//
//                done();
//              });
//            });
//          });
//        }).catch(err => {
//          done.fail(err);
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
//      describe('create', () => {
//        it('doesn\'t allow a non-member agent to add a member', done => {
//          forbiddenSession
//            .put(`/organization/${organization.id}/agent`)
//            .send({
//              email: suspiciousAgent.email
//            })
//            .set('Accept', 'application/json')
//            .expect('Content-Type', /json/)
//            .expect(403)
//            .end(function(err, res) {
//              if (err) return done.fail(err);
//              expect(res.body.message).toEqual('You are not a member of this organization');
//              done();
//            });
//        });
//      });
//
//      describe('delete', () => {
//        let knownAgent;
//        beforeEach(done => {
//          models.Agent.create({ email: 'weknowthisguy@example.com', name: 'Well-known Guy' }).then(result => {
//            knownAgent = result;
//            organization.addMember(knownAgent).then(result => {
//              done();
//            }).catch(err => {
//              done.fail(err);
//            });
//          }).catch(err => {
//            done.fail(err);
//          });
//        });
//
//        it('returns 403', done => {
//          forbiddenSession
//            .delete(`/organization/${organization.id}/agent/${knownAgent.id}`)
//            .set('Accept', 'application/json')
//            .expect('Content-Type', /json/)
//            .expect(403)
//            .end(function(err, res) {
//              if (err) return done.fail(err);
//              expect(res.body.message).toEqual('Insufficient scope');
//              done();
//            });
//        });
//
//        it('does not remove the record from the database', done => {
//          models.Organization.findAll({ include: [ 'creator', { model: models.Agent, as: 'members' } ] }).then(results => {
//            expect(results.length).toEqual(1);
//            expect(results[0].members.length).toEqual(2);
//
//            forbiddenSession
//              .delete(`/organization/${organization.id}/agent/${knownAgent.id}`)
//              .set('Accept', 'application/json')
//              .expect('Content-Type', /json/)
//              .expect(403)
//              .end(function(err, res) {
//                if (err) return done.fail(err);
//                models.Organization.findAll({ include: [ 'creator', { model: models.Agent, as: 'members' } ] }).then(results => {
//                  expect(results.length).toEqual(1);
//                  expect(results[0].members.length).toEqual(2);
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
//    });
  });

//  describe('not authenticated', () => {
//
//    it('redirects to /login', done => {
//      request(app)
//        .get('/organization')
//        .send({ name: 'Some org' })
//        .set('Accept', 'application/json')
//        .expect(302)
//        .end(function(err, res) {
//          if (err) return done.fail(err);
//          expect(res.headers.location).toEqual('/login');
//          done();
//        });
//    });
//  });
});
