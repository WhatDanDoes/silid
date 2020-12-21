const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001;
const app = require('../../../app');
const models = require('../../../models');
const request = require('supertest');
const stubAuth0Sessions = require('../../support/stubAuth0Sessions');
const stubAuth0ManagementApi = require('../../support/stubAuth0ManagementApi');
const stubUserAppMetadataUpdate = require('../../support/auth0Endpoints/stubUserAppMetadataUpdate');
const stubUserRead = require('../../support/auth0Endpoints/stubUserRead');
const stubOrganizationRead = require('../../support/auth0Endpoints/stubOrganizationRead');
const stubUserRolesRead = require('../../support/auth0Endpoints/stubUserRolesRead');
const stubTeamRead = require('../../support/auth0Endpoints/stubTeamRead');
const uuid = require('uuid');

/**
 * 2019-11-13
 * Sample tokens taken from:
 *
 * https://auth0.com/docs/api-auth/tutorials/adoption/api-tokens
 */
const _identity = { ...require('../../fixtures/sample-auth0-identity-token'), iss: `https://${process.env.AUTH0_DOMAIN}/`};
const _profile = require('../../fixtures/sample-auth0-profile-response');

describe('root/organizationMembershipSpec', () => {

  let login, pub, prv, keystore;
  beforeEach(done => {
    stubAuth0Sessions((err, sessionStuff) => {
      if (err) return done.fail(err);
      ({ login, pub, prv, keystore } = sessionStuff);
      done();
    });
  });

  let originalProfile;
  afterEach(() => {
    // Through the magic of node I am able to adjust the profile data returned.
    // This resets the default values
    _profile.email = originalProfile.email;
  });

  let root;
  beforeEach(done => {
    originalProfile = {..._profile};
    _profile.email = process.env.ROOT_AGENT;

    models.sequelize.sync({force: true}).then(() => {
      models.Agent.create({ email: process.env.ROOT_AGENT, name: 'Professor Fresh' }).then(results => {
        root = results;
        expect(root.isSuper).toBe(true);
        done();
      }).catch(err => {
        done.fail(err);
      });
    }).catch(err => {
      done.fail(err);
    });
  });

  describe('authorized', () => {

    describe('create', () => {

      describe('for root\'s own team', () => {

        let rootSession, organizationId, teamId,
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

            login({..._identity, email: process.env.ROOT_AGENT, name: 'Professor Fresh'}, (err, session) => {
              if (err) return done.fail(err);
              rootSession = session;

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
          it('redirects to /team/:id', done => {
            rootSession
              .put(`/organization/${organizationId}/team`)
              .send({
                teamId: teamId
              })
              .set('Accept', 'application/json')
              .expect('Location', `/team/${teamId}`)
              .expect(303)
              .end(function(err, res) {
                if (err) return done.fail(err);

                done();
              });
          });

          it('adds organizationId to the team leader\'s team record', done => {
            expect(coach.user_metadata.teams.length).toEqual(1);
            expect(coach.user_metadata.teams[0].organizationId).toBeUndefined();
            rootSession
              .put(`/organization/${organizationId}/team`)
              .send({
                teamId: teamId
              })
              .set('Accept', 'application/json')
              .expect('Location', `/team/${teamId}`)
              .expect(303)
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

              rootSession
                .put(`/organization/${organizationId}/team`)
                .send({
                  teamId: teamId
                })
                .set('Accept', 'application/json')
                .expect('Location', `/team/${teamId}`)
                .expect(303)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  models.Update.findAll().then(results => {
                    expect(results.length).toEqual(1);
                    expect(results[0].recipient).toEqual('player@example.com');
                    expect(results[0].type).toEqual('team');
                    expect(results[0].uuid).toEqual(teamId);
                    
                    expect(results[0].data).toBeDefined();
                    expect(results[0].data.name).toEqual('The Calgary Roughnecks');
                    expect(results[0].data.leader).toEqual('coach@example.com');
                    expect(results[0].data.id).toEqual(teamId);
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
              rootSession
                .put(`/organization/${organizationId}/team`)
                .send({
                  teamId: teamId
                })
                .set('Accept', 'application/json')
                .expect('Location', `/team/${teamId}`)
                .expect(303)
                .end(function(err, res) {
                  if (err) return done.fail(err);
                  expect(teamReadOauthTokenScope.isDone()).toBe(true);
                  expect(teamReadScope.isDone()).toBe(true);

                  done();
                });
            });

            it('is called to update team leader', done => {
              rootSession
                .put(`/organization/${organizationId}/team`)
                .send({
                  teamId: teamId
                })
                .set('Accept', 'application/json')
                .expect('Location', `/team/${teamId}`)
                .expect(303)
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
            rootSession
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
            rootSession
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
            rootSession
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
              rootSession
                .put(`/organization/${organizationId}/team`)
                .send({
                  teamId: teamId
                })
                .set('Accept', 'application/json')
                .expect('Location', `/team/${teamId}`)
                .expect(303)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  anotherOrgId = uuid.v4();
                  _profile.user_metadata = { organizations: [ {name: 'The Western Lacrosse Association', organizer: _profile.email, id: anotherOrgId } ] };

                  stubAuth0ManagementApi((err, apiScopes) => {
                    if (err) return done.fail(err);

                    login({..._identity, email: process.env.ROOT_AGENT, name: 'Professor Fresh'}, (err, session) => {
                      if (err) return done.fail(err);
                      rootSession = session;

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
              rootSession
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
                rootSession
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
                rootSession
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
              rootSession
                .put(`/organization/${organizationId}/team`)
                .send({
                  teamId: teamId
                })
                .set('Accept', 'application/json')
                .expect('Location', `/team/${teamId}`)
                .expect(303)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  stubAuth0ManagementApi((err, apiScopes) => {
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

            it('returns a friendly message', done => {
              rootSession
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
                rootSession
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
                rootSession
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
    });

    describe('delete', () => {
      describe('from root\'s own organization', () => {
        let rootSession, organizationId, teamId, noOrgTeamId, anotherOrgId,
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

            login({..._identity, email: process.env.ROOT_AGENT, name: 'Professor Fresh'}, (err, session) => {
              if (err) return done.fail(err);
              rootSession = session;

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
          it('redirects to /team/:id', done => {
            rootSession
              .delete(`/organization/${organizationId}/team/${teamId}`)
              .set('Accept', 'application/json')
              .expect(303)
              .expect('Location', `/team/${teamId}`)
              .end(function(err, res) {
                if (err) return done.fail(err);

                done();
              });
          });

          it('removes organizationId from the team leader\'s team record', done => {
            expect(coach.user_metadata.teams.length).toEqual(1);
            expect(coach.user_metadata.teams[0].organizationId).toEqual(organizationId);
            rootSession
              .delete(`/organization/${organizationId}/team/${teamId}`)
              .set('Accept', 'application/json')
              .expect(303)
              .expect('Location', `/team/${teamId}`)
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

              rootSession
                .delete(`/organization/${organizationId}/team/${teamId}`)
                .set('Accept', 'application/json')
                .expect('Location', `/team/${teamId}`)
                .expect(303)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  models.Update.findAll().then(results => {
                    expect(results.length).toEqual(1);
                    expect(results[0].recipient).toEqual('player@example.com');
                    expect(results[0].uuid).toEqual(teamId);
                    expect(results[0].type).toEqual('team');

                    expect(results[0].data).toBeDefined();
                    expect(results[0].data.name).toEqual('The Calgary Roughnecks');
                    expect(results[0].data.leader).toEqual('coach@example.com');
                    expect(results[0].data.id).toEqual(teamId);
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
              rootSession
                .delete(`/organization/${organizationId}/team/${teamId}`)
                .set('Accept', 'application/json')
                .expect('Location', `/team/${teamId}`)
                .expect(303)
                .end(function(err, res) {
                  if (err) return done.fail(err);
                  expect(teamReadOauthTokenScope.isDone()).toBe(true);
                  expect(teamReadScope.isDone()).toBe(true);

                  done();
                });
            });

            it('is called to update team leader', done => {
              rootSession
                .delete(`/organization/${organizationId}/team/${teamId}`)
                .set('Accept', 'application/json')
                .expect('Location', `/team/${teamId}`)
                .expect(303)
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
            rootSession
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
            rootSession
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
            rootSession
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
            rootSession
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

      describe('from organization with no root affiliation', () => {
        let rootSession, organizationId, teamId, noOrgTeamId, anotherOrgId,
            teamReadScope, teamReadOauthTokenScope,
            userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope,
            organizationReadScope, organizationReadOauthTokenScope;

        const coach = { ..._profile, name: 'Curt Malawsky', email: 'coach@example.com'};
        const commissioner = { ..._profile, name: 'Nick Sakiewicz', email: 'commissioner@example.com'};

        beforeEach(done => {
          organizationId = uuid.v4();
          anotherOrgId = uuid.v4();
          teamId = uuid.v4();
          noOrgTeamId = uuid.v4();

          commissioner.user_metadata = { organizations: [
            {name: 'The National Lacrosse League', organizer: commissioner.email, id: organizationId },
            {name: 'The Canadian Lacrosse Association', organizer: commissioner.email, id: anotherOrgId },
          ] };

          coach.user_metadata = { teams: [ {name: 'The Calgary Roughnecks', leader: 'coach@example.com', id: teamId, organizationId: organizationId } ] };

          stubAuth0ManagementApi((err, apiScopes) => {
            if (err) return done.fail(err);

            login({..._identity, email: process.env.ROOT_AGENT, name: 'Professor Fresh'}, (err, session) => {
              if (err) return done.fail(err);
              rootSession = session;

              // Cached profile doesn't match "live" data, so agent needs to be updated
              // with a call to Auth0
              stubUserRead((err, apiScopes) => {
                if (err) return done.fail(err);

                stubOrganizationRead([commissioner], (err, apiScopes) => {
                  if (err) return done.fail(err);
                  ({organizationReadScope, organizationReadOauthTokenScope} = apiScopes);

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
        });

        describe('successfully', () => {
          it('redirects to /team/:id', done => {
            rootSession
              .delete(`/organization/${organizationId}/team/${teamId}`)
              .set('Accept', 'application/json')
              .expect(303)
              .expect('Location', `/team/${teamId}`)
              .end(function(err, res) {
                if (err) return done.fail(err);

                done();
              });
          });

          it('removes organizationId from the team leader\'s team record', done => {
            expect(coach.user_metadata.teams.length).toEqual(1);
            expect(coach.user_metadata.teams[0].organizationId).toEqual(organizationId);
            rootSession
              .delete(`/organization/${organizationId}/team/${teamId}`)
              .set('Accept', 'application/json')
              .expect(303)
              .expect('Location', `/team/${teamId}`)
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

              rootSession
                .delete(`/organization/${organizationId}/team/${teamId}`)
                .set('Accept', 'application/json')
                .expect('Location', `/team/${teamId}`)
                .expect(303)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  models.Update.findAll().then(results => {
                    expect(results.length).toEqual(1);
                    expect(results[0].recipient).toEqual('player@example.com');
                    expect(results[0].uuid).toEqual(teamId);
                    expect(results[0].type).toEqual('team');

                    expect(results[0].data).toBeDefined();
                    expect(results[0].data.name).toEqual('The Calgary Roughnecks');
                    expect(results[0].data.leader).toEqual('coach@example.com');
                    expect(results[0].data.id).toEqual(teamId);
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
              rootSession
                .delete(`/organization/${organizationId}/team/${teamId}`)
                .set('Accept', 'application/json')
                .expect('Location', `/team/${teamId}`)
                .expect(303)
                .end(function(err, res) {
                  if (err) return done.fail(err);
                  expect(teamReadOauthTokenScope.isDone()).toBe(true);
                  expect(teamReadScope.isDone()).toBe(true);

                  done();
                });
            });

            it('is called to update team leader', done => {
              rootSession
                .delete(`/organization/${organizationId}/team/${teamId}`)
                .set('Accept', 'application/json')
                .expect('Location', `/team/${teamId}`)
                .expect(303)
                .end(function(err, res) {
                  if (err) return done.fail(err);
                  expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
                  expect(userAppMetadataUpdateScope.isDone()).toBe(true);

                  done();
                });
            });

            it('is called to retrieve organization agent', done => {
              rootSession
                .delete(`/organization/${organizationId}/team/${teamId}`)
                .set('Accept', 'application/json')
                .expect('Location', `/team/${teamId}`)
                .expect(303)
                .end(function(err, res) {
                  if (err) return done.fail(err);
                  expect(organizationReadOauthTokenScope.isDone()).toBe(true);
                  expect(organizationReadScope.isDone()).toBe(true);

                  done();
                });
            });
          });
        });

        describe('unsuccessfully', () => {
          it('doesn\'t barf if organization doesn\'t exist', done => {
            rootSession
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
            rootSession
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
            rootSession
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
            rootSession
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
  });
});
