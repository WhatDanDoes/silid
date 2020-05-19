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
const stubTeamRead = require('../support/auth0Endpoints/stubTeamRead');
const mailer = require('../../mailer');
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

                // Cached profile doesn't match "live" data, so agent needs to be updated
                // with a call to Auth0
                stubUserRead((err, apiScopes) => {
                  if (err) return done.fail();

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
              .end(function(err, res) {
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
                .end(function(err, res) {
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

              login(_identity, [scope.create.teams], (err, session) => {

                if (err) return done.fail(err);
                authenticatedSession = session;

                // Cached profile doesn't match "live" data, so agent needs to be updated
                // with a call to Auth0
                stubUserRead((err, apiScopes) => {
                  if (err) return done.fail();

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
                .end(function(err, res) {
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
                  .end(function(err, res) {
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
            authenticatedSession
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
            authenticatedSession
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

      describe('read', () => {

        describe('GET /team/:id', () => {
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
            authenticatedSession
              .get(`/team/${teamId}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) return done.fail(err);
                expect(res.body.name).toEqual('The Calgary Roughnecks');
                expect(res.body.leader).toEqual(_profile.email);
                expect(res.body.id).toEqual(teamId);
                expect(res.body.members).toEqual([{ name: _profile.name, email: _profile.email, user_id: _profile.user_id }]);

                done();
              });
          });

          it('doesn\'t barf if record doesn\'t exist', done => {
            authenticatedSession
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
            it('calls /oauth/token endpoint to retrieve a machine-to-machine access token', done => {
              authenticatedSession
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

            it('calls Auth0 to retrieve the team data', done => {
              authenticatedSession
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

                // Cached profile doesn't match "live" data, so agent needs to be updated
                // with a call to Auth0
                stubUserRead((err, apiScopes) => {
                  if (err) return done.fail();

                  stubUserAppMetadataRead((err, apiScopes) => {
                    if (err) return done.fail();
                    ({userAppMetadataReadScope, userAppMetadataReadOauthTokenScope} = apiScopes);

                    done();
                  });
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
              .end(function(err, res) {
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
                .end(function(err, res) {
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
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  expect(userAppMetadataReadScope.isDone()).toBe(true);
                  done();
                });
            });
          });
        });
      });

      describe('update', () => {
        let teamId;
        beforeEach(done => {
          teamId = uuid.v4();
          _profile.user_metadata = { teams: [{ name: 'Vancouver Warriors', leader: _profile.email, id: teamId }] };
          _profile.user_metadata.teams.push({ name: 'Georgia Swarm', leader: _profile.email, id: uuid.v4() });

          stubAuth0ManagementApi((err, apiScopes) => {
            if (err) return done.fail();

            login(_identity, [scope.update.teams], (err, session) => {

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

        it('allows a team creator to update an existing agent record', done => {
          authenticatedSession
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

        it('returns an error if empty team name provided', done => {
          authenticatedSession
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
          authenticatedSession
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
          authenticatedSession
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
          it('is called to retrieve the agent user_metadata', done => {
            authenticatedSession
              .put(`/team/${teamId}`)
              .send({
                name: 'Vancouver Riot'
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

          it('is called to update the agent user_metadata', done => {
            authenticatedSession
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

//        describe('PUT', () => {
//          it('allows an organization creator to update an existing team in the database', done => {
//            organization.getCreator().then(creator => {
//              expect(creator.email).toEqual(agent.email);
//              expect(team.organizationId).toEqual(organization.id);
//
//              login({ ..._identity, email: creator.email, name: 'Some Org Creator' }, [scope.update.teams], (err, session) => {
//                if (err) return done.fail(err);
//
//                session
//                  .put('/team')
//                  .send({
//                    id: team.id,
//                    name: 'Tsuutina Mark Translation'
//                  })
//                  .set('Accept', 'application/json')
//                  .expect('Content-Type', /json/)
//                  .expect(201)
//                  .end(function(err, res) {
//                    if (err) return done.fail(err);
//                    expect(res.body.name).toEqual('Tsuutina Mark Translation');
//
//                    models.Team.findOne({ where: { id: team.id }}).then(results => {
//                      expect(results.name).toEqual('Tsuutina Mark Translation');
//                      done();
//                    }).catch(err => {
//                      done.fail(err);
//                    });
//                  });
//              });
//            }).catch(err => {
//              done.fail(err);
//            });
//          });
//
//          it('allows a team creator to update an existing record in the database', done => {
//            let teamMember = new models.Agent({ email: 'member-agent@example.com' });
//            teamMember.save().then(results => {
//              teamMember.createTeam({ name: 'Omega Team',
//                                      organizationId: organization.id,
//                                      creatorId: teamMember.id }).then(team => {
//                login({ ..._identity, email: teamMember.email, name: 'Some Team Creator' }, [scope.update.teams], (err, session) => {
//                  if (err) return done.fail(err);
//
//                  session
//                    .put('/team')
//                    .send({
//                      id: team.id,
//                      name: 'Tsuutina Mark Translation'
//                    })
//                    .set('Accept', 'application/json')
//                    .expect('Content-Type', /json/)
//                    .expect(201)
//                    .end(function(err, res) {
//                      if (err) return done.fail(err);
//                      expect(res.body.name).toEqual('Tsuutina Mark Translation');
//
//                      models.Team.findOne({ where: { id: team.id }}).then(results => {
//                        expect(results.name).toEqual('Tsuutina Mark Translation');
//                        done();
//                      }).catch(err => {
//                        done.fail(err);
//                      });
//                    });
//                });
//              }).catch(err => {
//                done.fail(err);
//              });
//            }).catch(err => {
//              done.fail(err);
//            });
//          });
//
//          it('doesn\'t barf if team doesn\'t exist', done => {
//            authenticatedSession
//              .put('/team')
//              .send({
//                id: 111,
//                name: 'Tsuutina Mark Translation'
//              })
//              .set('Accept', 'application/json')
//              .expect('Content-Type', /json/)
//              .expect(200)
//              .end(function(err, res) {
//                if (err) return done.fail(err);
//                expect(res.body.message).toEqual('No such team');
//                done();
//              });
//          });
//        });
//
//        /**
//         * The idempotent PUT is best used to change the properties of the team.
//         * PATCH is used to modify associations (i.e., memberships and teams).
//         */
//        describe('PATCH', () => {
//          let anotherAgent;
//          beforeEach(done => {
//            models.Agent.create({ name: 'Some Other Guy', email: 'someotherguy@example.com' }).then(result => {
//              anotherAgent = result;
//              done();
//            }).catch(err => {
//              done.fail(err);
//            });
//          });
//
//          afterEach(() => {
//            mailer.transport.sentMail = [];
//          });
//
//          describe('agent membership', () => {
//            describe('updated via ID', () => {
//              it('adds a member agent when agent provided isn\'t currently a member', done => {
//                authenticatedSession
//                  .patch('/team')
//                  .send({
//                    id: team.id,
//                    memberId: anotherAgent.id
//                  })
//                  .set('Accept', 'application/json')
//                  .expect('Content-Type', /json/)
//                  .expect(201)
//                  .end(function(err, res) {
//                    if (err) return done.fail(err);
//                    expect(res.body.message).toEqual('Update successful');
//
//                    models.Team.findOne({ where: { id: team.id }, include: ['members'] }).then(results => {
//                      expect(results.members.length).toEqual(2);
//                      expect(results.members[0].name).toEqual(anotherAgent.name);
//                      expect(results.members[0].email).toEqual(anotherAgent.email);
//                      done();
//                    }).catch(err => {
//                      done.fail(err);
//                    });
//                  });
//              });
//
//              it('sends an email to notify agent of new membership', function(done) {
//                expect(mailer.transport.sentMail.length).toEqual(0);
//                authenticatedSession
//                  .patch('/team')
//                  .send({
//                    id: team.id,
//                    memberId: anotherAgent.id
//                  })
//                  .set('Accept', 'application/json')
//                  .expect('Content-Type', /json/)
//                  .expect(201)
//                  .end(function(err, res) {
//                    if (err) return done.fail(err);
//                    expect(mailer.transport.sentMail.length).toEqual(1);
//                    expect(mailer.transport.sentMail[0].data.to).toEqual(anotherAgent.email);
//                    expect(mailer.transport.sentMail[0].data.from).toEqual(process.env.NOREPLY_EMAIL);
//                    expect(mailer.transport.sentMail[0].data.subject).toEqual('Identity membership update');
//                    expect(mailer.transport.sentMail[0].data.text).toContain(`You are now a member of ${team.name}`);
//                    done();
//                  });
//              });
//
//              it('removes a member agent when agent provided is currently a member', done => {
//                team.addMember(anotherAgent).then(result => {
//                  authenticatedSession
//                    .patch('/team')
//                    .send({
//                      id: team.id,
//                      memberId: anotherAgent.id
//                    })
//                    .set('Accept', 'application/json')
//                    .expect('Content-Type', /json/)
//                    .expect(201)
//                    .end(function(err, res) {
//                      if (err) return done.fail(err);
//                      expect(res.body.message).toEqual('Update successful');
//
//                      models.Team.findOne({ where: { id: team.id }, include: ['members']}).then(results => {
//                        expect(results.members.length).toEqual(1);
//                        expect(results.members[0].name).toEqual(agent.name);
//                        expect(results.members[0].email).toEqual(agent.email);
//                        done();
//                      }).catch(err => {
//                        done.fail(err);
//                      });
//                    });
//                }).catch(err => {
//                  done.fail(err);
//                });
//              });
//
//              it('sends an email to notify agent of membership revocation', function(done) {
//                expect(mailer.transport.sentMail.length).toEqual(0);
//                team.addMember(anotherAgent).then(result => {
//                  authenticatedSession
//                    .patch('/team')
//                    .send({
//                      id: team.id,
//                      memberId: anotherAgent.id
//                    })
//                    .set('Accept', 'application/json')
//                    .expect('Content-Type', /json/)
//                    .expect(201)
//                    .end(function(err, res) {
//                      if (err) return done.fail(err);
//                      expect(mailer.transport.sentMail.length).toEqual(1);
//                      expect(mailer.transport.sentMail[0].data.to).toEqual(anotherAgent.email);
//                      expect(mailer.transport.sentMail[0].data.from).toEqual(process.env.NOREPLY_EMAIL);
//                      expect(mailer.transport.sentMail[0].data.subject).toEqual('Identity membership update');
//                      expect(mailer.transport.sentMail[0].data.text).toContain(`You are no longer a member of ${team.name}`);
//                      done();
//                    });
//                }).catch(err => {
//                  done.fail(err);
//                });
//              });
//
//              it('doesn\'t barf if member agent doesn\'t exist', done => {
//                authenticatedSession
//                  .patch('/team')
//                  .send({
//                    id: team.id,
//                    memberId: 333
//                  })
//                  .set('Accept', 'application/json')
//                  .expect('Content-Type', /json/)
//                  .expect(404)
//                  .end(function(err, res) {
//                    if (err) return done.fail(err);
//                    expect(res.body.message).toEqual('No such agent');
//                    done();
//                  });
//              });
//
//              it('doesn\'t send an email if member agent doesn\'t exist', done => {
//                expect(mailer.transport.sentMail.length).toEqual(0);
//                authenticatedSession
//                  .patch('/team')
//                  .send({
//                    id: team.id,
//                    memberId: 333
//                  })
//                  .set('Accept', 'application/json')
//                  .expect('Content-Type', /json/)
//                  .expect(404)
//                  .end(function(err, res) {
//                    if (err) return done.fail(err);
//                    expect(mailer.transport.sentMail.length).toEqual(0);
//                    done();
//                  });
//              });
//
//              it('doesn\'t barf if team doesn\'t exist', done => {
//                authenticatedSession
//                  .patch('/team')
//                  .send({
//                    id: 111,
//                    memberId: anotherAgent.id
//                  })
//                  .set('Accept', 'application/json')
//                  .expect('Content-Type', /json/)
//                  .expect(404)
//                  .end(function(err, res) {
//                    if (err) return done.fail(err);
//                    expect(res.body.message).toEqual('No such team');
//                    done();
//                  });
//              });
//
//              it('doesn\'t send an email if team doesn\'t exist', done => {
//                expect(mailer.transport.sentMail.length).toEqual(0);
//                authenticatedSession
//                  .patch('/team')
//                  .send({
//                    id: 111,
//                    memberId: anotherAgent.id
//                  })
//                  .set('Accept', 'application/json')
//                  .expect('Content-Type', /json/)
//                  .expect(404)
//                  .end(function(err, res) {
//                    if (err) return done.fail(err);
//                    expect(mailer.transport.sentMail.length).toEqual(0);
//                    done();
//                  });
//              });
//
//              it('doesn\'t allow a non-member agent to add a member', done => {
//                login({ ..._identity, email: anotherAgent.email, name: 'Another Guy' }, [scope.update.teams], (err, session) => {
//                  session
//                    .patch('/team')
//                    .send({
//                      id: team.id,
//                      memberId: anotherAgent.id
//                    })
//                    .set('Accept', 'application/json')
//                    .expect('Content-Type', /json/)
//                    .expect(403)
//                    .end(function(err, res) {
//                      if (err) return done.fail(err);
//                      expect(res.body.message).toEqual('You are not a member of this team');
//                      done();
//                    });
//                });
//              });
//            });
//
//            describe('updated via email', () => {
//              it('adds a member agent when agent provided isn\'t currently a member', done => {
//                authenticatedSession
//                  .patch('/team')
//                  .send({
//                    id: team.id,
//                    email: anotherAgent.email
//                  })
//                  .set('Accept', 'application/json')
//                  .expect('Content-Type', /json/)
//                  .expect(201)
//                  .end(function(err, res) {
//                    if (err) return done.fail(err);
//                    expect(res.body.message).toEqual('Update successful');
//
//                    models.Team.findOne({ where: { id: team.id }, include: ['members'] }).then(results => {
//                      expect(results.members.length).toEqual(2);
//                      expect(results.members[0].name).toEqual(anotherAgent.name);
//                      expect(results.members[0].email).toEqual(anotherAgent.email);
//                      done();
//                    }).catch(err => {
//                      done.fail(err);
//                    });
//                  });
//              });
//
//              it('sends an email to notify agent of new membership', function(done) {
//                expect(mailer.transport.sentMail.length).toEqual(0);
//                authenticatedSession
//                  .patch('/team')
//                  .send({
//                    id: team.id,
//                    email: anotherAgent.email
//                  })
//                  .set('Accept', 'application/json')
//                  .expect('Content-Type', /json/)
//                  .expect(201)
//                  .end(function(err, res) {
//                    if (err) return done.fail(err);
//                    expect(mailer.transport.sentMail.length).toEqual(1);
//                    expect(mailer.transport.sentMail[0].data.to).toEqual(anotherAgent.email);
//                    expect(mailer.transport.sentMail[0].data.from).toEqual(process.env.NOREPLY_EMAIL);
//                    expect(mailer.transport.sentMail[0].data.subject).toEqual('Identity membership update');
//                    expect(mailer.transport.sentMail[0].data.text).toContain(`You are now a member of ${team.name}`);
//                    done();
//                  });
//              });
//
//              it('removes a member agent when agent provided is currently a member', done => {
//                team.addMember(anotherAgent).then(result => {
//                  authenticatedSession
//                    .patch('/team')
//                    .send({
//                      id: team.id,
//                      email: anotherAgent.email
//                    })
//                    .set('Accept', 'application/json')
//                    .expect('Content-Type', /json/)
//                    .expect(201)
//                    .end(function(err, res) {
//                      if (err) return done.fail(err);
//                      expect(res.body.message).toEqual('Update successful');
//
//                      models.Team.findOne({ where: { id: team.id }, include: ['members']}).then(results => {
//                        expect(results.members.length).toEqual(1);
//                        expect(results.members[0].name).toEqual(agent.name);
//                        expect(results.members[0].email).toEqual(agent.email);
//                        done();
//                      }).catch(err => {
//                        done.fail(err);
//                      });
//                    });
//                }).catch(err => {
//                  done.fail(err);
//                });
//              });
//
//              it('sends an email to notify agent of membership revocation', function(done) {
//                expect(mailer.transport.sentMail.length).toEqual(0);
//                team.addMember(anotherAgent).then(result => {
//                  authenticatedSession
//                    .patch('/team')
//                    .send({
//                      id: team.id,
//                      email: anotherAgent.email
//                    })
//                    .set('Accept', 'application/json')
//                    .expect('Content-Type', /json/)
//                    .expect(201)
//                    .end(function(err, res) {
//                      if (err) return done.fail(err);
//                      expect(mailer.transport.sentMail.length).toEqual(1);
//                      expect(mailer.transport.sentMail[0].data.to).toEqual(anotherAgent.email);
//                      expect(mailer.transport.sentMail[0].data.from).toEqual(process.env.NOREPLY_EMAIL);
//                      expect(mailer.transport.sentMail[0].data.subject).toEqual('Identity membership update');
//                      expect(mailer.transport.sentMail[0].data.text).toContain(`You are no longer a member of ${team.name}`);
//                      done();
//                    });
//                }).catch(err => {
//                  done.fail(err);
//                });
//              });
//
//              it('adds record if member agent doesn\'t exist', done => {
//                authenticatedSession
//                  .patch('/team')
//                  .send({
//                    id: team.id,
//                    email: 'someunknownagent@example.com'
//                  })
//                  .set('Accept', 'application/json')
//                  .expect('Content-Type', /json/)
//                  .expect(201)
//                  .end(function(err, res) {
//                    if (err) return done.fail(err);
//                    expect(res.body.message).toEqual('Update successful');
//
//                    models.Agent.findOne({ where: { email: 'someunknownagent@example.com' } }).then(unknownAgent => {
//                      expect(unknownAgent.name).toBe(null);
//                      expect(unknownAgent.email).toEqual('someunknownagent@example.com');
//
//                      models.Team.findOne({ where: { id: team.id }, include: ['members']}).then(results => {
//                        expect(results.members.length).toEqual(2);
//                        expect(results.members[1].name).toEqual(unknownAgent.name);
//                        expect(results.members[1].email).toEqual(unknownAgent.email);
//                        done();
//                      }).catch(err => {
//                        done.fail(err);
//                      });
//                    }).catch(err => {
//                      done.fail(err);
//                    });
//                  });
//              });
//
//              it('sends an email if member agent doesn\'t exist', done => {
//                expect(mailer.transport.sentMail.length).toEqual(0);
//                authenticatedSession
//                  .patch('/team')
//                  .send({
//                    id: team.id,
//                    email: 'someunknownagent@example.com'
//                  })
//                  .set('Accept', 'application/json')
//                  .expect('Content-Type', /json/)
//                  .expect(201)
//                  .end(function(err, res) {
//                    if (err) return done.fail(err);
//                    expect(mailer.transport.sentMail.length).toEqual(1);
//                    expect(mailer.transport.sentMail[0].data.to).toEqual('someunknownagent@example.com');
//                    expect(mailer.transport.sentMail[0].data.from).toEqual(process.env.NOREPLY_EMAIL);
//                    expect(mailer.transport.sentMail[0].data.subject).toEqual('Identity membership update');
//                    expect(mailer.transport.sentMail[0].data.text).toContain(`You are now a member of ${team.name}`);
//                    done();
//                  });
//              });
//
//              it('doesn\'t barf if team doesn\'t exist', done => {
//                authenticatedSession
//                  .patch('/team')
//                  .send({
//                    id: 111,
//                    email: anotherAgent.email
//                  })
//                  .set('Accept', 'application/json')
//                  .expect('Content-Type', /json/)
//                  .expect(404)
//                  .end(function(err, res) {
//                    if (err) return done.fail(err);
//                    expect(res.body.message).toEqual('No such team');
//                    done();
//                  });
//              });
//
//              it('doesn\'t allow a non-member agent to add a member', done => {
//                login({ ..._identity, email: anotherAgent.email, name: 'Some Other Guy' }, [scope.update.teams], (err, session) => {
//                  if (err) return done.fail(err);
//
//                  session
//                    .patch('/team')
//                    .send({
//                      id: team.id,
//                      email: anotherAgent.email
//                    })
//                    .set('Accept', 'application/json')
//                    .expect('Content-Type', /json/)
//                    .expect(403)
//                    .end(function(err, res) {
//                      if (err) return done.fail(err);
//                      expect(res.body.message).toEqual('You are not a member of this team');
//                      done();
//                    });
//                });
//              });
//            });
//          });
//        });
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
              .end(function(err, res) {
                if (err) return done.fail(err);
                expect(res.body.message).toEqual('Team deleted');
                expect(res.body.agent.user_metadata.teams.length).toEqual(1);
                done();
              });
          });

          it('does not remove the team if it still has member agents', done => {
            // This call just clears the mock so that it can be reset
            authenticatedSession
              .delete(`/team/${teamId}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);

                // Reset team leader data
                _profile.user_metadata.teams.push({ name: 'Saskatchewan Rush', leader: _profile.email, id: teamId });

                // Cached profile doesn't match "live" data, so agent needs to be updated
                // with a call to Auth0
                stubUserRead((err, apiScopes) => {
                  if (err) return done.fail();

                  // Set new return value for team read stub
                  stubTeamRead([{..._profile}, {..._profile, email: 'someotherguy@example.com', name: 'Some Other Guy',
                                                user_metadata: { teams: [{ name: 'Saskatchewan Rush', leader: _profile.email, id: teamId }] }}], (err, apiScopes) => {
                    if (err) return done.fail();

                    authenticatedSession
                      .delete(`/team/${teamId}`)
                      .set('Accept', 'application/json')
                      .expect('Content-Type', /json/)
                      .expect(200)
                      .end(function(err, res) {
                        if (err) return done.fail(err);

                        expect(res.body.message).toEqual('Team still has members. Cannot delete');
                        done();
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
                .end(function(err, res) {
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
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(true);
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
            .end(function(err, res) {
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
            .end(function(err, res) {
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
            .end(function(err, res) {
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
              .end(function(err, res) {
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
              .end(function(err, res) {
                if (err) return done.fail(err);

                expect(userAppMetadataUpdateOauthTokenScope.isDone()).toBe(false);
                expect(userAppMetadataUpdateScope.isDone()).toBe(false);
                done();
              });
          });
        });


//        describe('PUT', () => {
//          it('returns 403', done => {
//            unauthorizedSession
//              .put('/team')
//              .send({
//                id: team.id,
//                name: 'Mark Cree Translation'
//              })
//              .set('Accept', 'application/json')
//              .expect('Content-Type', /json/)
//              .expect(403)
//              .end(function(err, res) {
//                if (err) return done.fail(err);
//                expect(res.body.message).toEqual('Unauthorized');
//                done();
//              });
//          });
//
//          it('does not change the record in the database', done => {
//            unauthorizedSession
//              .put('/team')
//              .send({
//                id: team.id,
//                name: 'Mark Cree Translation'
//              })
//              .set('Accept', 'application/json')
//              .expect('Content-Type', /json/)
//              .expect(403)
//              .end(function(err, res) {
//                if (err) return done.fail(err);
//                models.Team.findOne({ where: { id: team.id }}).then(results => {
//                  expect(results.name).toEqual(team.name);
//                  done();
//                }).catch(err => {
//                  done.fail(err);
//                });
//              });
//          });
//
//          it('does not allow a team member to update an existing record in the database', done => {
//            let memberAgent = new models.Agent({ email: 'member-agent@example.com' });
//            memberAgent.save().then(results => {
//              memberAgent.addTeam(team).then(results => {
//                login({ ..._identity, email: memberAgent.email, name: 'Some Member Guy' }, (err, session) => {
//                  if (err) return done.fail(err);
//
//                  session
//                    .put('/team')
//                    .send({
//                      id: team.id,
//                      name: 'Tsuutina Mark Translation'
//                    })
//                    .set('Accept', 'application/json')
//                    .expect('Content-Type', /json/)
//                    .expect(403)
//                    .end(function(err, res) {
//                      if (err) return done.fail(err);
//                      expect(res.body.message).toEqual('Insufficient scope');
//
//                      models.Team.findOne({ where: { id: team.id }}).then(results => {
//                        expect(results.name).toEqual(team.name);
//                        done();
//                      }).catch(err => {
//                        done.fail(err);
//                      });
//                    });
//                });
//              }).catch(err => {
//                done.fail(err);
//              });
//            }).catch(err => {
//              done.fail(err);
//            });
//          });
//        });
//
//        describe('PATCH', () => {
//          it('returns 403', done => {
//            unauthorizedSession
//              .patch('/team')
//              .send({
//                id: team.id,
//                memberId: 333
//              })
//              .set('Accept', 'application/json')
//              .expect('Content-Type', /json/)
//              .expect(403)
//              .end(function(err, res) {
//                if (err) return done.fail(err);
//                expect(res.body.message).toEqual('You are not a member of this team');
//                done();
//              });
//          });
//
//          it('does not change the record in the database', done => {
//            unauthorizedSession
//              .patch('/team')
//              .send({
//                id: team.id,
//                memberId: 333
//              })
//              .set('Accept', 'application/json')
//              .expect('Content-Type', /json/)
//              .expect(403)
//              .end(function(err, res) {
//                if (err) return done.fail(err);
//                models.Team.findOne({ where: { id: team.id }, include: ['members'] }).then(results => {
//                  expect(results.members.length).toEqual(1);
//                  done();
//                }).catch(err => {
//                  done.fail(err);
//                });
//              });
//          });
//        });
      });

//      describe('read', () => {
//        it('returns 403 on organization show', done => {
//          unauthorizedSession
//            .get(`/team/${team.id}`)
//            .set('Accept', 'application/json')
//            .expect('Content-Type', /json/)
//            .expect(403)
//            .end(function(err, res) {
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
            .end(function(err, res) {
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
              .end(function(err, res) {
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
        .get('/team')
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
