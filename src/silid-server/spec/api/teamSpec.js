const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001;
const app = require('../../app');
const fixtures = require('sequelize-fixtures');
const models = require('../../models');
const request = require('supertest');
const uuid = require('uuid');
const stubAuth0Sessions = require('../support/stubAuth0Sessions');
const stubAuth0ManagementApi = require('../support/stubAuth0ManagementApi');
const stubUserRead = require('../support/auth0Endpoints/stubUserRead');
const stubUserRolesRead = require('../support/auth0Endpoints/stubUserRolesRead');
const stubUserAppMetadataRead = require('../support/auth0Endpoints/stubUserAppMetadataRead');
const stubUserAppMetadataUpdate = require('../support/auth0Endpoints/stubUserAppMetadataUpdate');
const stubTeamRead = require('../support/auth0Endpoints/stubTeamRead');
const stubOrganizationRead = require('../support/auth0Endpoints/stubOrganizationRead');
const mailer = require('../../mailer');
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

describe('teamSpec', () => {
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

  let userReadScope, updateTeamScope, oauthTokenScope, authenticatedSession;
  describe('authenticated', () => {

    describe('authorized', () => {

      describe('create', () => {

        describe('successfully', () =>{
          beforeEach(done => {
            stubAuth0ManagementApi((err, apiScopes) => {
              if (err) return done.fail();

              login(_identity, [scope.create.teams], (err, session) => {
                if (err) return done.fail(err);
                authenticatedSession = session;

                // This stubs user reads subsequent to the original login
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

          it('returns the agent profile', done => {
            authenticatedSession
              .post('/team')
              .send({
                name: 'The Mike Tyson Mystery Team'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end((err, res) => {
                if (err) return done.fail(err);
                expect(res.body.email).toEqual(_profile.email);
                expect(res.body.user_metadata.teams.length).toEqual(1);
                done();
              });
          });

          describe('Auth0', () => {
            it('calls Auth0 to retrieve the agent user_metadata', done => {
              authenticatedSession
                .post('/team')
                .send({
                  name: 'The Mike Tyson Mystery Team'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  expect(userAppMetadataReadOauthTokenScope.isDone()).toBe(true);
                  expect(userAppMetadataReadScope.isDone()).toBe(true);
                  done();
                });
            });

            it('calls Auth0 to update the agent', done => {
              authenticatedSession
                .post('/team')
                .send({
                  name: 'The Mike Tyson Mystery Team'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
                  expect(userAppMetadataUpdateScope.isDone()).toBe(true);
                  done();
                });
            });
          });
        });

        describe('unsuccessfully', () =>{
          beforeEach(done => {
            // Witness node module caching magic
            _profile.user_metadata = { teams: [ {name: 'The Calgary Roughnecks', leader: _profile.email } ] };
            stubAuth0ManagementApi((err, apiScopes) => {
              if (err) return done.fail();

              login(_identity, [scope.create.teams], (err, session) => {

                if (err) return done.fail(err);
                authenticatedSession = session;

                // This stubs calls subsequent to the inital login/permission checking step
                stubUserAppMetadataRead((err, apiScopes) => {
                  if (err) return done.fail();
                  ({userAppMetadataReadScope, userAppMetadataReadOauthTokenScope} = apiScopes);

                  stubTeamRead((err, apiScopes) => {
                    if (err) return done.fail();
                    ({teamReadScope, teamReadOauthTokenScope} = apiScopes);

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

          describe('add a duplicate team name', () => {
            it('returns an error if record already exists', done => {
              authenticatedSession
                .post('/team')
                .send({
                  name: 'The Calgary Roughnecks'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(400)
                .end((err, res) => {
                  if (err) return done.fail(err);
                  expect(res.body.errors.length).toEqual(1);
                  expect(res.body.errors[0].message).toEqual('That team is already registered');
                  done();
                });
            });

            describe('Auth0', () => {
              it('calls Auth0 to retrieve the agent user_metadata', done => {
                authenticatedSession
                  .post('/team')
                  .send({
                    name: 'The Calgary Roughnecks'
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(400)
                  .end((err, res) => {
                    if (err) return done.fail(err);

                    expect(userAppMetadataReadOauthTokenScope.isDone()).toBe(true);
                    expect(userAppMetadataReadScope.isDone()).toBe(true);
                    done();
                  });
              });

              it('does not call Auth0 to update the agent user_metadata', done => {
                authenticatedSession
                  .post('/team')
                  .send({
                    name: 'The Calgary Roughnecks'
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

          it('returns an error if empty team name provided', done => {
            authenticatedSession
              .post('/team')
              .send({
                name: '   '
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(400)
              .end((err, res) => {
                if (err) return done.fail(err);
                expect(res.body.errors.length).toEqual(1);
                expect(res.body.errors[0].message).toEqual('Team requires a name');
                done();
              });
          });

          it('returns an error if no team name provided', done => {
            authenticatedSession
              .post('/team')
              .send({})
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(400)
              .end((err, res) => {
                if (err) return done.fail(err);
                expect(res.body.errors.length).toEqual(1);
                expect(res.body.errors[0].message).toEqual('Team requires a name');
                done();
              });
          });

          it('returns an error if team name is over 128 characters long', done => {
            authenticatedSession
              .post('/team')
              .send({
                name: '!'.repeat(129)
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(400)
              .end((err, res) => {
                if (err) return done.fail(err);
                expect(res.body.errors.length).toEqual(1);
                expect(res.body.errors[0].message).toEqual('Team name is too long');
                done();
              });
          });
        });
      });

      describe('read', () => {

        describe('GET /team/:id', () => {

          let teamId, userReadScope, organizationReadScope, organizationReadOauthTokenScope, teamReadScope, teamReadOauthTokenScope;

          describe('with no organizational affiliation', () => {
            let teamId;
            beforeEach(done => {
              teamId = uuid.v4();

              _profile.user_metadata = { teams: [{ name: 'The Calgary Roughnecks', leader: _profile.email, id: teamId }] };
              stubAuth0ManagementApi((err, apiScopes) => {
                if (err) return done.fail();

                login(_identity, [scope.create.teams], (err, session) => {

                  if (err) return done.fail(err);
                  authenticatedSession = session;

                  // Cached profile doesn't match "live" data, so agent needs to be updated
                  // with a call to Auth0
                  stubUserRead((err, apiScopes) => {
                    if (err) return done.fail();

                    stubTeamRead([_profile,
                                  {..._profile,
                                    name: 'A Aaronson',
                                    email: 'aaaronson@example.com',
                                    user_id: _profile.user_id + 1,
                                    user_metadata: {
                                      teams: [{ name: 'The Calgary Roughnecks', leader: _profile.email, id: teamId }]
                                    }
                                  }], (err, apiScopes) => {
                      if (err) return done.fail();
                      ({teamReadScope, teamReadOauthTokenScope} = apiScopes);

                      stubOrganizationRead((err, apiScopes) => {
                        if (err) return done.fail();
                        ({organizationReadScope, organizationReadOauthTokenScope} = apiScopes);

                        done();
                      });
                    });
                  });
                });
              });
            });

            it('collates agent data into team data', done => {
              authenticatedSession
                .get(`/team/${teamId}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200)
                .end((err, res) => {
                  if (err) return done.fail(err);
                  expect(res.body.name).toEqual('The Calgary Roughnecks');
                  expect(res.body.leader).toEqual(_profile.email);
                  expect(res.body.id).toEqual(teamId);
                  // Alphabetical according to name
                  expect(res.body.members.length).toEqual(2);
                  expect(res.body.members[0]).toEqual({ name: 'A Aaronson', email: 'aaaronson@example.com', user_id: _profile.user_id + 1 });
                  expect(res.body.members[1]).toEqual({ name: _profile.name, email: _profile.email, user_id: _profile.user_id });

                  done();
                });
            });

            it('doesn\'t barf if record doesn\'t exist', done => {
              authenticatedSession
                .get('/team/33')
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(404)
                .end((err, res) => {
                  if (err) return done.fail(err);
                  expect(res.body.message).toEqual('No such team');
                  done();
                });
            });

            describe('Auth0', () => {
              it('is called to retrieve the team data', done => {
                authenticatedSession
                  .get(`/team/${teamId}`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(200)
                  .end((err, res) => {
                    if (err) return done.fail(err);
                    expect(teamReadOauthTokenScope.isDone()).toBe(true);
                    expect(teamReadScope.isDone()).toBe(true);
                    done();
                  });
              });

              it('is not called to retrieve parent organization data (because it doesn\'t exist)', done => {
                authenticatedSession
                  .get(`/team/${teamId}`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(200)
                  .end((err, res) => {
                    if (err) return done.fail(err);

                    expect(organizationReadOauthTokenScope.isDone()).toBe(false);
                    expect(organizationReadScope.isDone()).toBe(false);
                    done();
                  });
              });
            });
          });

          describe('with parent organization', () => {
            let organizationId;
            beforeEach(done => {
              teamId = uuid.v4();
              organizationId = uuid.v4();

              _profile.user_metadata = {
                teams: [{ name: 'The Calgary Roughnecks', leader: _profile.email, id: teamId, organizationId: organizationId }]
              };

              stubAuth0ManagementApi((err, apiScopes) => {
                if (err) return done.fail();

                login(_identity, [scope.create.teams], (err, session) => {

                  if (err) return done.fail(err);
                  authenticatedSession = session;

                  // Cached profile doesn't match "live" data, so agent needs to be updated
                  // with a call to Auth0
                  stubUserRead((err, apiScopes) => {
                    if (err) return done.fail();

                    stubTeamRead([_profile,
                                  {..._profile,
                                    name: 'A Aaronson',
                                    email: 'aaaronson@example.com',
                                    user_id: _profile.user_id + 1,
                                    user_metadata: {
                                      teams: [{ name: 'The Calgary Roughnecks', leader: _profile.email, id: teamId, organizationId: organizationId }]
                                    }
                                  }], (err, apiScopes) => {
                      if (err) return done.fail();
                      ({teamReadScope, teamReadOauthTokenScope} = apiScopes);

                      stubOrganizationRead([
                                            {..._profile,
                                              name: 'Zelda Zerk',
                                              email: 'zzerk@example.com',
                                              user_id: _profile.user_id + 2,
                                              user_metadata: {
                                                organizations: [{ name: 'The National Lacrosse League', organizer: 'zzerk@example.com', id: organizationId }],
                                              }
                                            }], (err, apiScopes) => {
                        if (err) return done.fail();
                        ({organizationReadScope, organizationReadOauthTokenScope} = apiScopes);

                        done();
                      });
                    });
                  });
                });
              });
            });

            it('attaches organization to collated team data', done => {
              authenticatedSession
                .get(`/team/${teamId}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200)
                .end((err, res) => {
                  if (err) return done.fail(err);
                  expect(res.body.name).toEqual('The Calgary Roughnecks');
                  expect(res.body.leader).toEqual(_profile.email);
                  expect(res.body.id).toEqual(teamId);
                  expect(res.body.organization).toBeDefined();
                  expect(res.body.organization.name).toEqual('The National Lacrosse League');
                  expect(res.body.organization.organizer).toEqual('zzerk@example.com');
                  expect(res.body.organization.id).toEqual(organizationId);

                  done();
                });
            });

            describe('Auth0', () => {
              it('is called to retrieve the team data', done => {
                authenticatedSession
                  .get(`/team/${teamId}`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(200)
                  .end((err, res) => {
                    if (err) return done.fail(err);

                    expect(teamReadOauthTokenScope.isDone()).toBe(true);
                    expect(teamReadScope.isDone()).toBe(true);
                    done();
                  });
              });

              it('is called to retrieve parent organization data', done => {
                authenticatedSession
                  .get(`/team/${teamId}`)
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(200)
                  .end((err, res) => {
                    if (err) return done.fail(err);

                    expect(organizationReadOauthTokenScope.isDone()).toBe(false);
                    expect(organizationReadScope.isDone()).toBe(true);
                    done();
                  });
              });
            });
          });
        });

        describe('GET /team', () => {
          let teamId;
          beforeEach(done => {
            teamId = uuid.v4();

            _profile.user_metadata = { teams: [{ name: 'The Halifax Thunderbirds', leader: _profile.email, id: teamId }] };
            // Add another team just for fun
            _profile.user_metadata.teams.push({ name: 'The Rochester Knighthawks', leader: 'someotherguy@example.com', id: uuid.v4() });

            stubAuth0ManagementApi((err, apiScopes) => {
              if (err) return done.fail();

              login(_identity, [scope.create.teams], (err, session) => {

                if (err) return done.fail(err);
                authenticatedSession = session;

                stubUserAppMetadataRead((err, apiScopes) => {
                  if (err) return done.fail();
                  ({userAppMetadataReadScope, userAppMetadataReadOauthTokenScope} = apiScopes);

                  done();
                });
              });
            });
          });

          it('retrieves all team memberships for the agent', done => {
            expect(_profile.user_metadata.teams.length).toEqual(2);
            authenticatedSession
              .get(`/team`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200)
              .end((err, res) => {
                if (err) return done.fail(err);
                expect(res.body.length).toEqual(2);
                done();
              });
          });

          describe('Auth0', () => {
            it('calls /oauth/token endpoint to retrieve a machine-to-machine access token', done => {
              authenticatedSession
                .get('/team')
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200)
                .end((err, res) => {
                  if (err) return done.fail(err);
                  expect(userAppMetadataReadOauthTokenScope.isDone()).toBe(true);
                  done();
                });
            });

            it('calls Auth0 to retrieve the team data (from the agent\'s metadata)', done => {
              authenticatedSession
                .get('/team')
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  expect(userAppMetadataReadScope.isDone()).toBe(true);
                  done();
                });
            });
          });
        });
      });

      describe('update', () => {
        describe('with no parent organization', () => {

          let teamId, teamReadScope, teamReadOauthTokenScope, teamMembershipReadScope, teamMembershipReadOauthTokenScope;
          beforeEach(done => {
            teamId = uuid.v4();
            _profile.user_metadata = { teams: [{ name: 'Vancouver Warriors', leader: _profile.email, id: teamId }] };
            _profile.user_metadata.teams.push({ name: 'Georgia Swarm', leader: _profile.email, id: uuid.v4() });

            _profile.user_metadata.pendingInvitations = [];
            _profile.user_metadata.pendingInvitations.push({ name: 'Vancouver Warriors', recipient: 'someotherguy@example.com', uuid: teamId, type: 'team' });
            _profile.user_metadata.pendingInvitations.push({ name: 'Vancouver Warriors', recipient: 'anotherteamplayer@example.com', uuid: teamId, type: 'team' });


            stubAuth0ManagementApi((err, apiScopes) => {
              if (err) return done.fail();

              login(_identity, [scope.update.teams], (err, session) => {

                if (err) return done.fail(err);
                authenticatedSession = session;

                // Cached profile doesn't match "live" data, so agent needs to be updated
                // with a call to Auth0
                stubUserRead((err, apiScopes) => {
                  if (err) return done.fail();

                  // Get team members
                  stubTeamRead((err, apiScopes) => {
                    if (err) return done.fail();
                    ({teamReadScope, teamReadOauthTokenScope} = apiScopes);
                    teamMembershipReadScope = teamReadScope;
                    teamMembershipReadOauthTokenScope = teamReadOauthTokenScope;

                    // Get RSVPs
                    stubTeamRead((err, apiScopes) => {
                      if (err) return done.fail();
                      ({teamReadScope, teamReadOauthTokenScope} = apiScopes);

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

          it('allows a team creator to update an existing record', done => {
            authenticatedSession
              .put(`/team/${teamId}`)
              .send({
                name: 'Vancouver Riot'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end((err, res) => {
                if (err) return done.fail(err);

                expect(res.body.name).toEqual('Vancouver Riot');
                expect(res.body.leader).toEqual(_profile.email);
                expect(res.body.id).toEqual(teamId);
                expect(res.body.members).toEqual([{ name: _profile.name, email: _profile.email, user_id: _profile.user_id }]);
                done();
              });
          });

          it('updates any pending invitations', done => {
            authenticatedSession
              .put(`/team/${teamId}`)
              .send({
                name: 'Vancouver Riot'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end((err, res) => {
                if (err) return done.fail(err);

                expect(_profile.user_metadata.pendingInvitations.length).toEqual(2);
                expect(_profile.user_metadata.pendingInvitations[0].name).toEqual('Vancouver Riot');
                expect(_profile.user_metadata.pendingInvitations[1].name).toEqual('Vancouver Riot');
                done();
              });
          });

          it('updates any database updates', done => {
            models.Update.create({ recipient: 'onecooldude@example.com', uuid: teamId, type: 'team',
                                   data: {name: 'Vancouver Warriors', leader: 'someguy@example.com', id: teamId} }).then(results => {

              authenticatedSession
                .put(`/team/${teamId}`)
                .send({
                  name: 'Vancouver Riot'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  models.Update.findAll().then(updates => {
                    expect(updates.length).toEqual(1);
                    expect(updates[0].recipient).toEqual('onecooldude@example.com');
                    expect(updates[0].uuid).toEqual(teamId);
                    expect(updates[0].type).toEqual('team');

                    expect(updates[0].data).toBeDefined();
                    expect(updates[0].data.name).toEqual('Vancouver Riot');
                    expect(updates[0].data.leader).toEqual('someguy@example.com');
                    expect(updates[0].data.id).toEqual(teamId);
                    expect(updates[0].data.organizationId).toBeUndefined();

                    done();
                  }).catch(err => {
                    done.fail(err);
                  });
                });
            }).catch(err => {
              done.fail(err);
            });
          });

          it('returns an error if empty team name provided', done => {
            authenticatedSession
              .put(`/team/${teamId}`)
              .send({
                name: '   '
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(400)
              .end((err, res) => {
                if (err) return done.fail(err);
                expect(res.body.errors.length).toEqual(1);
                expect(res.body.errors[0].message).toEqual('Team requires a name');
                done();
              });
          });

          it('returns an error if record already exists', done => {
            authenticatedSession
              .put(`/team/${_profile.user_metadata.teams[1].id}`)
              .send({
                name: 'Vancouver Warriors'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(400)
              .end((err, res) => {
                if (err) return done.fail(err);
                expect(res.body.errors.length).toEqual(1);
                expect(res.body.errors[0].message).toEqual('That team is already registered');
                done();
              });
          });

          it('doesn\'t barf if team doesn\'t exist', done => {
            authenticatedSession
              .put('/team/333')
              .send({
                name: 'Vancouver Riot'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(404)
              .end((err, res) => {
                if (err) return done.fail(err);
                expect(res.body.message).toEqual('No such team');
                done();
              });
          });

          describe('Auth0', () => {
            it('is called to retrieve team membership', done => {
              authenticatedSession
                .put(`/team/${teamId}`)
                .send({
                  name: 'Vancouver Riot'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  expect(teamMembershipReadOauthTokenScope.isDone()).toBe(true);
                  expect(teamMembershipReadScope.isDone()).toBe(true);
                  done();
                });
            });

            it('is called to retrieve outstanding RSVPs', done => {
              authenticatedSession
                .put(`/team/${teamId}`)
                .send({
                  name: 'Vancouver Riot'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  // Doesn't get called because route is re-using token
                  expect(teamReadOauthTokenScope.isDone()).toBe(false);
                  expect(teamReadScope.isDone()).toBe(true);
                  done();
                });
            });


            it('is called to update the agent user_metadata', done => {
              authenticatedSession
                .put(`/team/${teamId}`)
                .send({
                  name: 'Vancouver Riot'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
                  expect(userAppMetadataUpdateScope.isDone()).toBe(true);
                  done();
                });
            });
          });

          describe('membership update', () => {
            beforeEach(done => {
              // This mainly serves to wipe out the mocks
              authenticatedSession
                .put(`/team/${teamId}`)
                .send({
                  name: 'Vancouver Riot'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  // Cached profile doesn't match "live" data, so agent needs to be updated
                  // with a call to Auth0
                  stubUserRead((err, apiScopes) => {
                    if (err) return done.fail();

                    stubUserRolesRead((err, apiScopes) => {
                      if (err) return done(err);

                      // Read team membership
                      stubTeamRead([{..._profile},
                                    {..._profile, email: 'someotherguy@example.com', name: 'Some Other Guy',
                                       user_metadata: { teams: [{ name: 'Vancouver Riot', leader: _profile.email, id: teamId }] }
                                    },
                                    {..._profile, email: 'yetanotherteamplayer@example.com', name: 'Team Player',
                                       user_metadata: { teams: [{ name: 'Vancouver Riot', leader: _profile.email, id: teamId }] }
                                    }], (err, apiScopes) => {
                        if (err) return done.fail();
                        ({teamReadScope, teamReadOauthTokenScope} = apiScopes);

                        // Get RSVPs
                        stubTeamRead([], (err, apiScopes) => {
                          if (err) return done.fail();
                          ({teamReadScope, teamReadOauthTokenScope} = apiScopes);

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

            it('creates an update record to update team info on next login', done => {
              models.Update.findAll().then(updates => {
                expect(updates.length).toEqual(0);

                authenticatedSession
                  .put(`/team/${teamId}`)
                  .send({
                    name: 'Vancouver Warriors'
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end((err, res) => {
                    if (err) return done.fail(err);
                    models.Update.findAll().then(updates => {

                      expect(updates.length).toEqual(2);

                      expect(updates[0].type).toEqual('team');
                      expect(updates[0].uuid).toEqual(teamId);
                      expect(updates[0].recipient).toEqual('someotherguy@example.com');
                      expect(updates[0].data).toBeDefined();
                      expect(updates[0].data.name).toEqual('Vancouver Warriors');
                      expect(updates[0].data.leader).toEqual('someguy@example.com');
                      expect(updates[0].data.id).toEqual(teamId);
                      expect(updates[0].data.organizationId).toBeUndefined();

                      expect(updates[1].type).toEqual('team');
                      expect(updates[1].uuid).toEqual(teamId);
                      expect(updates[1].recipient).toEqual('yetanotherteamplayer@example.com');
                      expect(updates[1].data).toBeDefined();
                      expect(updates[1].data.name).toEqual('Vancouver Warriors');
                      expect(updates[1].data.leader).toEqual('someguy@example.com');
                      expect(updates[1].data.id).toEqual(teamId);
                      expect(updates[1].data.organizationId).toBeUndefined();

                      done();
                    }).catch(err => {
                      done.fail(err);
                    });
                  });
                }).catch(err => {
                  done.fail(err);
                });
            });


            it('overwrites existing update records to update team info on next login', done => {
              models.Update.findAll().then(updates => {
                expect(updates.length).toEqual(0);

                // First update
                authenticatedSession
                  .put(`/team/${teamId}`)
                  .send({
                    name: 'Vancouver Warriors'
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end((err, res) => {
                    if (err) return done.fail(err);
                    models.Update.findAll().then(updates => {

                      expect(updates.length).toEqual(2);

                      expect(updates[0].type).toEqual('team');
                      expect(updates[0].uuid).toEqual(teamId);
                      expect(updates[0].recipient).toEqual('someotherguy@example.com');
                      expect(updates[0].data).toBeDefined();
                      expect(updates[0].data.name).toEqual('Vancouver Warriors');
                      expect(updates[0].data.leader).toEqual('someguy@example.com');
                      expect(updates[0].data.id).toEqual(teamId);
                      expect(updates[0].data.organizationId).toBeUndefined();

                      expect(updates[1].type).toEqual('team');
                      expect(updates[1].uuid).toEqual(teamId);
                      expect(updates[1].recipient).toEqual('yetanotherteamplayer@example.com');
                      expect(updates[1].data).toBeDefined();
                      expect(updates[1].data.name).toEqual('Vancouver Warriors');
                      expect(updates[1].data.leader).toEqual('someguy@example.com');
                      expect(updates[1].data.id).toEqual(teamId);
                      expect(updates[1].data.organizationId).toBeUndefined();

                      // Reset mocks

                      // Cached profile doesn't match "live" data, so agent needs to be updated
                      // with a call to Auth0
                      stubUserRead((err, apiScopes) => {
                        if (err) return done.fail();

                        stubUserRolesRead((err, apiScopes) => {
                          if (err) return done(err);

                          stubTeamRead([{..._profile},
                                        {..._profile, email: 'someotherguy@example.com', name: 'Some Other Guy',
                                           user_metadata: { teams: [{ name: 'Vancouver Warriors', leader: _profile.email, id: teamId }] }
                                        },
                                        {..._profile, email: 'yetanotherteamplayer@example.com', name: 'Team Player',
                                           user_metadata: { teams: [{ name: 'Vancouver Warriors', leader: _profile.email, id: teamId }] }
                                        }], (err, apiScopes) => {
                            if (err) return done.fail();

                            // Get RSVPs
                            stubTeamRead([], (err, apiScopes) => {
                              if (err) return done.fail();
                              ({teamReadScope, teamReadOauthTokenScope} = apiScopes);

                              stubUserRolesRead((err, apiScopes) => {
                                if (err) return done(err);

                                stubUserAppMetadataUpdate((err, apiScopes) => {
                                  if (err) return done.fail();

                                  authenticatedSession
                                    .put(`/team/${teamId}`)
                                    .send({
                                      name: 'Vancouver Riot'
                                    })
                                    .set('Accept', 'application/json')
                                    .expect('Content-Type', /json/)
                                    .expect(201)
                                    .end((err, res) => {
                                      if (err) return done.fail(err);
                                      models.Update.findAll().then(updates => {

                                        expect(updates.length).toEqual(2);

                                        expect(updates[0].type).toEqual('team');
                                        expect(updates[0].uuid).toEqual(teamId);
                                        expect(updates[0].recipient).toEqual('someotherguy@example.com');
                                        expect(updates[0].data).toBeDefined();
                                        expect(updates[0].data.name).toEqual('Vancouver Riot');
                                        expect(updates[0].data.leader).toEqual('someguy@example.com');
                                        expect(updates[0].data.id).toEqual(teamId);
                                        expect(updates[0].data.organizationId).toBeUndefined();

                                        expect(updates[1].type).toEqual('team');
                                        expect(updates[1].uuid).toEqual(teamId);
                                        expect(updates[1].recipient).toEqual('yetanotherteamplayer@example.com');
                                        expect(updates[1].data).toBeDefined();
                                        expect(updates[1].data.name).toEqual('Vancouver Riot');
                                        expect(updates[1].data.leader).toEqual('someguy@example.com');
                                        expect(updates[1].data.id).toEqual(teamId);
                                        expect(updates[1].data.organizationId).toBeUndefined();

                                        done();
                                      }).catch(err => {
                                        done.fail(err);
                                      });
                                    });
                                });
                              });
                            });
                          });
                        });
                      });
                    }).catch(err => {
                      done.fail(err);
                    });
                  });
                }).catch(err => {
                  done.fail(err);
                });
            });
          });
        });

        describe('with parent organization', () => {

          let teamId, organizationId, teamReadScope, teamReadOauthTokenScope, teamMembershipReadScope, teamMembershipReadOauthTokenScope;
          beforeEach(done => {
            teamId = uuid.v4();
            organizationId = uuid.v4();
            _profile.user_metadata = { teams: [{ name: 'Vancouver Warriors', leader: _profile.email, id: teamId, organizationId: organizationId }] };
            _profile.user_metadata.teams.push({ name: 'Georgia Swarm', leader: _profile.email, id: uuid.v4(), organizationId: organizationId });

            _profile.user_metadata.pendingInvitations = [];
            _profile.user_metadata.pendingInvitations.push(
              { name: 'Vancouver Warriors', recipient: 'someotherguy@example.com', uuid: teamId, type: 'team', organizationId: organizationId });
            _profile.user_metadata.pendingInvitations.push(
              { name: 'Vancouver Warriors', recipient: 'anotherteamplayer@example.com', uuid: teamId, type: 'team', organizationId: organizationId });

            stubAuth0ManagementApi((err, apiScopes) => {
              if (err) return done.fail();

              login(_identity, [scope.update.teams], (err, session) => {

                if (err) return done.fail(err);
                authenticatedSession = session;

                // Cached profile doesn't match "live" data, so agent needs to be updated
                // with a call to Auth0
                stubUserRead((err, apiScopes) => {
                  if (err) return done.fail();

                  // Get team members
                  stubTeamRead((err, apiScopes) => {
                    if (err) return done.fail();
                    ({teamReadScope, teamReadOauthTokenScope} = apiScopes);
                    teamMembershipReadScope = teamReadScope;
                    teamMembershipReadOauthTokenScope = teamReadOauthTokenScope;

                    // Get RSVPs
                    stubTeamRead((err, apiScopes) => {
                      if (err) return done.fail();
                      ({teamReadScope, teamReadOauthTokenScope} = apiScopes);

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

          it('allows a team creator to update an existing record', done => {
            authenticatedSession
              .put(`/team/${teamId}`)
              .send({
                name: 'Vancouver Riot'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end((err, res) => {
                if (err) return done.fail(err);

                expect(res.body.name).toEqual('Vancouver Riot');
                expect(res.body.leader).toEqual(_profile.email);
                expect(res.body.id).toEqual(teamId);
                expect(res.body.organizationId).toEqual(organizationId);
                expect(res.body.members).toEqual([{ name: _profile.name, email: _profile.email, user_id: _profile.user_id }]);
                done();
              });
          });

          it('updates any pending invitations', done => {
            authenticatedSession
              .put(`/team/${teamId}`)
              .send({
                name: 'Vancouver Riot'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end((err, res) => {
                if (err) return done.fail(err);

                expect(_profile.user_metadata.pendingInvitations.length).toEqual(2);
                expect(_profile.user_metadata.pendingInvitations[0].name).toEqual('Vancouver Riot');
                expect(_profile.user_metadata.pendingInvitations[0].organizationId).toEqual(organizationId);
                expect(_profile.user_metadata.pendingInvitations[1].name).toEqual('Vancouver Riot');
                expect(_profile.user_metadata.pendingInvitations[1].organizationId).toEqual(organizationId);
                done();
              });
          });

          it('updates any database updates', done => {
            models.Update.create({ recipient: 'onecooldude@example.com', uuid: teamId, type: 'team',
                                   data: {name: 'Vancouver Warriors', leader: 'someguy@example.com', id: teamId} }).then(results => {

              authenticatedSession
                .put(`/team/${teamId}`)
                .send({
                  name: 'Vancouver Riot'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  models.Update.findAll().then(updates => {
                    expect(updates.length).toEqual(1);
                    expect(updates[0].recipient).toEqual('onecooldude@example.com');
                    expect(updates[0].uuid).toEqual(teamId);
                    expect(updates[0].type).toEqual('team');

                    expect(updates[0].data).toBeDefined();
                    expect(updates[0].data.name).toEqual('Vancouver Riot');
                    expect(updates[0].data.leader).toEqual('someguy@example.com');
                    expect(updates[0].data.id).toEqual(teamId);
                    expect(updates[0].data.organizationId).toEqual(organizationId);

                    done();
                  }).catch(err => {
                    done.fail(err);
                  });
                });
            }).catch(err => {
              done.fail(err);
            });
          });

          it('returns an error if empty team name provided', done => {
            authenticatedSession
              .put(`/team/${teamId}`)
              .send({
                name: '   '
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(400)
              .end((err, res) => {
                if (err) return done.fail(err);
                expect(res.body.errors.length).toEqual(1);
                expect(res.body.errors[0].message).toEqual('Team requires a name');
                done();
              });
          });

          it('returns an error if record already exists', done => {
            authenticatedSession
              .put(`/team/${_profile.user_metadata.teams[1].id}`)
              .send({
                name: 'Vancouver Warriors'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(400)
              .end((err, res) => {
                if (err) return done.fail(err);
                expect(res.body.errors.length).toEqual(1);
                expect(res.body.errors[0].message).toEqual('That team is already registered');
                done();
              });
          });

          it('doesn\'t barf if team doesn\'t exist', done => {
            authenticatedSession
              .put('/team/333')
              .send({
                name: 'Vancouver Riot'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(404)
              .end((err, res) => {
                if (err) return done.fail(err);
                expect(res.body.message).toEqual('No such team');
                done();
              });
          });

          describe('Auth0', () => {
            it('is called to retrieve team membership', done => {
              authenticatedSession
                .put(`/team/${teamId}`)
                .send({
                  name: 'Vancouver Riot'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  expect(teamMembershipReadOauthTokenScope.isDone()).toBe(true);
                  expect(teamMembershipReadScope.isDone()).toBe(true);
                  done();
                });
            });

            it('is called to retrieve outstanding RSVPs', done => {
              authenticatedSession
                .put(`/team/${teamId}`)
                .send({
                  name: 'Vancouver Riot'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  // Doesn't get called because route is re-using token
                  expect(teamReadOauthTokenScope.isDone()).toBe(false);
                  expect(teamReadScope.isDone()).toBe(true);
                  done();
                });
            });


            it('is called to update the agent user_metadata', done => {
              authenticatedSession
                .put(`/team/${teamId}`)
                .send({
                  name: 'Vancouver Riot'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
                  expect(userAppMetadataUpdateScope.isDone()).toBe(true);
                  done();
                });
            });
          });

          describe('membership update', () => {
            beforeEach(done => {
              // This mainly serves to wipe out the mocks
              authenticatedSession
                .put(`/team/${teamId}`)
                .send({
                  name: 'Vancouver Riot'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  // Cached profile doesn't match "live" data, so agent needs to be updated
                  // with a call to Auth0
                  stubUserRead((err, apiScopes) => {
                    if (err) return done.fail();

                    stubUserRolesRead((err, apiScopes) => {
                      if (err) return done(err);

                      // Read team membership
                      stubTeamRead([{..._profile},
                                    {..._profile, email: 'someotherguy@example.com', name: 'Some Other Guy',
                                       user_metadata: { teams: [{ name: 'Vancouver Riot', leader: _profile.email, id: teamId, organizationId: organizationId }] }
                                    },
                                    {..._profile, email: 'yetanotherteamplayer@example.com', name: 'Team Player',
                                       user_metadata: { teams: [{ name: 'Vancouver Riot', leader: _profile.email, id: teamId, organizationId: organizationId }] }
                                    }], (err, apiScopes) => {
                        if (err) return done.fail();
                        ({teamReadScope, teamReadOauthTokenScope} = apiScopes);

                        // Get RSVPs
                        stubTeamRead([], (err, apiScopes) => {
                          if (err) return done.fail();
                          ({teamReadScope, teamReadOauthTokenScope} = apiScopes);

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

            it('creates an update record to update team info on next login', done => {
              models.Update.findAll().then(updates => {
                expect(updates.length).toEqual(0);

                authenticatedSession
                  .put(`/team/${teamId}`)
                  .send({
                    name: 'Vancouver Warriors'
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end((err, res) => {
                    if (err) return done.fail(err);
                    models.Update.findAll().then(updates => {

                      expect(updates.length).toEqual(2);

                      expect(updates[0].type).toEqual('team');
                      expect(updates[0].uuid).toEqual(teamId);
                      expect(updates[0].recipient).toEqual('someotherguy@example.com');
                      expect(updates[0].data).toBeDefined();
                      expect(updates[0].data.name).toEqual('Vancouver Warriors');
                      expect(updates[0].data.leader).toEqual('someguy@example.com');
                      expect(updates[0].data.id).toEqual(teamId);
                      expect(updates[0].data.organizationId).toEqual(organizationId);

                      expect(updates[1].type).toEqual('team');
                      expect(updates[1].uuid).toEqual(teamId);
                      expect(updates[1].recipient).toEqual('yetanotherteamplayer@example.com');
                      expect(updates[1].data).toBeDefined();
                      expect(updates[1].data.name).toEqual('Vancouver Warriors');
                      expect(updates[1].data.leader).toEqual('someguy@example.com');
                      expect(updates[1].data.id).toEqual(teamId);
                      expect(updates[1].data.organizationId).toEqual(organizationId);

                      done();
                    }).catch(err => {
                      done.fail(err);
                    });
                  });
                }).catch(err => {
                  done.fail(err);
                });
            });


            it('overwrites existing update records to update team info on next login', done => {
              models.Update.findAll().then(updates => {
                expect(updates.length).toEqual(0);

                // First update
                authenticatedSession
                  .put(`/team/${teamId}`)
                  .send({
                    name: 'Vancouver Warriors'
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end((err, res) => {
                    if (err) return done.fail(err);
                    models.Update.findAll().then(updates => {

                      expect(updates.length).toEqual(2);

                      expect(updates[0].type).toEqual('team');
                      expect(updates[0].uuid).toEqual(teamId);
                      expect(updates[0].recipient).toEqual('someotherguy@example.com');
                      expect(updates[0].data).toBeDefined();
                      expect(updates[0].data.name).toEqual('Vancouver Warriors');
                      expect(updates[0].data.leader).toEqual('someguy@example.com');
                      expect(updates[0].data.id).toEqual(teamId);
                      expect(updates[0].data.organizationId).toEqual(organizationId);

                      expect(updates[1].type).toEqual('team');
                      expect(updates[1].uuid).toEqual(teamId);
                      expect(updates[1].recipient).toEqual('yetanotherteamplayer@example.com');
                      expect(updates[1].data).toBeDefined();
                      expect(updates[1].data.name).toEqual('Vancouver Warriors');
                      expect(updates[1].data.leader).toEqual('someguy@example.com');
                      expect(updates[1].data.id).toEqual(teamId);
                      expect(updates[1].data.organizationId).toEqual(organizationId);

                      // Reset mocks

                      // Cached profile doesn't match "live" data, so agent needs to be updated
                      // with a call to Auth0
                      stubUserRead((err, apiScopes) => {
                        if (err) return done.fail();

                        stubUserRolesRead((err, apiScopes) => {
                          if (err) return done(err);

                          stubTeamRead([{..._profile},
                                        {..._profile, email: 'someotherguy@example.com', name: 'Some Other Guy',
                                           user_metadata: { teams: [{ name: 'Vancouver Warriors', leader: _profile.email, id: teamId, organizationId: organizationId }] }
                                        },
                                        {..._profile, email: 'yetanotherteamplayer@example.com', name: 'Team Player',
                                           user_metadata: { teams: [{ name: 'Vancouver Warriors', leader: _profile.email, id: teamId, organizationId: organizationId }] }
                                        }], (err, apiScopes) => {
                            if (err) return done.fail();

                            // Get RSVPs
                            stubTeamRead([], (err, apiScopes) => {
                              if (err) return done.fail();
                              ({teamReadScope, teamReadOauthTokenScope} = apiScopes);

                              stubUserRolesRead((err, apiScopes) => {
                                if (err) return done(err);

                                stubUserAppMetadataUpdate((err, apiScopes) => {
                                  if (err) return done.fail();

                                  authenticatedSession
                                    .put(`/team/${teamId}`)
                                    .send({
                                      name: 'Vancouver Riot'
                                    })
                                    .set('Accept', 'application/json')
                                    .expect('Content-Type', /json/)
                                    .expect(201)
                                    .end((err, res) => {
                                      if (err) return done.fail(err);
                                      models.Update.findAll().then(updates => {

                                        expect(updates.length).toEqual(2);

                                        expect(updates[0].type).toEqual('team');
                                        expect(updates[0].uuid).toEqual(teamId);
                                        expect(updates[0].recipient).toEqual('someotherguy@example.com');
                                        expect(updates[0].data).toBeDefined();
                                        expect(updates[0].data.name).toEqual('Vancouver Riot');
                                        expect(updates[0].data.leader).toEqual('someguy@example.com');
                                        expect(updates[0].data.id).toEqual(teamId);
                                        expect(updates[0].data.organizationId).toEqual(organizationId);

                                        expect(updates[1].type).toEqual('team');
                                        expect(updates[1].uuid).toEqual(teamId);
                                        expect(updates[1].recipient).toEqual('yetanotherteamplayer@example.com');
                                        expect(updates[1].data).toBeDefined();
                                        expect(updates[1].data.name).toEqual('Vancouver Riot');
                                        expect(updates[1].data.leader).toEqual('someguy@example.com');
                                        expect(updates[1].data.id).toEqual(teamId);
                                        expect(updates[1].data.organizationId).toEqual(organizationId);

                                        done();
                                      }).catch(err => {
                                        done.fail(err);
                                      });
                                    });
                                });
                              });
                            });
                          });
                        });
                      });
                    }).catch(err => {
                      done.fail(err);
                    });
                  });
                }).catch(err => {
                  done.fail(err);
                });
            });
          });
        });
      });

      describe('delete', () => {
        let teamId;
        beforeEach(done => {
          teamId = uuid.v4();

          _profile.user_metadata = { teams: [{ name: 'Saskatchewan Rush', leader: _profile.email, id: teamId }] };
          // Add another team just for fun
          _profile.user_metadata.teams.push({ name: 'Philadelphia Wings', leader: 'someotherguy@example.com', id: uuid.v4() });

          stubAuth0ManagementApi((err, apiScopes) => {
            if (err) return done.fail();

            login(_identity, [scope.delete.teams], (err, session) => {
              if (err) return done.fail(err);
              authenticatedSession = session;

              // Cached profile doesn't match "live" data, so agent needs to be updated
              // with a call to Auth0
              stubUserRead((err, apiScopes) => {
                if (err) return done.fail();

                stubTeamRead((err, apiScopes) => {
                  if (err) return done.fail();
                  ({teamReadScope, teamReadOauthTokenScope} = apiScopes);

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

        describe('by team leader', () => {
          it('removes team from Auth0', done => {
            expect(_profile.user_metadata.teams.length).toEqual(2);
            authenticatedSession
              .delete(`/team/${teamId}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end((err, res) => {
                if (err) return done.fail(err);
                expect(res.body.message).toEqual('Team deleted');
                expect(res.body.agent.user_metadata.teams.length).toEqual(1);
                done();
              });
          });

          it('updates the user session data', done => {
            models.Session.findAll().then(results => {
              expect(results.length).toEqual(1);
              let session = JSON.parse(results[0].data).passport.user;
              console.log(session);
              expect(session.user_metadata.teams.length).toEqual(2);

              authenticatedSession
                .delete(`/team/${teamId}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  models.Session.findAll().then(results => {
                    expect(results.length).toEqual(1);
                    session = JSON.parse(results[0].data).passport.user;
                    console.log(session);
                    expect(session.user_metadata.teams.length).toEqual(1);

                    done();
                  }).catch(err => {
                    done.fail(err);
                  });
                });
            }).catch(err => {
              done.fail(err);
            });
          });

          it('does not remove the team if it still has member agents', done => {
            // This call just clears the mock so that it can be reset
            authenticatedSession
              .delete(`/team/${teamId}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end((err, res) => {
                if (err) return done.fail(err);

                // Reset team leader data
                _profile.user_metadata.teams.push({ name: 'Saskatchewan Rush', leader: _profile.email, id: teamId });

                // Cached profile doesn't match "live" data, so agent needs to be updated
                // with a call to Auth0
                stubUserRead((err, apiScopes) => {
                  if (err) return done.fail();

                 stubUserRolesRead((err, apiScopes) => {
                    if (err) return done(err);

                    // Set new return value for team read stub
                    stubTeamRead([{..._profile}, {..._profile, email: 'someotherguy@example.com', name: 'Some Other Guy',
                                                  user_metadata: { teams: [{ name: 'Saskatchewan Rush', leader: _profile.email, id: teamId }] }}], (err, apiScopes) => {
                      if (err) return done.fail();

                      authenticatedSession
                        .delete(`/team/${teamId}`)
                        .set('Accept', 'application/json')
                        .expect('Content-Type', /json/)
                        .expect(200)
                        .end((err, res) => {
                          if (err) return done.fail(err);

                          expect(res.body.message).toEqual('Team still has members. Cannot delete');
                          done();
                        });
                    });
                  });
                });
              });
          });

          describe('Auth0', () => {
            it('is called to retrieve the agent user_metadata', done => {
              authenticatedSession
                .delete(`/team/${teamId}`)
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

            it('is called to update the agent', done => {
              authenticatedSession
                .delete(`/team/${teamId}`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end((err, res) => {
                  if (err) return done.fail(err);

                  expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
                  expect(userAppMetadataUpdateScope.isDone()).toBe(true);
                  done();
                });
            });
          });
        });

        it('doesn\'t barf if team doesn\'t exist', done => {
          authenticatedSession
            .delete('/team/333')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(404)
            .end((err, res) => {
              if (err) return done.fail(err);
              expect(res.body.message).toEqual('No such team');
              done();
            });
        });
      });
    });

    describe('unauthorized', () => {

      let unauthorizedSession, unauthorizedAgent, teamId;
      beforeEach(done => {

        // This is fine for testing, but does not reflect reality (because all
        // the team data looks like it belongs to unauthorized agent
        teamId = uuid.v4();
        _profile.email = 'unauthorizedagent@example.com';
        _profile.name = 'Suspicious Guy';
        _profile.user_metadata = { teams: [{ name: 'Saskatchewan Rush', leader: 'someotherguy@example.com', id: teamId }] };
        _profile.user_metadata.teams.push({ name: 'Philadelphia Wings', leader: 'someotherguy@example.com', id: uuid.v4() });

        stubAuth0ManagementApi((err, apiScopes) => {
          if (err) return done.fail();

          login({ ..._identity, email: 'unauthorizedagent@example.com', name: 'Suspicious Guy' },
              [scope.create.teams, scope.read.teams, scope.update.teams, scope.delete.teams], (err, session) => {
            if (err) return done.fail(err);
            unauthorizedSession = session;

            stubTeamRead((err, apiScopes) => {
              if (err) return done.fail();
              ({teamReadScope, teamReadOauthTokenScope} = apiScopes);

              stubUserAppMetadataUpdate((err, apiScopes) => {
                if (err) return done.fail();
                ({userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope} = apiScopes);
                done();
              });
            });
          });
        });
      });

      describe('update', () => {
        it('returns friendly message', done => {
          unauthorizedSession
            .put(`/team/${teamId}`)
            .send({
              name: 'Vancouver Riot'
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(403)
            .end((err, res) => {
              if (err) return done.fail(err);
              expect(res.body.message).toEqual('Unauthorized');
              done();
            });
        });

        it('doesn\'t barf if team doesn\'t exist', done => {
          unauthorizedSession
            .put('/team/333')
            .send({
              name: 'Vancouver Riot'
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(404)
            .end((err, res) => {
              if (err) return done.fail(err);
              expect(res.body.message).toEqual('No such team');
              done();
            });
        });

        describe('Auth0', () => {
          it('is not called to retrieve the agent user_metadata', done => {
            unauthorizedSession
              .put(`/team/${teamId}`)
              .send({
                name: 'Vancouver Riot'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(403)
              .end((err, res) => {
                if (err) return done.fail(err);

                expect(teamReadOauthTokenScope.isDone()).toBe(false);
                expect(teamReadScope.isDone()).toBe(false);
                done();
              });
          });

          it('is not called to update the agent user_metadata', done => {
            unauthorizedSession
              .put(`/team/${teamId}`)
              .send({
                name: 'Vancouver Riot'
              })
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

      /**
       * 2020-12-3
       *
       * Why is this commented out?
       *
       * I suspect unauthorizedSessions should still be able to view a team.
       *
       * Revisit later...
       */
//      describe('read', () => {
//        it('returns 403 on organization show', done => {
//          unauthorizedSession
//            .get(`/team/${team.id}`)
//            .set('Accept', 'application/json')
//            .expect('Content-Type', /json/)
//            .expect(403)
//            .end((err, res) => {
//              if (err) return done.fail(err);
//              expect(res.body.message).toEqual('You are not a member of that team');
//              done();
//            });
//        });
//      });

      describe('delete', () => {
        it('returns 403', done => {
          unauthorizedSession
            .delete(`/team/${teamId}`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(403)
            .end((err, res) => {
              if (err) return done.fail(err);
              expect(res.body.message).toEqual('Unauthorized');
              done();
            });
        });

        describe('Auth0', () => {
          it('is called to retrieve the agent user_metadata', done => {
            unauthorizedSession
              .delete(`/team/${teamId}`)
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

          it('is not called to update the agent', done => {
            unauthorizedSession
              .delete(`/team/${teamId}`)
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

  describe('not authenticated', () => {
    it('redirects to login', done => {
      request(app)
        .get('/team')
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
