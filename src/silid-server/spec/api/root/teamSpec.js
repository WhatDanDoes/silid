const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001;
const app = require('../../../app');
const fixtures = require('sequelize-fixtures');
const models = require('../../../models');
const request = require('supertest');
const stubAuth0Sessions = require('../../support/stubAuth0Sessions');
const mailer = require('../../../mailer');
const scope = require('../../../config/permissions');

/**
 * 2019-11-13
 * Sample tokens taken from:
 *
 * https://auth0.com/docs/api-auth/tutorials/adoption/api-tokens
 */
const _identity = require('../../fixtures/sample-auth0-identity-token');

describe('root/teamSpec', () => {

  let login, pub, prv, keystore;
  beforeAll(done => {
    stubAuth0Sessions((err, sessionStuff) => {
      if (err) return done.fail(err);
      ({ login, pub, prv, keystore } = sessionStuff);
      done();
    });
  });

  let root, team, organization, agent;
  beforeEach(done => {
    models.sequelize.sync({force: true}).then(() => {
      fixtures.loadFile(`${__dirname}/../../fixtures/agents.json`, models).then(() => {
        fixtures.loadFile(`${__dirname}/../../fixtures/organizations.json`, models).then(() => {
          fixtures.loadFile(`${__dirname}/../../fixtures/teams.json`, models).then(() => {
            models.Agent.findAll().then(results => {
              agent = results[0];
              models.Organization.findAll().then(results => {
                organization = results[0];
                models.Team.findAll().then(results => {
                  team = results[0];
                  models.Agent.create({ email: process.env.ROOT_AGENT }).then(results => {
                    root = results;
                    expect(root.isSuper).toBe(true);
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
    }).catch(err => {
      done.fail(err);
    });
  });

  describe('authorized', () => {
    let rootSession;
    beforeEach(done => {
      login({..._identity, email: process.env.ROOT_AGENT, name: 'Professor Fresh'}, (err, session) => {
        if (err) return done.fail(err);
        rootSession = session;
        done();
      });
    });

    describe('read', () => {

      describe('/team', () => {
        it('retrieves root agent\'s teams', done => {
          models.Team.create({ name: 'The Mike Tyson Mystery Team', organizationId: organization.id, creatorId: root.id }).then(o => {
            models.Team.findAll().then(results => {
              expect(results.length).toEqual(2);
 
              rootSession
                .get('/team')
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200)
                .end(function(err, res) {
                  if (err) return done.fail(err);
                  expect(res.body.length).toEqual(1);
                  expect(res.body[0].name).toEqual('The Mike Tyson Mystery Team');
                  done();
                });
            }).catch(err => {
              done.fail(err);
            });
          }).catch(err => {
            done.fail(err);
          });
        });
      });

      describe('/team/admin', () => {
        it('retrieves all teams', done => {
          models.Team.create({ name: 'The Mike Tyson Mystery Team', organizationId: organization.id, creatorId: root.id }).then(o => {
            models.Team.findAll().then(results => {
              expect(results.length).toEqual(2);
 
              rootSession
                .get('/team/admin')
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200)
                .end(function(err, res) {
                  if (err) return done.fail(err);
                  expect(res.body.length).toEqual(2);
                  done();
                });
            }).catch(err => {
              done.fail(err);
            });
          }).catch(err => {
            done.fail(err);
          });
        });
      });


      describe('/team/:id', () => {
        it('retrieves an existing record from the database', done => {
          rootSession
            .get(`/team/${team.id}`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.name).toEqual(team.name);
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
      });

      it('populates the team creator field', done => {
        rootSession
          .get(`/team/${team.id}`)
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) return done.fail(err);
            expect(res.body.creator).toBeDefined();
            expect(res.body.creator.email).toEqual(agent.email);
            done();
          });
      });

      it('populates the owner organization', done => {
        rootSession
          .get(`/team/${team.id}`)
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) return done.fail(err);
            expect(res.body.organization).toBeDefined();
            expect(res.body.organization.id).toEqual(organization.id);
            expect(res.body.organization.name).toEqual(organization.name);
            done();
          });
      });

      it('populates the membership', done => {
        rootSession
          .get(`/team/${team.id}`)
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) return done.fail(err);
            expect(res.body.members).toBeDefined();
            expect(res.body.members.length).toEqual(1);
            expect(res.body.members[0].id).toEqual(agent.id);
            done();
          });
      });
    });

    describe('create', () => {

      it('returns an error if record already exists', done => {
        rootSession
          .post('/team')
          .send({
            organizationId: organization.id,
            name: team.name
          })
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) return done.fail(err);
            expect(res.body.errors.length).toEqual(1);
            expect(res.body.errors[0].message).toEqual('That team is already registered');
            done();
          });
      });

      it('returns an error if empty team name provided', done => {
        rootSession
          .post('/team')
          .send({
            organizationId: organization.id,
            name: '   '
          })
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .expect(500)
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
          .send({
            organizationId: organization.id,
          })
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .expect(500)
          .end(function(err, res) {
            if (err) return done.fail(err);
            expect(res.body.errors.length).toEqual(1);
            expect(res.body.errors[0].message).toEqual('Team requires a name');
            done();
          });
      });

      it('returns an error if organization doesn\'t exist', done => {
        rootSession
          .post('/team')
          .send({
            organizationId: 333,
            name: team.name
          })
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .expect(404)
          .end(function(err, res) {
            if (err) return done.fail(err);
            expect(res.body.errors.length).toEqual(1);
            expect(res.body.errors[0].message).toEqual('That organization doesn\'t exist');
            done();
          });
      });

      it('returns an error if no organization provided', done => {
        rootSession
          .post('/team')
          .send({
            name: team.name
          })
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .expect(400)
          .end(function(err, res) {
            if (err) return done.fail(err);
            expect(res.body.errors.length).toEqual(1);
            expect(res.body.errors[0].message).toEqual('No organization provided');
            done();
          });
      });

      it('credits root as team creator', done => {
        rootSession
          .post('/team')
          .send({
            organizationId: organization.id,
            name: 'Tsuutina Translation'
          })
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) return done.fail(err);
            expect(res.body.creatorId).toEqual(root.id);
            done();
          });
      });
    });

    describe('update', () => {

      describe('PUT', () => {
        it('allows updates to an existing team in the database', done => {
          rootSession
            .put('/team')
            .send({
              id: team.id,
              name: 'Tsuutina Mark Translation'
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.name).toEqual('Tsuutina Mark Translation');

              models.Team.findOne({ where: { id: team.id }}).then(results => {
                expect(results.name).toEqual('Tsuutina Mark Translation');
                done();
              }).catch(err => {
                done.fail(err);
              });
            });
        });

        it('doesn\'t barf if team doesn\'t exist', done => {
          rootSession
            .put('/team')
            .send({
              id: 111,
              name: 'Tsuutina Mark Translation'
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.message).toEqual('No such team');
              done();
            });
        });
      });

      /**
       * The idempotent PUT is best used to change the properties of the team.
       * PATCH is used to modify associations (i.e., memberships and teams).
       */
      describe('PATCH', () => {
        let anotherAgent;
        beforeEach(done => {
          models.Agent.create({ name: 'Some Other Guy', email: 'someotherguy@example.com' }).then(result => {
            anotherAgent = result;
            done();
          }).catch(err => {
            done.fail(err);
          });
        });

        afterEach(() => {
          mailer.transport.sentMail = [];
        });

        describe('agent membership', () => {
          describe('updated via ID', () => {
            it('adds a member agent when agent provided isn\'t currently a member', done => {
              rootSession
                .patch('/team')
                .send({
                  id: team.id,
                  memberId: anotherAgent.id
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) return done.fail(err);
                  expect(res.body.message).toEqual('Update successful');

                  models.Team.findOne({ where: { id: team.id }, include: ['members'] }).then(results => {
                    expect(results.members.length).toEqual(2);
                    expect(results.members.find(m => m.name === anotherAgent.name)).toBeDefined();
                    expect(results.members.find(m => m.email === anotherAgent.email)).toBeDefined();
                    done();
                  }).catch(err => {
                    done.fail(err);
                  });
                });
            });

            it('sends an email to notify agent of new membership', function(done) {
              expect(mailer.transport.sentMail.length).toEqual(0);
              rootSession
                .patch('/team')
                .send({
                  id: team.id,
                  memberId: anotherAgent.id
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) return done.fail(err);
                  expect(mailer.transport.sentMail.length).toEqual(1);
                  expect(mailer.transport.sentMail[0].data.to).toEqual(anotherAgent.email);
                  expect(mailer.transport.sentMail[0].data.from).toEqual(process.env.NOREPLY_EMAIL);
                  expect(mailer.transport.sentMail[0].data.subject).toEqual('Identity membership update');
                  expect(mailer.transport.sentMail[0].data.text).toContain(`You are now a member of ${team.name}`);
                  done();
                });
            });

            it('removes a member agent when agent provided is currently a member', done => {
              team.addMember(anotherAgent).then(result => {
                rootSession
                  .patch('/team')
                  .send({
                    id: team.id,
                    memberId: anotherAgent.id
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) return done.fail(err);
                    expect(res.body.message).toEqual('Update successful');

                    models.Team.findOne({ where: { id: team.id }, include: ['members']}).then(results => {
                      expect(results.members.length).toEqual(1);
                      expect(results.members[0].name).toEqual(agent.name);
                      expect(results.members[0].email).toEqual(agent.email);
                      done();
                    }).catch(err => {
                      done.fail(err);
                    });
                  });
              }).catch(err => {
                done.fail(err);
              });
            });

            it('sends an email to notify agent of membership revocation', function(done) {
              expect(mailer.transport.sentMail.length).toEqual(0);
              team.addMember(anotherAgent).then(result => {
                rootSession
                  .patch('/team')
                  .send({
                    id: team.id,
                    memberId: anotherAgent.id
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) return done.fail(err);
                    expect(mailer.transport.sentMail.length).toEqual(1);
                    expect(mailer.transport.sentMail[0].data.to).toEqual(anotherAgent.email);
                    expect(mailer.transport.sentMail[0].data.from).toEqual(process.env.NOREPLY_EMAIL);
                    expect(mailer.transport.sentMail[0].data.subject).toEqual('Identity membership update');
                    expect(mailer.transport.sentMail[0].data.text).toContain(`You are no longer a member of ${team.name}`);
                    done();
                  });
              }).catch(err => {
                done.fail(err);
              });
            });

            it('doesn\'t barf if member agent doesn\'t exist', done => {
              rootSession
                .patch('/team')
                .send({
                  id: team.id,
                  memberId: 333
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(404)
                .end(function(err, res) {
                  if (err) return done.fail(err);
                  expect(res.body.message).toEqual('No such agent');
                  done();
                });
            });

            it('doesn\'t send an email if member agent doesn\'t exist', done => {
              expect(mailer.transport.sentMail.length).toEqual(0);
              rootSession
                .patch('/team')
                .send({
                  id: team.id,
                  memberId: 333
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(404)
                .end(function(err, res) {
                  if (err) return done.fail(err);
                  expect(mailer.transport.sentMail.length).toEqual(0);
                  done();
                });
            });

            it('doesn\'t barf if team doesn\'t exist', done => {
              rootSession
                .patch('/team')
                .send({
                  id: 111,
                  memberId: anotherAgent.id
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

            it('doesn\'t send an email if team doesn\'t exist', done => {
              expect(mailer.transport.sentMail.length).toEqual(0);
              rootSession
                .patch('/team')
                .send({
                  id: 111,
                  memberId: anotherAgent.id
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(404)
                .end(function(err, res) {
                  if (err) return done.fail(err);
                  expect(mailer.transport.sentMail.length).toEqual(0);
                  done();
                });
            });
          });

          describe('updated via email', () => {
            it('adds a member agent when agent provided isn\'t currently a member', done => {
              rootSession
                .patch('/team')
                .send({
                  id: team.id,
                  email: anotherAgent.email
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) return done.fail(err);
                  expect(res.body.message).toEqual('Update successful');

                  models.Team.findOne({ where: { id: team.id }, include: ['members'] }).then(results => {
                    expect(results.members.length).toEqual(2);
                    expect(results.members.find(m => m.name === anotherAgent.name)).toBeDefined();
                    expect(results.members.find(m => m.email === anotherAgent.email)).toBeDefined();
                    done();
                  }).catch(err => {
                    done.fail(err);
                  });
                });
            });

            it('sends an email to notify agent of new membership', function(done) {
              expect(mailer.transport.sentMail.length).toEqual(0);
              rootSession
                .patch('/team')
                .send({
                  id: team.id,
                  email: anotherAgent.email
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) return done.fail(err);
                  expect(mailer.transport.sentMail.length).toEqual(1);
                  expect(mailer.transport.sentMail[0].data.to).toEqual(anotherAgent.email);
                  expect(mailer.transport.sentMail[0].data.from).toEqual(process.env.NOREPLY_EMAIL);
                  expect(mailer.transport.sentMail[0].data.subject).toEqual('Identity membership update');
                  expect(mailer.transport.sentMail[0].data.text).toContain(`You are now a member of ${team.name}`);
                  done();
                });
            });

            it('removes a member agent when agent provided is currently a member', done => {
              team.addMember(anotherAgent).then(result => {
                rootSession
                  .patch('/team')
                  .send({
                    id: team.id,
                    email: anotherAgent.email
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) return done.fail(err);
                    expect(res.body.message).toEqual('Update successful');

                    models.Team.findOne({ where: { id: team.id }, include: ['members']}).then(results => {
                      expect(results.members.length).toEqual(1);
                      expect(results.members[0].name).toEqual(agent.name);
                      expect(results.members[0].email).toEqual(agent.email);
                      done();
                    }).catch(err => {
                      done.fail(err);
                    });
                  });
              }).catch(err => {
                done.fail(err);
              });
            });

            it('sends an email to notify agent of membership revocation', function(done) {
              expect(mailer.transport.sentMail.length).toEqual(0);
              team.addMember(anotherAgent).then(result => {
                rootSession
                  .patch('/team')
                  .send({
                    id: team.id,
                    email: anotherAgent.email
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) return done.fail(err);
                    expect(mailer.transport.sentMail.length).toEqual(1);
                    expect(mailer.transport.sentMail[0].data.to).toEqual(anotherAgent.email);
                    expect(mailer.transport.sentMail[0].data.from).toEqual(process.env.NOREPLY_EMAIL);
                    expect(mailer.transport.sentMail[0].data.subject).toEqual('Identity membership update');
                    expect(mailer.transport.sentMail[0].data.text).toContain(`You are no longer a member of ${team.name}`);
                    done();
                  });
              }).catch(err => {
                done.fail(err);
              });
            });

            it('adds record if member agent doesn\'t exist', done => {
              rootSession
                .patch('/team')
                .send({
                  id: team.id,
                  email: 'someunknownagent@example.com'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) return done.fail(err);
                  expect(res.body.message).toEqual('Update successful');

                  models.Agent.findOne({ where: { email: 'someunknownagent@example.com' } }).then(unknownAgent => {
                    expect(unknownAgent.name).toBe(null);
                    expect(unknownAgent.email).toEqual('someunknownagent@example.com');

                    models.Team.findOne({ where: { id: team.id }, include: ['members']}).then(results => {
                      expect(results.members.length).toEqual(2);
                      expect(results.members[1].name).toEqual(unknownAgent.name);
                      expect(results.members[1].email).toEqual(unknownAgent.email);
                      done();
                    }).catch(err => {
                      done.fail(err);
                    });
                  }).catch(err => {
                    done.fail(err);
                  });
                });
            });

            it('sends an email if member agent doesn\'t exist', done => {
              expect(mailer.transport.sentMail.length).toEqual(0);
              rootSession
                .patch('/team')
                .send({
                  id: team.id,
                  email: 'someunknownagent@example.com'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) return done.fail(err);
                  expect(mailer.transport.sentMail.length).toEqual(1);
                  expect(mailer.transport.sentMail[0].data.to).toEqual('someunknownagent@example.com');
                  expect(mailer.transport.sentMail[0].data.from).toEqual(process.env.NOREPLY_EMAIL);
                  expect(mailer.transport.sentMail[0].data.subject).toEqual('Identity membership update');
                  expect(mailer.transport.sentMail[0].data.text).toContain(`You are now a member of ${team.name}`);
                  done();
                });
            });

            it('doesn\'t barf if team doesn\'t exist', done => {
              rootSession
                .patch('/team')
                .send({
                  id: 111,
                  email: anotherAgent.email
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
          });
        });
      });
    });

    describe('delete', () => {
      it('allows removal of an existing record from the database', done => {
        rootSession
          .delete(`/team/${team.id}`)
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) return done.fail(err);
            expect(res.body.message).toEqual('Team deleted');
            models.Team.findAll().then(results => {
              expect(results.length).toEqual(0);
              done();
            }).catch(err => {
              done.fail(err);
            });
          });
      });

      it('doesn\'t barf if team doesn\'t exist', done => {
        rootSession
          .delete(`/team/333`)
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

  describe('non-root', () => {
    let nonRootSession;
    beforeEach(done => {
      login({ ..._identity, email: agent.email }, [scope.read.teams], (err, session) => {
        if (err) return done.fail(err);
        nonRootSession = session;
        done();
      });
    });

    describe('read', () => {
      describe('/team', () => {
        it('returns only the teams created by the requesting agent', done => {
          models.Team.create({ name: 'The Mike Tyson Mystery Team', organizationId: organization.id, creatorId: root.id }).then(o => {
            models.Team.findAll().then(results => {
              expect(results.length).toEqual(2);
              nonRootSession
                .get(`/team`)
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(200)
                .end(function(err, res) {
                  if (err) return done.fail(err);
                  expect(res.body.length).toEqual(1);
                  done();
                });
            }).catch(err => {
              done.fail(err);
            });
          }).catch(err => {
            done.fail(err);
          });
        });
      });
    });
  });
});
