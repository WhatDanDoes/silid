const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001;
const app = require('../../../app');
const fixtures = require('sequelize-fixtures');
const uuid = require('uuid');
const models = require('../../../models');
const request = require('supertest');
const stubAuth0Sessions = require('../../support/stubAuth0Sessions');
const stubAuth0ManagementApi = require('../../support/stubAuth0ManagementApi');
const stubUserRead = require('../../support/auth0Endpoints/stubUserRead');
const stubUserAppMetadataRead = require('../../support/auth0Endpoints/stubUserAppMetadataRead');
const stubUserAppMetadataUpdate = require('../../support/auth0Endpoints/stubUserAppMetadataUpdate');
const stubTeamRead = require('../../support/auth0Endpoints/stubTeamRead');
const mailer = require('../../../mailer');
const scope = require('../../../config/permissions');
const apiScope = require('../../../config/apiPermissions');

/**
 * 2019-11-13
 * Sample tokens taken from:
 *
 * https://auth0.com/docs/api-auth/tutorials/adoption/api-tokens
 */
const _identity = require('../../fixtures/sample-auth0-identity-token');
const _profile = require('../../fixtures/sample-auth0-profile-response');

describe('root/teamSpec', () => {

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
    _profile.email_verified = true;
    _profile.email = originalProfile.email;
    delete _profile.user_metadata;
  });

  let agent;
  beforeEach(done => {
    originalProfile = {..._profile};
    _profile.email = process.env.ROOT_AGENT;

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

  describe('authorized', () => {

    let rootSession, teamId, userReadScope, teamReadScope, teamReadOauthTokenScope;
    describe('read', () => {

      describe('/team', () => {
        beforeEach(done => {
          teamId = uuid.v4();

          _profile.user_metadata = { teams: [{ name: 'The Calgary Roughnecks', leader: _profile.email, id: teamId }] };
          stubAuth0ManagementApi((err, apiScopes) => {
            if (err) return done.fail();

            login({..._identity, email: process.env.ROOT_AGENT, name: 'Professor Fresh'}, [scope.create.teams], (err, session) => {

              if (err) return done.fail(err);
              rootSession = session;

              // Cached profile doesn't match "live" data, so agent needs to be updated
              // with a call to Auth0
              stubUserRead((err, apiScopes) => {
                if (err) return done.fail();

                // This stubs calls subsequent to the initial login
                stubUserAppMetadataRead((err, apiScopes) => {
                  if (err) return done.fail();
                  ({userAppMetadataReadScope, userAppMetadataReadOauthTokenScope} = apiScopes);

                  done();
                });
              });
            });
          });
        });

        it('retrieves root agent\'s teams', done => {
          rootSession
            .get('/team')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.length).toEqual(1);
              expect(res.body[0].name).toEqual('The Calgary Roughnecks');
              done();
            });
        });

        describe('Auth0', () => {
          it('is called to retrieve a machine-to-machine access token', done => {
            rootSession
              .get('/team')
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) return done.fail(err);
                expect(userAppMetadataReadOauthTokenScope.isDone()).toBe(true);
                done();
              });
          });

          it('is called to retrieve the team data', done => {
            rootSession
              .get('/team')
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) return done.fail(err);

                expect(userAppMetadataReadScope.isDone()).toBe(true);
                done();
              });
          });
        });
      });

//      describe('/team/admin', () => {
//        it('retrieves all teams', done => {
//          models.Team.create({ name: 'The Mike Tyson Mystery Team', organizationId: organization.id, creatorId: root.id }).then(o => {
//            models.Team.findAll().then(results => {
//              expect(results.length).toEqual(2);
//
//              rootSession
//                .get('/team/admin')
//                .set('Accept', 'application/json')
//                .expect('Content-Type', /json/)
//                .expect(200)
//                .end(function(err, res) {
//                  if (err) return done.fail(err);
//                  expect(res.body.length).toEqual(2);
//                  done();
//                });
//            }).catch(err => {
//              done.fail(err);
//            });
//          }).catch(err => {
//            done.fail(err);
//          });
//        });
//      });

      describe('/team/:id', () => {
        beforeEach(done => {
          teamId = uuid.v4();

          _profile.user_metadata = { teams: [{ name: 'The Calgary Roughnecks', leader: _profile.email, id: teamId }] };

          stubAuth0ManagementApi((err, apiScopes) => {
            if (err) return done.fail();

            login({..._identity, email: process.env.ROOT_AGENT, name: 'Professor Fresh'}, [scope.create.teams], (err, session) => {

              if (err) return done.fail(err);
              rootSession = session;

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

        it('collates agent data into team data', done => {
          rootSession
            .get(`/team/${teamId}`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.name).toEqual('The Calgary Roughnecks');
              expect(res.body.leader).toEqual(_profile.email);
              expect(res.body.id).toEqual(teamId);

              done();
            });
        });

        it('doesn\'t barf if record doesn\'t exist', done => {
          rootSession
            .get('/team/33')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(404)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.message).toEqual('No such team');
              done();
            });
        });

        describe('Auth0', () => {
          it('is called to retrieve a machine-to-machine access token', done => {
            rootSession
              .get(`/team/${teamId}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) return done.fail(err);
                expect(teamReadOauthTokenScope.isDone()).toBe(true);
                done();
              });
          });

          it('is called to retrieve the team data', done => {
            rootSession
              .get(`/team/${teamId}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) return done.fail(err);

                expect(teamReadScope.isDone()).toBe(true);
                done();
              });
          });
        });
      });
    });

    describe('create', () => {

      describe('successfully', () => {
        beforeEach(done => {
          stubAuth0ManagementApi((err, apiScopes) => {
            if (err) return done.fail();

            login({..._identity, email: process.env.ROOT_AGENT, name: 'Professor Fresh'}, [scope.create.teams], (err, session) => {

              if (err) return done.fail(err);
              rootSession = session;

              // Cached profile doesn't match "live" data, so agent needs to be updated
              // with a call to Auth0
              stubUserRead((err, apiScopes) => {
                if (err) return done.fail();

                // Stub user-read calls subsequent to initial login
                //stubUserRead((err, apiScopes) => {
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
        });

        it('returns the agent profile', done => {
          rootSession
            .post('/team')
            .send({
              name: 'The Mike Tyson Mystery Team'
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.email).toEqual(_profile.email);
              expect(res.body.user_metadata.teams.length).toEqual(1);
              done();
            });
        });

        describe('Auth0', () => {
          it('calls Auth0 to retrieve the agent user_metadata', done => {
            rootSession
              .post('/team')
              .send({
                name: 'The Mike Tyson Mystery Team'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);
                expect(userAppMetadataReadOauthTokenScope.isDone()).toBe(true);
                expect(userAppMetadataReadScope.isDone()).toBe(true);
                done();
              });
          });

          it('calls Auth0 to update the agent', done => {
            rootSession
              .post('/team')
              .send({
                name: 'The Mike Tyson Mystery Team'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);

                expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(true);
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

            login({..._identity, email: process.env.ROOT_AGENT, name: 'Professor Fresh'}, [scope.create.teams], (err, session) => {

              if (err) return done.fail(err);
              rootSession = session;

              // Cached profile doesn't match "live" data, so agent needs to be updated
              // with a call to Auth0
              stubUserRead((err, apiScopes) => {
                if (err) return done.fail();

                // Stub user-read calls subsequent to login
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
        });

        describe('add a duplicate team name', () => {
          it('returns an error if record already exists', done => {
            rootSession
              .post('/team')
              .send({
                name: 'The Calgary Roughnecks'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(400)
              .end(function(err, res) {
                if (err) return done.fail(err);
                expect(res.body.errors.length).toEqual(1);
                expect(res.body.errors[0].message).toEqual('That team is already registered');
                done();
              });
          });

          describe('Auth0', () => {
            it('calls Auth0 to retrieve the agent user_metadata', done => {
              rootSession
                .post('/team')
                .send({
                  name: 'The Calgary Roughnecks'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(400)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  expect(userAppMetadataReadOauthTokenScope.isDone()).toBe(true);
                  expect(userAppMetadataReadScope.isDone()).toBe(true);
                  done();
                });
            });

            it('does not call Auth0 to update the agent user_metadata', done => {
              rootSession
                .post('/team')
                .send({
                  name: 'The Calgary Roughnecks'
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

        it('returns an error if empty team name provided', done => {
          rootSession
            .post('/team')
            .send({
              name: '   '
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(400)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.errors.length).toEqual(1);
              expect(res.body.errors[0].message).toEqual('Team requires a name');
              done();
            });
        });

        it('returns an error if no team name provided', done => {
          rootSession
            .post('/team')
            .send({})
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(400)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.errors.length).toEqual(1);
              expect(res.body.errors[0].message).toEqual('Team requires a name');
              done();
            });
        });
      });
    });

    describe('update', () => {
      describe('as team leader', () => {
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

            login({..._identity, email: process.env.ROOT_AGENT, name: 'Professor Fresh'}, [scope.update.teams], (err, session) => {
              if (err) return done.fail(err);
              rootSession = session;

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
                  const rsvps = [
                    {..._profile, email: 'someprospectiveteammember@example.com', name: 'Some Prospective Team Member',
                       user_metadata: { rsvps: [{ name: 'Vancouver Warriors', recipient: 'someprospectiveteammember@example.com', uuid: teamId, type: 'team' }] }
                    }
                  ];
                  stubTeamRead(rsvps, (err, apiScopes) => {
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

        it('allows root to update an existing record', done => {
          rootSession
            .put(`/team/${teamId}`)
            .send({
              name: 'Vancouver Riot'
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) return done.fail(err);

              expect(res.body.name).toEqual('Vancouver Riot');
              expect(res.body.leader).toEqual(_profile.email);
              expect(res.body.id).toEqual(teamId);
              expect(res.body.members).toEqual([{ name: _profile.name, email: _profile.email, user_id: _profile.user_id }]);
              done();
            });
        });

        it('updates any pending invitations', done => {
          rootSession
            .put(`/team/${teamId}`)
            .send({
              name: 'Vancouver Riot'
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) return done.fail(err);

              expect(_profile.user_metadata.pendingInvitations.length).toEqual(2);
              expect(_profile.user_metadata.pendingInvitations[0].name).toEqual('Vancouver Riot');
              expect(_profile.user_metadata.pendingInvitations[1].name).toEqual('Vancouver Riot');
              done();
            });
        });

        it('creates a database invitation/update for any RSVPs', done => {
          models.Invitation.findAll().then(results => {
            expect(results.length).toEqual(0);
            rootSession
              .put(`/team/${teamId}`)
              .send({
                name: 'Vancouver Riot'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);

                models.Invitation.findAll().then(invites => {
                  expect(invites.length).toEqual(1);
                  expect(invites[0].name).toEqual('Vancouver Riot');
                  expect(invites[0].uuid).toEqual(teamId);
                  done();
                }).catch(err => {
                  done.fail(err);
                });
              });

          }).catch(err => {
            done.fail(err);
          });
        });

        it('updates any database invitations', done => {
          models.Invitation.create({ name: 'Vancouver Warriors', recipient: 'onecooldude@example.com', uuid: teamId, type: 'team' }).then(results => {
            rootSession
              .put(`/team/${teamId}`)
              .send({
                name: 'Vancouver Riot'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);

                models.Invitation.findAll({ where: {recipient: 'onecooldude@example.com'} }).then(invites => {
                  expect(invites.length).toEqual(1);
                  expect(invites[0].name).toEqual('Vancouver Riot');
                  expect(invites[0].uuid).toEqual(teamId);
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
          rootSession
            .put(`/team/${teamId}`)
            .send({
              name: '   '
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(400)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.errors.length).toEqual(1);
              expect(res.body.errors[0].message).toEqual('Team requires a name');
              done();
            });
        });

        it('returns an error if record already exists', done => {
          rootSession
            .put(`/team/${_profile.user_metadata.teams[1].id}`)
            .send({
              name: 'Vancouver Warriors'
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(400)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.errors.length).toEqual(1);
              expect(res.body.errors[0].message).toEqual('That team is already registered');
              done();
            });
        });

        it('doesn\'t barf if team doesn\'t exist', done => {
          rootSession
            .put('/team/333')
            .send({
              name: 'Vancouver Riot'
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

        describe('Auth0', () => {
          it('is called to retrieve team membership', done => {
            rootSession
              .put(`/team/${teamId}`)
              .send({
                name: 'Vancouver Riot'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);

                expect(teamMembershipReadOauthTokenScope.isDone()).toBe(true);
                expect(teamMembershipReadScope.isDone()).toBe(true);
                done();
              });
          });

          it('is called to retrieve outstanding RSVPs', done => {
            rootSession
              .put(`/team/${teamId}`)
              .send({
                name: 'Vancouver Riot'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);

                // Doesn't get called because route is re-using token
                expect(teamReadOauthTokenScope.isDone()).toBe(false);
                expect(teamReadScope.isDone()).toBe(true);
                done();
              });
          });

          it('is called to update the agent user_metadata', done => {
            rootSession
              .put(`/team/${teamId}`)
              .send({
                name: 'Vancouver Riot'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);

                expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(true);
                expect(userAppMetadataUpdateScope.isDone()).toBe(true);
                done();
              });
          });
        });

        describe('membership update', () => {
          beforeEach(done => {
            // This mainly serves to wipe out the mocks
            rootSession
              .put(`/team/${teamId}`)
              .send({
                name: 'Vancouver Riot'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);

                // Cached profile doesn't match "live" data, so agent needs to be updated
                // with a call to Auth0
                stubUserRead((err, apiScopes) => {
                  if (err) return done.fail();

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

          // 2020-6-8 One of these is creating a sporadic 404 error. It has not been
          // reproduced and disappears on subsequent executions. Keep an eye out
          it('creates an invitation record to update team info on next login', done => {
            models.Invitation.findAll().then(invites => {
              // One invite because of the RSVP in the ancestor beforeEach
              expect(invites.length).toEqual(1);

              rootSession
                .put(`/team/${teamId}`)
                .send({
                  name: 'Vancouver Warriors'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) return done.fail(err);
                  models.Invitation.findAll({ order: [['recipient', 'ASC']] }).then(invites => {

                    expect(invites.length).toEqual(3);

                    expect(invites[0].name).toEqual('Vancouver Warriors');
                    expect(invites[0].type).toEqual('team');
                    expect(invites[0].uuid).toEqual(teamId);
                    expect(invites[0].recipient).toEqual('someotherguy@example.com');

                    expect(invites[1].name).toEqual('Vancouver Warriors');
                    expect(invites[1].type).toEqual('team');
                    expect(invites[1].uuid).toEqual(teamId);
                    expect(invites[1].recipient).toEqual('someprospectiveteammember@example.com');

                    expect(invites[2].name).toEqual('Vancouver Warriors');
                    expect(invites[2].type).toEqual('team');
                    expect(invites[2].uuid).toEqual(teamId);
                    expect(invites[2].recipient).toEqual('yetanotherteamplayer@example.com');

                    done();
                  }).catch(err => {
                    done.fail(err);
                  });
                });
              }).catch(err => {
                done.fail(err);
              });
          });

          // 2020-6-24 One of these is creating a sporadic 404 error. It has not been
          // reproduced and disappears on subsequent executions. Keep an eye out
          it('overwrites existing invitation records to update team info on next login', done => {
            models.Invitation.findAll().then(invites => {
              // One invite because of the RSVP in the ancestor beforeEach
              expect(invites.length).toEqual(1);

              // First update
              rootSession
                .put(`/team/${teamId}`)
                .send({
                  name: 'Vancouver Warriors'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) return done.fail(err);
                  models.Invitation.findAll({ order: [['recipient', 'ASC']] }).then(invites => {

                    expect(invites.length).toEqual(3);

                    expect(invites[0].name).toEqual('Vancouver Warriors');
                    expect(invites[0].type).toEqual('team');
                    expect(invites[0].uuid).toEqual(teamId);
                    expect(invites[0].recipient).toEqual('someotherguy@example.com');

                    expect(invites[1].name).toEqual('Vancouver Warriors');
                    expect(invites[1].type).toEqual('team');
                    expect(invites[1].uuid).toEqual(teamId);
                    expect(invites[1].recipient).toEqual('someprospectiveteammember@example.com');

                    expect(invites[2].name).toEqual('Vancouver Warriors');
                    expect(invites[2].type).toEqual('team');
                    expect(invites[2].uuid).toEqual(teamId);
                    expect(invites[2].recipient).toEqual('yetanotherteamplayer@example.com');

                    // Reset mocks

                    // Cached profile doesn't match "live" data, so agent needs to be updated
                    // with a call to Auth0
                    stubUserRead((err, apiScopes) => {
                      if (err) return done.fail();

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

                          stubUserAppMetadataUpdate((err, apiScopes) => {
                            if (err) return done.fail();

                            rootSession
                              .put(`/team/${teamId}`)
                              .send({
                                name: 'Vancouver Riot'
                              })
                              .set('Accept', 'application/json')
                              .expect('Content-Type', /json/)
                              .expect(201)
                              .end(function(err, res) {
                                if (err) return done.fail(err);
                                models.Invitation.findAll({ order: [['recipient', 'ASC']] }).then(invites => {

                                  expect(invites[0].name).toEqual('Vancouver Riot');
                                  expect(invites[0].type).toEqual('team');
                                  expect(invites[0].uuid).toEqual(teamId);
                                  expect(invites[0].recipient).toEqual('someotherguy@example.com');

                                  expect(invites[1].name).toEqual('Vancouver Riot');
                                  expect(invites[1].type).toEqual('team');
                                  expect(invites[1].uuid).toEqual(teamId);
                                  expect(invites[1].recipient).toEqual('someprospectiveteammember@example.com');

                                  expect(invites[2].name).toEqual('Vancouver Riot');
                                  expect(invites[2].type).toEqual('team');
                                  expect(invites[2].uuid).toEqual(teamId);
                                  expect(invites[2].recipient).toEqual('yetanotherteamplayer@example.com');

                                  done();
                                }).catch(err => {
                                  done.fail(err);
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

      describe('as team member', () => {
        const teamLeaderProfile = {..._profile, email: 'someotherguy@example.com', name: 'Some Other Guy', user_id: _profile.user_id + 1};

        let teamId, teamReadScope, teamReadOauthTokenScope, teamMembershipReadScope, teamMembershipReadOauthTokenScope;
        beforeEach(done => {
          teamId = uuid.v4();
          _profile.user_metadata = { teams: [{ name: 'Vancouver Warriors', leader: 'someotherguy@example.com', id: teamId }] };

          stubAuth0ManagementApi((err, apiScopes) => {
            if (err) return done.fail();

            login({..._identity, email: process.env.ROOT_AGENT, name: 'Professor Fresh'}, [scope.update.teams], (err, session) => {
              if (err) return done.fail(err);
              rootSession = session;

              // Cached profile doesn't match "live" data, so agent needs to be updated
              // with a call to Auth0
              stubUserRead((err, apiScopes) => {
                if (err) return done.fail();

                // Get team members
                teamLeaderProfile.user_metadata = {
                  teams: [{ name: 'Vancouver Warriors', leader: 'someotherguy@example.com', id: teamId }],
                  pendingInvitations: [{ name: 'Vancouver Warriors', recipient: 'newteammember@example.com', uuid: teamId, type: 'team' }]
                };

                stubTeamRead([_profile, teamLeaderProfile], (err, apiScopes) => {
                  if (err) return done.fail();
                  ({teamReadScope, teamReadOauthTokenScope} = apiScopes);
                  teamMembershipReadScope = teamReadScope;
                  teamMembershipReadOauthTokenScope = teamReadOauthTokenScope;

                  // Get RSVPs
                  stubTeamRead((err, apiScopes) => {
                    if (err) return done.fail();
                    ({teamReadScope, teamReadOauthTokenScope} = apiScopes);

                    stubUserAppMetadataUpdate(teamLeaderProfile, (err, apiScopes) => {
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

        it('allows root to update an existing record', done => {
          rootSession
            .put(`/team/${teamId}`)
            .send({
              name: 'Vancouver Riot'
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) return done.fail(err);

              expect(res.body.name).toEqual('Vancouver Riot');
              expect(res.body.leader).toEqual('someotherguy@example.com');
              expect(res.body.id).toEqual(teamId);
              expect(res.body.members.length).toEqual(2);
              expect(res.body.members[0]).toEqual({ name: _profile.name, email: _profile.email, user_id: _profile.user_id });
              expect(res.body.members[1]).toEqual({ name: 'Some Other Guy', email: 'someotherguy@example.com', user_id: _profile.user_id + 1 });
              done();
            });
        });

        it('creates a database invitation to update the root agent', done => {
          models.Invitation.findAll().then(invites => {
            expect(invites.length).toEqual(0);
            rootSession
              .put(`/team/${teamId}`)
              .send({
                name: 'Vancouver Riot'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);

                models.Invitation.findAll().then(invites => {
                  expect(invites.length).toEqual(1);
                  expect(invites[0].name).toEqual('Vancouver Riot');
                  expect(invites[0].uuid).toEqual(teamId);
                  expect(invites[0].recipient).toEqual('root@example.com');
                  expect(invites[0].type).toEqual('team');
                  done();
                }).catch(err => {
                  done.fail(err);
                });
              });
          }).catch(err => {
            done.fail(err);
          });
        });

        it('updates any database invitations', done => {
          models.Invitation.create({ name: 'Vancouver Warriors', recipient: 'onecooldude@example.com', uuid: teamId, type: 'team' }).then(results => {
            rootSession
              .put(`/team/${teamId}`)
              .send({
                name: 'Vancouver Riot'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);

                models.Invitation.findAll({ order: [['recipient', 'ASC']] }).then(invites => {
                  // Two, because the team leader got an invite to update
                  expect(invites.length).toEqual(2);
                  expect(invites[0].name).toEqual('Vancouver Riot');
                  expect(invites[0].uuid).toEqual(teamId);
                  expect(invites[0].recipient).toEqual('onecooldude@example.com');
                  expect(invites[0].type).toEqual('team');
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
          rootSession
            .put(`/team/${teamId}`)
            .send({
              name: '   '
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(400)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.errors.length).toEqual(1);
              expect(res.body.errors[0].message).toEqual('Team requires a name');
              done();
            });
        });

        it('returns an error if record already exists', done => {
          rootSession
            .put(`/team/${teamId}`)
            .send({
              name: 'Vancouver Warriors'
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(400)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.errors.length).toEqual(1);
              expect(res.body.errors[0].message).toEqual('That team is already registered');
              done();
            });
        });

        describe('Auth0', () => {
          it('is called to retrieve team membership', done => {
            rootSession
              .put(`/team/${teamId}`)
              .send({
                name: 'Vancouver Riot'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);

                expect(teamMembershipReadOauthTokenScope.isDone()).toBe(true);
                expect(teamMembershipReadScope.isDone()).toBe(true);
                done();
              });
          });

          it('is called to retrieve outstanding RSVPs', done => {
            rootSession
              .put(`/team/${teamId}`)
              .send({
                name: 'Vancouver Riot'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);

                // Doesn't get called because route is re-using token
                expect(teamReadOauthTokenScope.isDone()).toBe(false);
                expect(teamReadScope.isDone()).toBe(true);
                done();
              });
          });

          it('is called to update the agent user_metadata', done => {
            rootSession
              .put(`/team/${teamId}`)
              .send({
                name: 'Vancouver Riot'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);

                expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(true);
                expect(userAppMetadataUpdateScope.isDone()).toBe(true);
                done();
              });
          });
        });

        describe('membership update', () => {
          beforeEach(done => {
            // This mainly serves to wipe out the mocks
            rootSession
              .put(`/team/${teamId}`)
              .send({
                name: 'Vancouver Riot'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);

                // Cached profile doesn't match "live" data, so agent needs to be updated
                // with a call to Auth0
                stubUserRead((err, apiScopes) => {
                  if (err) return done.fail();

                  // Read team membership
                  stubTeamRead([{..._profile},
                                {..._profile, email: 'someotherguy@example.com', name: 'Some Other Guy',
                                   user_metadata: { teams: [{ name: 'Vancouver Riot', leader: 'someotherguy@example.com', id: teamId }] }
                                },
                                {..._profile, email: 'yetanotherteamplayer@example.com', name: 'Team Player',
                                   user_metadata: { teams: [{ name: 'Vancouver Riot', leader: 'someotherguy@example.com', id: teamId }] }
                                }], (err, apiScopes) => {
                    if (err) return done.fail();
                    ({teamReadScope, teamReadOauthTokenScope} = apiScopes);

                    // Get RSVPs
                    stubTeamRead([], (err, apiScopes) => {
                      if (err) return done.fail();
                      ({teamReadScope, teamReadOauthTokenScope} = apiScopes);

                      // Root is going to get an invitation, which requires an Auth0 update call
                      stubUserAppMetadataUpdate((err, apiScopes) => {
                        if (err) return done.fail();

                        // This one updates the team leader
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

          // 2020-6-8 One of these is creating a sporadic 404 error. It has not been
          // reproduced and disappears on subsequent executions. Keep an eye out
          it('creates an invitation record to update team info on next login', done => {
            models.Invitation.findAll().then(invites => {
              // One, because root got updated when mock was cleared
              expect(invites.length).toEqual(1);

              rootSession
                .put(`/team/${teamId}`)
                .send({
                  name: 'Vancouver Warriors'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) return done.fail(err);
                  models.Invitation.findAll({ order: [['recipient', 'ASC']] }).then(invites => {

                    expect(invites.length).toEqual(2);

                    expect(invites[0].name).toEqual('Vancouver Warriors');
                    expect(invites[0].type).toEqual('team');
                    expect(invites[0].uuid).toEqual(teamId);
                    expect(invites[0].recipient).toEqual('root@example.com');

                    expect(invites[1].name).toEqual('Vancouver Warriors');
                    expect(invites[1].type).toEqual('team');
                    expect(invites[1].uuid).toEqual(teamId);
                    expect(invites[1].recipient).toEqual('yetanotherteamplayer@example.com');

                    done();
                  }).catch(err => {
                    done.fail(err);
                  });
                });
              }).catch(err => {
                done.fail(err);
              });
          });

          // 2020-6-24 One of these is creating a sporadic 404 error. It has not been
          // reproduced and disappears on subsequent executions. Keep an eye out
          it('overwrites existing invitation records to update team info on next login', done => {
            models.Invitation.findAll().then(invites => {
              // One, because team leader got updated when mock was cleared
              expect(invites.length).toEqual(1);

              // First update
              rootSession
                .put(`/team/${teamId}`)
                .send({
                  name: 'Vancouver Warriors'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) return done.fail(err);
                  models.Invitation.findAll({ order: [['recipient', 'ASC']] }).then(invites => {

                    expect(invites.length).toEqual(2);

                    expect(invites[0].name).toEqual('Vancouver Warriors');
                    expect(invites[0].type).toEqual('team');
                    expect(invites[0].uuid).toEqual(teamId);
                    expect(invites[0].recipient).toEqual('root@example.com');

                    expect(invites[1].name).toEqual('Vancouver Warriors');
                    expect(invites[1].type).toEqual('team');
                    expect(invites[1].uuid).toEqual(teamId);
                    expect(invites[1].recipient).toEqual('yetanotherteamplayer@example.com');

                    // Reset mocks

                    // Cached profile doesn't match "live" data, so agent needs to be updated
                    // with a call to Auth0
                    stubUserRead((err, apiScopes) => {
                      if (err) return done.fail();

                      stubTeamRead([{..._profile},
                                    {..._profile, email: 'someotherguy@example.com', name: 'Some Other Guy',
                                       user_metadata: { teams: [{ name: 'Vancouver Warriors', leader: 'someotherguy@example.com', id: teamId }] }
                                    },
                                    {..._profile, email: 'yetanotherteamplayer@example.com', name: 'Team Player',
                                       user_metadata: { teams: [{ name: 'Vancouver Warriors', leader: 'someotherguy@example.com', id: teamId }] }
                                    }], (err, apiScopes) => {
                        if (err) return done.fail();

                        // Get RSVPs
                        stubTeamRead([], (err, apiScopes) => {
                          if (err) return done.fail();
                          ({teamReadScope, teamReadOauthTokenScope} = apiScopes);

                          // Root is going to get an invitation, which requires an Auth0 update call
                          stubUserAppMetadataUpdate((err, apiScopes) => {
                            if (err) return done.fail();

                            // This one updates team leader
                            stubUserAppMetadataUpdate((err, apiScopes) => {
                              if (err) return done.fail();

                              rootSession
                                .put(`/team/${teamId}`)
                                .send({
                                  name: 'Vancouver Riot'
                                })
                                .set('Accept', 'application/json')
                                .expect('Content-Type', /json/)
                                .expect(201)
                                .end(function(err, res) {
                                  if (err) return done.fail(err);
                                  models.Invitation.findAll().then(invites => {

                                    expect(invites.length).toEqual(2);

                                    expect(invites[0].name).toEqual('Vancouver Riot');
                                    expect(invites[0].type).toEqual('team');
                                    expect(invites[0].uuid).toEqual(teamId);
                                    expect(invites[0].recipient).toEqual('root@example.com');

                                    expect(invites[1].name).toEqual('Vancouver Riot');
                                    expect(invites[1].type).toEqual('team');
                                    expect(invites[1].uuid).toEqual(teamId);
                                    expect(invites[1].recipient).toEqual('yetanotherteamplayer@example.com');

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

      describe('as non-member', () => {
        const teamLeaderProfile = {..._profile, email: 'someotherguy@example.com', name: 'Some Other Guy', user_id: _profile.user_id + 1};

        let teamId, teamReadScope, teamReadOauthTokenScope, teamMembershipReadScope, teamMembershipReadOauthTokenScope;
        beforeEach(done => {
          teamId = uuid.v4();
          _profile.user_metadata = {};

          stubAuth0ManagementApi((err, apiScopes) => {
            if (err) return done.fail();

            login({..._identity, email: process.env.ROOT_AGENT, name: 'Professor Fresh'}, [scope.update.teams], (err, session) => {
              if (err) return done.fail(err);
              rootSession = session;

              // Cached profile doesn't match "live" data, so agent needs to be updated
              // with a call to Auth0
              stubUserRead((err, apiScopes) => {
                if (err) return done.fail();

                // Get team members
                teamLeaderProfile.user_metadata = {
                  teams: [{ name: 'Vancouver Warriors', leader: teamLeaderProfile.email, id: teamId }],
                  pendingInvitations: [{ name: 'Vancouver Warriors', recipient: 'someprospectiveteammember@example.com', uuid: teamId, type: 'team' }]
                };

                stubTeamRead([
                  teamLeaderProfile,
                  {..._profile, email: 'teamplayer@example.com', name: 'Team Player', user_id: _profile.user_id + 2,
                    user_metadata: {
                      teams: [{ name: 'Vancouver Warriors', leader: teamLeaderProfile.email, id: teamId }]
                    }
                  }
                ], (err, apiScopes) => {
                  if (err) return done.fail();
                  ({teamReadScope, teamReadOauthTokenScope} = apiScopes);
                  teamMembershipReadScope = teamReadScope;
                  teamMembershipReadOauthTokenScope = teamReadOauthTokenScope;

                  // Get RSVPs
                  const rsvps = [
                    {..._profile, email: 'someprospectiveteammember@example.com', name: 'Some Prospective Team Member',
                       user_metadata: { rsvps: [{ name: 'Vancouver Warriors', recipient: 'someprospectiveteammember@example.com', uuid: teamId, type: 'team' }] }
                    }
                  ];
                  stubTeamRead(rsvps, (err, apiScopes) => {
                    if (err) return done.fail();
                    ({teamReadScope, teamReadOauthTokenScope} = apiScopes);

                    stubUserAppMetadataUpdate(teamLeaderProfile, (err, apiScopes) => {
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

        it('allows root to update an existing record', done => {
          rootSession
            .put(`/team/${teamId}`)
            .send({
              name: 'Vancouver Riot'
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) return done.fail(err);

              expect(res.body.name).toEqual('Vancouver Riot');
              expect(res.body.leader).toEqual('someotherguy@example.com');
              expect(res.body.id).toEqual(teamId);
              expect(res.body.members.length).toEqual(2);
              expect(res.body.members[0]).toEqual({ name: 'Some Other Guy', email: 'someotherguy@example.com', user_id: _profile.user_id + 1 });
              expect(res.body.members[1]).toEqual({ name: 'Team Player', email: 'teamplayer@example.com', user_id: _profile.user_id + 2});
              done();
            });
        });

        it('updates the team leader\'s profile and any pending invitations', done => {
          rootSession
            .put(`/team/${teamId}`)
            .send({
              name: 'Vancouver Riot'
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) return done.fail(err);

              expect(teamLeaderProfile.user_metadata.teams.length).toEqual(1);
              expect(teamLeaderProfile.user_metadata.teams[0].name).toEqual('Vancouver Riot');
              expect(teamLeaderProfile.user_metadata.pendingInvitations.length).toEqual(1);
              expect(teamLeaderProfile.user_metadata.pendingInvitations[0].name).toEqual('Vancouver Riot');
              done();
            });
        });

        it('creates a database invitation/update for RSVPs and team members', done => {
          models.Invitation.findAll().then(results => {
            expect(results.length).toEqual(0);
            rootSession
              .put(`/team/${teamId}`)
              .send({
                name: 'Vancouver Riot'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);

                models.Invitation.findAll({ order: [['recipient', 'ASC']] }).then(invites => {
                  expect(invites.length).toEqual(2);

                  // RSVP
                  expect(invites[0].name).toEqual('Vancouver Riot');
                  expect(invites[0].uuid).toEqual(teamId);
                  expect(invites[0].recipient).toEqual('someprospectiveteammember@example.com');
                  expect(invites[0].type).toEqual('team');

                  // Team member
                  expect(invites[1].name).toEqual('Vancouver Riot');
                  expect(invites[1].uuid).toEqual(teamId);
                  expect(invites[1].recipient).toEqual('teamplayer@example.com');
                  expect(invites[1].type).toEqual('team');

                  done();
                }).catch(err => {
                  done.fail(err);
                });
              });
          }).catch(err => {
            done.fail(err);
          });
        });

        it('updates any existing database invitations', done => {
          models.Invitation.create({ name: 'Vancouver Warriors', recipient: 'onecooldude@example.com', uuid: teamId, type: 'team' }).then(results => {
            rootSession
              .put(`/team/${teamId}`)
              .send({
                name: 'Vancouver Riot'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);

                models.Invitation.findAll({ where: {recipient: 'onecooldude@example.com'} }).then(invites => {
                  expect(invites.length).toEqual(1);
                  expect(invites[0].name).toEqual('Vancouver Riot');
                  expect(invites[0].uuid).toEqual(teamId);
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
          rootSession
            .put(`/team/${teamId}`)
            .send({
              name: '   '
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(400)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.errors.length).toEqual(1);
              expect(res.body.errors[0].message).toEqual('Team requires a name');
              done();
            });
        });

        it('returns an error if record already exists', done => {
          rootSession
            .put(`/team/${teamId}`)
            .send({
              name: 'Vancouver Warriors'
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(400)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.errors.length).toEqual(1);
              expect(res.body.errors[0].message).toEqual('That team is already registered');
              done();
            });
        });

        describe('Auth0', () => {
          it('is called to retrieve team membership', done => {
            rootSession
              .put(`/team/${teamId}`)
              .send({
                name: 'Vancouver Riot'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);

                expect(teamMembershipReadOauthTokenScope.isDone()).toBe(true);
                expect(teamMembershipReadScope.isDone()).toBe(true);
                done();
              });
          });

          it('is called to retrieve outstanding RSVPs', done => {
            rootSession
              .put(`/team/${teamId}`)
              .send({
                name: 'Vancouver Riot'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);

                // Doesn't get called because route is re-using token
                expect(teamReadOauthTokenScope.isDone()).toBe(false);
                expect(teamReadScope.isDone()).toBe(true);
                done();
              });
          });


          it('is called to update the agent user_metadata', done => {
            rootSession
              .put(`/team/${teamId}`)
              .send({
                name: 'Vancouver Riot'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);

                expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(true);
                expect(userAppMetadataUpdateScope.isDone()).toBe(true);
                done();
              });
          });
        });
      });
    });

    describe('delete', () => {

      describe('one of root\'s own teams', () => {

        let rootTeamId;
        beforeEach(done => {

          rootTeamId = uuid.v4();
          _profile.user_metadata = { teams: [{ name: 'Saskatchewan Rush', leader: process.env.ROOT_AGENT, id: rootTeamId }] };

          stubAuth0ManagementApi((err, apiScopes) => {
            if (err) return done.fail();

            login({..._identity, email: process.env.ROOT_AGENT, name: 'Professor Fresh'}, [scope.delete.teams], (err, session) => {

              if (err) return done.fail(err);
              rootSession = session;

              // Cached profile doesn't match "live" data, so agent needs to be updated
              // with a call to Auth0
              stubUserRead((err, apiScopes) => {
                if (err) return done.fail();

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
        });

        it('allows removal from Auth0', done => {
          rootSession
            .delete(`/team/${rootTeamId}`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.message).toEqual('Team deleted');
              done();
            });
        });

        describe('Auth0', () => {
          it('calls /oauth/token endpoint to retrieve a machine-to-machine access token', done => {
            rootSession
              .delete(`/team/${rootTeamId}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);
                expect(oauthTokenScope.isDone()).toBe(true);
                done();
              });
          });

          it('is called to retrieve the agent user_metadata', done => {
            rootSession
              .delete(`/team/${rootTeamId}`)
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

          it('is called to update the agent', done => {
            rootSession
              .delete(`/team/${rootTeamId}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);

                expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(true);
                expect(userAppMetadataUpdateScope.isDone()).toBe(true);
                done();
              });
          });
        });
      });

      describe('another agent\'s team', () => {

        const teamLeaderProfile = {..._profile, name: 'Some Other Guy', email: 'someotherguy@example.com', user_id: _profile.user_id + 1 };

        let nonRootTeamId;
        beforeEach(done => {
          nonRootTeamId = uuid.v4();

          teamLeaderProfile.user_metadata = {
            teams: [{ name: 'Philadelphia Wings', leader: 'someotherguy@example.com', id: nonRootTeamId }]
          };

          stubAuth0ManagementApi((err, apiScopes) => {
            if (err) return done.fail();

            login({..._identity, email: process.env.ROOT_AGENT, name: 'Professor Fresh'}, [scope.delete.teams], (err, session) => {
              if (err) return done.fail(err);
              rootSession = session;

              // Cached profile doesn't match "live" data, so agent needs to be updated
              // with a call to Auth0
              stubUserRead((err, apiScopes) => {
                if (err) return done.fail();

                stubUserAppMetadataRead((err, apiScopes) => {
                  if (err) return done.fail();
                  ({userAppMetadataReadScope, userAppMetadataReadOauthTokenScope} = apiScopes);

                  stubTeamRead([teamLeaderProfile], (err, apiScopes) => {
                    if (err) return done.fail();
                    ({teamReadScope, teamReadOauthTokenScope} = apiScopes);

                    stubUserAppMetadataUpdate(teamLeaderProfile, (err, apiScopes) => {
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

        it('allows removal of another team of which root is neither leader nor member', done => {
          rootSession
            .delete(`/team/${nonRootTeamId}`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.message).toEqual('Team deleted');
              done();
            });
        });

        // 2020-6-3
        // Seems like a strange test, but the potential problem was revealed
        // while developing super-agent team CRUD functionality. Once upon a
        // time, the call to update the deletion was always called on the
        // authenticated agent. This simply ensures that is no longer the case.
        it('does not touch the super agent\'s user_metadata', done => {
          expect(teamLeaderProfile.user_metadata.teams.length).toEqual(1);
          expect(_profile.user_metadata).toBeUndefined();
          rootSession
            .delete(`/team/${nonRootTeamId}`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(teamLeaderProfile.user_metadata.teams.length).toEqual(0);
              expect(_profile.user_metadata).toBeUndefined();
              done();
            });
        });

        describe('Auth0', () => {
          it('is called to retrieve a team\'s member agent user_metadata', done => {
            rootSession
              .delete(`/team/${nonRootTeamId}`)
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

          it('is called to update the agent', done => {
            rootSession
              .delete(`/team/${nonRootTeamId}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);

                expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(true);
                expect(userAppMetadataUpdateScope.isDone()).toBe(true);
                done();
              });
          });
        });

        it('doesn\'t barf if team doesn\'t exist', done => {
          rootSession
            .delete('/team/333')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(404)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.message).toEqual('No such team');
              done();
            });
        });
      });
    });
  });

//  describe('non-root', () => {
//    let nonRootSession;
//    beforeEach(done => {
//      login({ ..._identity, email: agent.email }, [scope.read.teams], (err, session) => {
//        if (err) return done.fail(err);
//        nonRootSession = session;
//
//        stubAuth0ManagementApi((err, apiScopes) => {
//          if (err) return done.fail();
//          done();
//        });
//      });
//    });
//
//    describe('read', () => {
//      describe('/team', () => {
//        it('returns only the teams created by the requesting agent', done => {
//          models.Team.create({ name: 'The Mike Tyson Mystery Team', organizationId: organization.id, creatorId: root.id }).then(o => {
//            models.Team.findAll().then(results => {
//              expect(results.length).toEqual(2);
//              nonRootSession
//                .get(`/team`)
//                .set('Accept', 'application/json')
//                .expect('Content-Type', /json/)
//                .expect(200)
//                .end(function(err, res) {
//                  if (err) return done.fail(err);
//                  expect(res.body.length).toEqual(1);
//                  done();
//                });
//            }).catch(err => {
//              done.fail(err);
//            });
//          }).catch(err => {
//            done.fail(err);
//          });
//        });
//      });
//    });
//  });
});
