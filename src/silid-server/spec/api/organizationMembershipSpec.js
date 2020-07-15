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

            login(_identity, [scope.add.organizationMembers], (err, session) => {
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
          it('redirects to /organization/:id', done => {
            authenticatedSession
              .put(`/organization/${organizationId}/team`)
              .send({
                teamId: teamId
              })
              .set('Accept', 'application/json')
              .expect('Location', `/organization/${organizationId}`)
              .expect(302)
              .end(function(err, res) {
                if (err) return done.fail(err);

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
              .expect('Location', `/organization/${organizationId}`)
              .expect(302)
              .end(function(err, res) {
                if (err) return done.fail(err);

                expect(coach.user_metadata.teams.length).toEqual(1);
                expect(coach.user_metadata.teams[0].organizationId).toEqual(organizationId);

                done();
              });
          });

          it('creates update database records for all team members (excluding the leader)', done => {
            models.Update.findAll().then(results => {
              expect(results.length).toEqual(0);

              authenticatedSession
                .put(`/organization/${organizationId}/team`)
                .send({
                  teamId: teamId
                })
                .set('Accept', 'application/json')
                .expect(302)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  models.Update.findAll().then(results => {
                    expect(results.length).toEqual(1);
                    expect(results[0].recipient).toEqual('player@example.com');
                    expect(results[0].uuid).toEqual(teamId);
                    expect(results[0].type).toEqual('team');
                    expect(results[0].data).toBeDefined();
                    expect(results[0].data.id).toEqual(teamId);
                    expect(results[0].data.name).toEqual('The Calgary Roughnecks');
                    expect(results[0].data.leader).toEqual('coach@example.com');
                    expect(results[0].data.organizationId).toEqual(organizationId);

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
                //.expect('Content-Type', /json/)
                .expect(302)
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
                .expect(302)
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
                .expect(302)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  anotherOrgId = uuid.v4();
                  _profile.user_metadata = { organizations: [ {name: 'The Western Lacrosse Association', organizer: _profile.email, id: anotherOrgId } ] };

                  stubAuth0ManagementApi((err, apiScopes) => {
                    if (err) return done.fail(err);

                    login(_identity, [scope.add.organizationMembers], (err, session) => {
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
                .expect(302)
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
        let authenticatedSession, organizationId, teamId, noOrgTeamId, anotherOrgId,
            teamReadScope, teamReadOauthTokenScope,
            userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope;
        const coach = { ..._profile, name: 'Curt Malawsky', email: 'coach@example.com'};

        beforeEach(done => {
          organizationId = uuid.v4();
          anotherOrgId = uuid.v4();
          teamId = uuid.v4();
          noOrgTeamId = uuid.v4();

          _profile.user_metadata = { organizations: [
            {name: 'The National Lacrosse League', organizer: _profile.email, id: organizationId },
            {name: 'The Canadian Lacrosse Association', organizer: _profile.email, id: anotherOrgId },
          ] };

          coach.user_metadata = { teams: [ {name: 'The Calgary Roughnecks', leader: 'coach@example.com', id: teamId, organizationId: organizationId } ] };

          stubAuth0ManagementApi((err, apiScopes) => {
            if (err) return done.fail(err);

            login(_identity, [scope.delete.organizationMembers], (err, session) => {
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
                    user_metadata: { teams: [ {name: 'The Calgary Roughnecks', leader: 'coach@example.com', id: teamId, organizationId: organizationId } ] }
                  },
                  {
                    ..._profile,
                    name: 'Derek Keenan',
                    email: 'coachkeenan@example.com',
                    user_metadata: { teams: [ {name: 'The Saskatchewan Rush', leader: 'coachkeenan@example.com', id: noOrgTeamId} ] }
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
          it('redirects to /organization/:id', done => {
            authenticatedSession
              .delete(`/organization/${organizationId}/team/${teamId}`)
              .set('Accept', 'application/json')
              .expect(302)
              .expect('Location', `/organization/${organizationId}`)
              .end(function(err, res) {
                if (err) return done.fail(err);

                done();
              });
          });

          it('removes organizationId from the team leader\'s team record', done => {
            expect(coach.user_metadata.teams.length).toEqual(1);
            expect(coach.user_metadata.teams[0].organizationId).toEqual(organizationId);
            authenticatedSession
              .delete(`/organization/${organizationId}/team/${teamId}`)
              .set('Accept', 'application/json')
              .expect(302)
              .expect('Location', `/organization/${organizationId}`)
              .end(function(err, res) {
                if (err) return done.fail(err);

                expect(coach.user_metadata.teams.length).toEqual(1);
                expect(coach.user_metadata.teams[0].organizationId).toBeUndefined();

                done();
              });
          });

          it('creates update records for all team members with organizationId undefined (excluding the leader)', done => {
            models.Update.findAll().then(results => {
              expect(results.length).toEqual(0);

              authenticatedSession
                .delete(`/organization/${organizationId}/team/${teamId}`)
                .set('Accept', 'application/json')
                .expect('Location', `/organization/${organizationId}`)
                .expect(302)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  models.Update.findAll().then(results => {
                    expect(results.length).toEqual(1);
                    expect(results[0].recipient).toEqual('player@example.com');
                    expect(results[0].uuid).toEqual(teamId);
                    expect(results[0].type).toEqual('team');

                    expect(results[0].data).toBeDefined();
                    expect(results[0].data.id).toEqual(teamId);
                    expect(results[0].data.name).toEqual('The Calgary Roughnecks');
                    expect(results[0].data.leader).toEqual('coach@example.com');
                    expect(results[0].data.organizationId).toBeUndefined();

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
                .delete(`/organization/${organizationId}/team/${teamId}`)
                .set('Accept', 'application/json')
                .expect('Location', `/organization/${organizationId}`)
                .expect(302)
                .end(function(err, res) {
                  if (err) return done.fail(err);
                  expect(teamReadOauthTokenScope.isDone()).toBe(true);
                  expect(teamReadScope.isDone()).toBe(true);

                  done();
                });
            });

            it('is called to update team leader', done => {
              authenticatedSession
                .delete(`/organization/${organizationId}/team/${teamId}`)
                .set('Accept', 'application/json')
                .expect('Location', `/organization/${organizationId}`)
                .expect(302)
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
              .delete(`/organization/no-such-organization-uuid-v4/team/${teamId}`)
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
              .delete(`/organization/${organizationId}/team/no-such-team-uuid-v4`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(404)
              .end(function(err, res) {
                if (err) return done.fail(err);
                expect(res.body.message).toEqual('No such team');

                done();
              });
          });

          it('returns a friendly message if team is not a member of any organization', done => {
            authenticatedSession
              .delete(`/organization/${organizationId}/team/${noOrgTeamId}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(400)
              .end(function(err, res) {
                if (err) return done.fail(err);
                expect(res.body.message).toEqual('That team is not a member of any organization');

                done();
              });
          });

          it('returns a friendly message if team is not a member of the organization provided', done => {
            authenticatedSession
              .delete(`/organization/${anotherOrgId}/team/${teamId}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(400)
              .end(function(err, res) {
                if (err) return done.fail(err);
                expect(res.body.message).toEqual('That team is not a member of that organization');

                done();
              });
          });
        });
      });
    });

    describe('forbidden', () => {
      let originalProfile;

      let forbiddenSession, suspiciousAgent;
      beforeEach(done => {

        originalProfile = {..._profile};
        _profile.email = 'suspiciousagent@example.com';
        _profile.name = 'Suspicious Guy';

        models.Agent.create({ email: 'suspiciousagent@example.com' }).then(a => {
          suspiciousAgent = a;
          stubAuth0ManagementApi((err, apiScopes) => {
            if (err) return done.fail();

            login({ ..._identity, email: suspiciousAgent.email }, [scope.add.organizationMembers, scope.delete.organizationMembers], (err, session) => {
              if (err) return done.fail(err);
              forbiddenSession = session;

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

      afterEach(() => {
        // Through the magic of node I am able to adjust the profile data returned.
        // This resets the default values
        _profile.email = originalProfile.email;
        _profile.name = originalProfile.name;
      });

      describe('create', () => {
        it('doesn\'t allow a non-organizer to add a member team', done => {
          forbiddenSession
            .put('/organization/some-organization-uuid-v4/team')
            .send({
              teamId: 'some-team-uuid-v4'
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
      });

      describe('delete', () => {

        it('returns 404', done => {
          forbiddenSession
            .delete('/organization/some-organization-uuid-v4/team/some-team-uuid-v4')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(404)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.message).toEqual('No such organization');
              done();
            });
        });
      });
    });
  });
});
