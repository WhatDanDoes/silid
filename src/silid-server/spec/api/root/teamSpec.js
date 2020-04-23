const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001;
const app = require('../../../app');
const fixtures = require('sequelize-fixtures');
const uuid = require('uuid');
const models = require('../../../models');
const request = require('supertest');
const stubAuth0Sessions = require('../../support/stubAuth0Sessions');
const stubAuth0ManagementApi = require('../../support/stubAuth0ManagementApi');
const stubAuth0ManagementEndpoint = require('../../support/stubAuth0ManagementEndpoint');
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

  afterEach(() => {
    // Through the magic of node I am able to adjust the profile data returned.
    // This resets the default values
    _profile.email_verified = true;
    delete _profile.user_metadata;
  });

  let agent;
  beforeEach(done => {
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

    let rootSession, teamId, userReadScope, teamReadScope, oauthTokenScope;
    describe('read', () => {

      describe('/team', () => {
        beforeEach(done => {
          teamId = uuid.v4();

          _profile.user_metadata = { teams: [{ name: 'The Calgary Roughnecks', leader: _profile.email, members: [_profile.email], id: teamId }] };
          stubAuth0ManagementApi((err, apiScopes) => {
            if (err) return done.fail();

            login({..._identity, email: process.env.ROOT_AGENT, name: 'Professor Fresh'}, [scope.create.teams], (err, session) => {

              if (err) return done.fail(err);
              rootSession = session;

              stubAuth0ManagementEndpoint([apiScope.read.users, apiScope.read.usersAppMetadata], (err, apiScopes) => {
                if (err) return done.fail();

                ({userReadScope, teamReadScope, oauthTokenScope} = apiScopes);
                done();
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
                expect(oauthTokenScope.isDone()).toBe(true);
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

                expect(userReadScope.isDone()).toBe(true);
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

              stubAuth0ManagementEndpoint([apiScope.read.usersAppMetadata], (err, apiScopes) => {
                if (err) return done.fail();

                ({userReadScope, teamReadScope, oauthTokenScope} = apiScopes);
                done();
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
              expect(res.body.members).toEqual([{ name: _profile.name, email: _profile.email, user_id: _profile.user_id }]);

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
                expect(oauthTokenScope.isDone()).toBe(true);
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

              stubAuth0ManagementEndpoint([apiScope.update.users, apiScope.read.usersAppMetadata, apiScope.update.usersAppMetadata], (err, apiScopes) => {
                if (err) return done.fail();

                ({userReadScope, updateTeamScope, oauthTokenScope} = apiScopes);
                done();
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
          it('calls /oauth/token endpoint to retrieve a machine-to-machine access token', done => {
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
                expect(oauthTokenScope.isDone()).toBe(true);
                done();
              });
          });

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

                expect(userReadScope.isDone()).toBe(true);
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

                expect(updateTeamScope.isDone()).toBe(true);
                done();
              });
          });
        });
      });

      describe('unsuccessfully', () =>{
        beforeEach(done => {
          // Witness node module caching magic
          _profile.user_metadata = { teams: [ {name: 'The Calgary Roughnecks', leader: _profile.email, members: [_profile.email] } ] };

          stubAuth0ManagementApi((err, apiScopes) => {
            if (err) return done.fail();

            login({..._identity, email: process.env.ROOT_AGENT, name: 'Professor Fresh'}, [scope.create.teams], (err, session) => {

              if (err) return done.fail(err);
              rootSession = session;

              stubAuth0ManagementEndpoint([apiScope.update.users, apiScope.read.usersAppMetadata, apiScope.update.usersAppMetadata], (err, apiScopes) => {
                if (err) return done.fail();

                ({userReadScope, updateTeamScope, oauthTokenScope} = apiScopes);
                done();
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
            it('calls the /oauth/token endpoint to retrieve a machine-to-machine access token', done => {
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
                  expect(oauthTokenScope.isDone()).toBe(true);
                  done();
                });
            });

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

                  expect(userReadScope.isDone()).toBe(true);
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

                  expect(updateTeamScope.isDone()).toBe(false);
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
      let teamId;
      beforeEach(done => {
        teamId = uuid.v4();
        _profile.user_metadata = { teams: [{ name: 'Vancouver Warriors', leader: process.env.ROOT_AGENT, members: [process.env.ROOT_AGENT], id: teamId }] };
        _profile.user_metadata.teams.push({ name: 'Georgia Swarm', leader: 'someotherguy@example.com',
                                            members: ['someotherguy@example.com', _profile.email], id: uuid.v4() });

        stubAuth0ManagementApi((err, apiScopes) => {
          if (err) return done.fail();

          login({..._identity, email: process.env.ROOT_AGENT, name: 'Professor Fresh'}, [scope.update.teams], (err, session) => {

            if (err) return done.fail(err);
            rootSession = session;

            stubAuth0ManagementEndpoint([apiScope.read.users, apiScope.read.usersAppMetadata, apiScope.update.usersAppMetadata], (err, apiScopes) => {
              if (err) return done.fail();

              ({teamReadScope, updateTeamScope, oauthTokenScope} = apiScopes);
              done();
            });
          });
        });
      });

      it('allows root as team creator to update his own record in the database', done => {
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

            expect(res.body.message).toEqual('Team updated');
            expect(res.body.agent.user_metadata.teams[0].name).toEqual('Vancouver Riot');

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

//      describe('PUT', () => {
//        it('allows updates to an existing team in the database', done => {
//          rootSession
//            .put('/team')
//            .send({
//              id: team.id,
//              name: 'Tsuutina Mark Translation'
//            })
//            .set('Accept', 'application/json')
//            .expect('Content-Type', /json/)
//            .expect(201)
//            .end(function(err, res) {
//              if (err) return done.fail(err);
//              expect(res.body.name).toEqual('Tsuutina Mark Translation');
//
//              models.Team.findOne({ where: { id: team.id }}).then(results => {
//                expect(results.name).toEqual('Tsuutina Mark Translation');
//                done();
//              }).catch(err => {
//                done.fail(err);
//              });
//            });
//        });
//
//        it('doesn\'t barf if team doesn\'t exist', done => {
//          rootSession
//            .put('/team')
//            .send({
//              id: 111,
//              name: 'Tsuutina Mark Translation'
//            })
//            .set('Accept', 'application/json')
//            .expect('Content-Type', /json/)
//            .expect(200)
//            .end(function(err, res) {
//              if (err) return done.fail(err);
//              expect(res.body.message).toEqual('No such team');
//              done();
//            });
//        });
//      });
//
//      /**
//       * The idempotent PUT is best used to change the properties of the team.
//       * PATCH is used to modify associations (i.e., memberships and teams).
//       */
//      describe('PATCH', () => {
//        let anotherAgent;
//        beforeEach(done => {
//          models.Agent.create({ name: 'Some Other Guy', email: 'someotherguy@example.com' }).then(result => {
//            anotherAgent = result;
//            done();
//          }).catch(err => {
//            done.fail(err);
//          });
//        });
//
//        afterEach(() => {
//          mailer.transport.sentMail = [];
//        });
//
//        describe('agent membership', () => {
//          describe('updated via ID', () => {
//            it('adds a member agent when agent provided isn\'t currently a member', done => {
//              rootSession
//                .patch('/team')
//                .send({
//                  id: team.id,
//                  memberId: anotherAgent.id
//                })
//                .set('Accept', 'application/json')
//                .expect('Content-Type', /json/)
//                .expect(201)
//                .end(function(err, res) {
//                  if (err) return done.fail(err);
//                  expect(res.body.message).toEqual('Update successful');
//
//                  models.Team.findOne({ where: { id: team.id }, include: ['members'] }).then(results => {
//                    expect(results.members.length).toEqual(2);
//                    expect(results.members.find(m => m.name === anotherAgent.name)).toBeDefined();
//                    expect(results.members.find(m => m.email === anotherAgent.email)).toBeDefined();
//                    done();
//                  }).catch(err => {
//                    done.fail(err);
//                  });
//                });
//            });
//
//            it('sends an email to notify agent of new membership', function(done) {
//              expect(mailer.transport.sentMail.length).toEqual(0);
//              rootSession
//                .patch('/team')
//                .send({
//                  id: team.id,
//                  memberId: anotherAgent.id
//                })
//                .set('Accept', 'application/json')
//                .expect('Content-Type', /json/)
//                .expect(201)
//                .end(function(err, res) {
//                  if (err) return done.fail(err);
//                  expect(mailer.transport.sentMail.length).toEqual(1);
//                  expect(mailer.transport.sentMail[0].data.to).toEqual(anotherAgent.email);
//                  expect(mailer.transport.sentMail[0].data.from).toEqual(process.env.NOREPLY_EMAIL);
//                  expect(mailer.transport.sentMail[0].data.subject).toEqual('Identity membership update');
//                  expect(mailer.transport.sentMail[0].data.text).toContain(`You are now a member of ${team.name}`);
//                  done();
//                });
//            });
//
//            it('removes a member agent when agent provided is currently a member', done => {
//              team.addMember(anotherAgent).then(result => {
//                rootSession
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
//                    models.Team.findOne({ where: { id: team.id }, include: ['members']}).then(results => {
//                      expect(results.members.length).toEqual(1);
//                      expect(results.members[0].name).toEqual(agent.name);
//                      expect(results.members[0].email).toEqual(agent.email);
//                      done();
//                    }).catch(err => {
//                      done.fail(err);
//                    });
//                  });
//              }).catch(err => {
//                done.fail(err);
//              });
//            });
//
//            it('sends an email to notify agent of membership revocation', function(done) {
//              expect(mailer.transport.sentMail.length).toEqual(0);
//              team.addMember(anotherAgent).then(result => {
//                rootSession
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
//                    expect(mailer.transport.sentMail[0].data.text).toContain(`You are no longer a member of ${team.name}`);
//                    done();
//                  });
//              }).catch(err => {
//                done.fail(err);
//              });
//            });
//
//            it('doesn\'t barf if member agent doesn\'t exist', done => {
//              rootSession
//                .patch('/team')
//                .send({
//                  id: team.id,
//                  memberId: 333
//                })
//                .set('Accept', 'application/json')
//                .expect('Content-Type', /json/)
//                .expect(404)
//                .end(function(err, res) {
//                  if (err) return done.fail(err);
//                  expect(res.body.message).toEqual('No such agent');
//                  done();
//                });
//            });
//
//            it('doesn\'t send an email if member agent doesn\'t exist', done => {
//              expect(mailer.transport.sentMail.length).toEqual(0);
//              rootSession
//                .patch('/team')
//                .send({
//                  id: team.id,
//                  memberId: 333
//                })
//                .set('Accept', 'application/json')
//                .expect('Content-Type', /json/)
//                .expect(404)
//                .end(function(err, res) {
//                  if (err) return done.fail(err);
//                  expect(mailer.transport.sentMail.length).toEqual(0);
//                  done();
//                });
//            });
//
//            it('doesn\'t barf if team doesn\'t exist', done => {
//              rootSession
//                .patch('/team')
//                .send({
//                  id: 111,
//                  memberId: anotherAgent.id
//                })
//                .set('Accept', 'application/json')
//                .expect('Content-Type', /json/)
//                .expect(404)
//                .end(function(err, res) {
//                  if (err) return done.fail(err);
//                  expect(res.body.message).toEqual('No such team');
//                  done();
//                });
//            });
//
//            it('doesn\'t send an email if team doesn\'t exist', done => {
//              expect(mailer.transport.sentMail.length).toEqual(0);
//              rootSession
//                .patch('/team')
//                .send({
//                  id: 111,
//                  memberId: anotherAgent.id
//                })
//                .set('Accept', 'application/json')
//                .expect('Content-Type', /json/)
//                .expect(404)
//                .end(function(err, res) {
//                  if (err) return done.fail(err);
//                  expect(mailer.transport.sentMail.length).toEqual(0);
//                  done();
//                });
//            });
//          });
//
//          describe('updated via email', () => {
//            it('adds a member agent when agent provided isn\'t currently a member', done => {
//              rootSession
//                .patch('/team')
//                .send({
//                  id: team.id,
//                  email: anotherAgent.email
//                })
//                .set('Accept', 'application/json')
//                .expect('Content-Type', /json/)
//                .expect(201)
//                .end(function(err, res) {
//                  if (err) return done.fail(err);
//                  expect(res.body.message).toEqual('Update successful');
//
//                  models.Team.findOne({ where: { id: team.id }, include: ['members'] }).then(results => {
//                    expect(results.members.length).toEqual(2);
//                    expect(results.members.find(m => m.name === anotherAgent.name)).toBeDefined();
//                    expect(results.members.find(m => m.email === anotherAgent.email)).toBeDefined();
//                    done();
//                  }).catch(err => {
//                    done.fail(err);
//                  });
//                });
//            });
//
//            it('sends an email to notify agent of new membership', function(done) {
//              expect(mailer.transport.sentMail.length).toEqual(0);
//              rootSession
//                .patch('/team')
//                .send({
//                  id: team.id,
//                  email: anotherAgent.email
//                })
//                .set('Accept', 'application/json')
//                .expect('Content-Type', /json/)
//                .expect(201)
//                .end(function(err, res) {
//                  if (err) return done.fail(err);
//                  expect(mailer.transport.sentMail.length).toEqual(1);
//                  expect(mailer.transport.sentMail[0].data.to).toEqual(anotherAgent.email);
//                  expect(mailer.transport.sentMail[0].data.from).toEqual(process.env.NOREPLY_EMAIL);
//                  expect(mailer.transport.sentMail[0].data.subject).toEqual('Identity membership update');
//                  expect(mailer.transport.sentMail[0].data.text).toContain(`You are now a member of ${team.name}`);
//                  done();
//                });
//            });
//
//            it('removes a member agent when agent provided is currently a member', done => {
//              team.addMember(anotherAgent).then(result => {
//                rootSession
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
//                    models.Team.findOne({ where: { id: team.id }, include: ['members']}).then(results => {
//                      expect(results.members.length).toEqual(1);
//                      expect(results.members[0].name).toEqual(agent.name);
//                      expect(results.members[0].email).toEqual(agent.email);
//                      done();
//                    }).catch(err => {
//                      done.fail(err);
//                    });
//                  });
//              }).catch(err => {
//                done.fail(err);
//              });
//            });
//
//            it('sends an email to notify agent of membership revocation', function(done) {
//              expect(mailer.transport.sentMail.length).toEqual(0);
//              team.addMember(anotherAgent).then(result => {
//                rootSession
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
//                    expect(mailer.transport.sentMail[0].data.text).toContain(`You are no longer a member of ${team.name}`);
//                    done();
//                  });
//              }).catch(err => {
//                done.fail(err);
//              });
//            });
//
//            it('adds record if member agent doesn\'t exist', done => {
//              rootSession
//                .patch('/team')
//                .send({
//                  id: team.id,
//                  email: 'someunknownagent@example.com'
//                })
//                .set('Accept', 'application/json')
//                .expect('Content-Type', /json/)
//                .expect(201)
//                .end(function(err, res) {
//                  if (err) return done.fail(err);
//                  expect(res.body.message).toEqual('Update successful');
//
//                  models.Agent.findOne({ where: { email: 'someunknownagent@example.com' } }).then(unknownAgent => {
//                    expect(unknownAgent.name).toBe(null);
//                    expect(unknownAgent.email).toEqual('someunknownagent@example.com');
//
//                    models.Team.findOne({ where: { id: team.id }, include: ['members']}).then(results => {
//                      expect(results.members.length).toEqual(2);
//                      expect(results.members[1].name).toEqual(unknownAgent.name);
//                      expect(results.members[1].email).toEqual(unknownAgent.email);
//                      done();
//                    }).catch(err => {
//                      done.fail(err);
//                    });
//                  }).catch(err => {
//                    done.fail(err);
//                  });
//                });
//            });
//
//            it('sends an email if member agent doesn\'t exist', done => {
//              expect(mailer.transport.sentMail.length).toEqual(0);
//              rootSession
//                .patch('/team')
//                .send({
//                  id: team.id,
//                  email: 'someunknownagent@example.com'
//                })
//                .set('Accept', 'application/json')
//                .expect('Content-Type', /json/)
//                .expect(201)
//                .end(function(err, res) {
//                  if (err) return done.fail(err);
//                  expect(mailer.transport.sentMail.length).toEqual(1);
//                  expect(mailer.transport.sentMail[0].data.to).toEqual('someunknownagent@example.com');
//                  expect(mailer.transport.sentMail[0].data.from).toEqual(process.env.NOREPLY_EMAIL);
//                  expect(mailer.transport.sentMail[0].data.subject).toEqual('Identity membership update');
//                  expect(mailer.transport.sentMail[0].data.text).toContain(`You are now a member of ${team.name}`);
//                  done();
//                });
//            });
//
//            it('doesn\'t barf if team doesn\'t exist', done => {
//              rootSession
//                .patch('/team')
//                .send({
//                  id: 111,
//                  email: anotherAgent.email
//                })
//                .set('Accept', 'application/json')
//                .expect('Content-Type', /json/)
//                .expect(404)
//                .end(function(err, res) {
//                  if (err) return done.fail(err);
//                  expect(res.body.message).toEqual('No such team');
//                  done();
//                });
//            });
//          });
//        });
//      });
    });

    describe('delete', () => {

      let rootTeamId, nonRootTeamId;
      beforeEach(done => {
        rootTeamId = uuid.v4();
        nonRootTeamId = uuid.v4();

        _profile.user_metadata = { teams: [{ name: 'Saskatchewan Rush', leader: process.env.ROOT_AGENT, members: [process.env.ROOT_AGENT], id: rootTeamId }] };
        // This is completely contrived for test purposes. Real-world metadata
        // look or behave like this. (Notice `root` is not a team leader or member)
        _profile.user_metadata.teams.push({ name: 'Philadelphia Wings', leader: 'someotherguy@example.com',
                                            members: ['someotherguy@example.com', _profile.email], id: nonRootTeamId });

        stubAuth0ManagementApi((err, apiScopes) => {
          if (err) return done.fail();

          login({..._identity, email: process.env.ROOT_AGENT, name: 'Professor Fresh'}, [scope.delete.teams], (err, session) => {

            if (err) return done.fail(err);
            rootSession = session;

            stubAuth0ManagementEndpoint([apiScope.read.users, apiScope.read.usersAppMetadata, apiScope.update.usersAppMetadata], (err, apiScopes) => {
              if (err) return done.fail();

              ({teamReadScope, updateTeamScope, oauthTokenScope} = apiScopes);
              done();
            });
          });
        });
      });

      describe('one of root\'s own teams', () => {
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

                expect(updateTeamScope.isDone()).toBe(true);
                done();
              });
          });
        });
      });

      describe('another agent\'s team', () => {
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

        describe('Auth0', () => {
          it('calls /oauth/token endpoint to retrieve a machine-to-machine access token', done => {
            rootSession
              .delete(`/team/${nonRootTeamId}`)
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
              .delete(`/team/${nonRootTeamId}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);

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

                expect(updateTeamScope.isDone()).toBe(true);
                done();
              });
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
