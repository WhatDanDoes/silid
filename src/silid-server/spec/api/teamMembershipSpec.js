const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001;
const app = require('../../app');
const fixtures = require('sequelize-fixtures');
const models = require('../../models');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const stubJwks = require('../support/stubJwks');
const pem2jwk = require('pem-jwk').pem2jwk
const nock = require('nock');
const mailer = require('../../mailer');

/**
 * 2019-11-13
 * Sample tokens taken from:
 *
 * https://auth0.com/docs/api-auth/tutorials/adoption/api-tokens
 */
const _access = require('../fixtures/sample-auth0-access-token');
//const _identity = require('../fixtures/sample-auth0-identity-token');

describe('teamMembershipSpec', () => {

  let userinfoScope;
  let signedAccessToken, scope, pub, prv, keystore;
  beforeAll(done => {
    stubJwks((err, tokenAndScope) => {
      if (err) return done.fail(err);
      ({ signedAccessToken, scope, pub, prv, keystore } = tokenAndScope);
      userinfoScope = require('../support/userinfoStub')(signedAccessToken);
      done();
    });
  });

  afterEach(() => {
    mailer.transport.sentMail = [];
  });

  let team, organization, agent;
  beforeEach(done => {
    models.sequelize.sync({force: true}).then(() => {
      fixtures.loadFile(`${__dirname}/../fixtures/agents.json`, models).then(() => {
        models.Agent.findAll().then(results => {
          agent = results[0];
          fixtures.loadFile(`${__dirname}/../fixtures/organizations.json`, models).then(() => {
            models.Organization.findAll().then(results => {
              organization = results[0];
              fixtures.loadFile(`${__dirname}/../fixtures/teams.json`, models).then(() => {
                models.Team.findAll().then(results => {
                  team = results[0];

                  // This agent has recently returned for a visit
                  agent.accessToken = `Bearer ${signedAccessToken}`;
                  agent.save().then(() => {
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


  describe('authenticated', () => {

    describe('authorized', () => {

      describe('create', () => {
        describe('unknown agent', () => {
          it('returns the agent added to the membership', done => {
            models.Team.findAll({ include: [ 'creator', { model: models.Agent, as: 'members' } ] }).then(results => {
              expect(results.length).toEqual(1);
              expect(results[0].members.length).toEqual(1);
  
              request(app)
                .put(`/team/${team.id}/agent`)
                .send({
                  email: 'somebrandnewguy@example.com' 
                })
                .set('Accept', 'application/json')
                .set('Authorization', `Bearer ${signedAccessToken}`)
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) done.fail(err);
                  scope.done();
                  expect(res.body.name).toEqual(null);
                  expect(res.body.email).toEqual('somebrandnewguy@example.com');
                  expect(res.body.id).toBeDefined();
                  // Watch out of this... shouldn't it be `undefined`?
                  expect(res.body.accessToken).toBe(null);
  
                  done();
                });
            }).catch(err => {
              done.fail(err);
            });
          });

          it('adds a new agent to team membership', done => {
            models.Team.findAll({ include: [ 'creator', { model: models.Agent, as: 'members' } ] }).then(results => {
              expect(results.length).toEqual(1);
              expect(results[0].members.length).toEqual(1);

              request(app)
                .put(`/team/${team.id}/agent`)
                .send({
                  email: 'somebrandnewguy@example.com' 
                })
                .set('Accept', 'application/json')
                .set('Authorization', `Bearer ${signedAccessToken}`)
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) done.fail(err);
                  scope.done();
  
                  models.Team.findAll({ include: [ 'creator', { model: models.Agent, as: 'members' } ] }).then(results => {
                    expect(results.length).toEqual(1);
                    expect(results[0].members.length).toEqual(2);
                    expect(results[0].members.map(a => a.email).includes('somebrandnewguy@example.com')).toBe(true);
                    done();
                  }).catch(err => {
                    done.fail(err);
                  });
                });
            }).catch(err => {
              done.fail(err);
            });
          });
  
          it('creates an agent record if the agent is not currently registered', done => {
            models.Agent.findOne({ where: { email: 'somebrandnewguy@example.com' } }).then(results => {
              expect(results).toBe(null);
  
              request(app)
                .put(`/team/${team.id}/agent`)
                .send({
                  email: 'somebrandnewguy@example.com' 
                })
                .set('Accept', 'application/json')
                .set('Authorization', `Bearer ${signedAccessToken}`)
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) done.fail(err);
                  scope.done();

                  models.Agent.findOne({ where: { email: 'somebrandnewguy@example.com' } }).then(results => {
                    expect(results.email).toEqual('somebrandnewguy@example.com');
                    expect(results.id).toBeDefined();
                    // This one should be `null`
                    expect(results.accessToken).toBe(null);
                    done();
                  }).catch(err => {
                    done.fail(err);
                  });
                });
            }).catch(err => {
              done.fail(err);
            });
          });
  
          it('returns a friendly message if the agent is already a member', done => {
            request(app)
              .put(`/team/${team.id}/agent`)
              .send({
                email: 'somebrandnewguy@example.com' 
              })
              .set('Accept', 'application/json')
              .set('Authorization', `Bearer ${signedAccessToken}`)
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) done.fail(err);
                scope.done();

                request(app)
                  .put(`/team/${team.id}/agent`)
                  .send({
                    email: 'somebrandnewguy@example.com' 
                  })
                  .set('Accept', 'application/json')
                  .set('Authorization', `Bearer ${signedAccessToken}`)
                  .expect('Content-Type', /json/)
                  .expect(200)
                  .end(function(err, res) {
                    if (err) done.fail(err);
                    scope.done();
                    expect(res.body.message).toEqual('somebrandnewguy@example.com is already a member of this team');
                    done();
                  });
              });
          });

          it('sends an email to notify agent of new membership', function(done) {
            expect(mailer.transport.sentMail.length).toEqual(0);
            request(app)
              .put(`/team/${team.id}/agent`)
              .send({
                email: 'somebrandnewguy@example.com' 
              })
              .set('Accept', 'application/json')
              .set('Authorization', `Bearer ${signedAccessToken}`)
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) done.fail(err);
                scope.done();
                expect(mailer.transport.sentMail.length).toEqual(1);
                expect(mailer.transport.sentMail[0].data.to).toEqual('somebrandnewguy@example.com');
                expect(mailer.transport.sentMail[0].data.from).toEqual(process.env.NOREPLY_EMAIL);
                expect(mailer.transport.sentMail[0].data.subject).toEqual('Identity membership update');
                expect(mailer.transport.sentMail[0].data.text).toContain(`You are now a member of ${team.name}`);
                done();
              });
          });

          it('doesn\'t barf if team doesn\'t exist', done => {
            request(app)
              .put('/team/333/agent')
              .send({
                email: 'somebrandnewguy@example.com' 
              })
              .set('Accept', 'application/json')
              .set('Authorization', `Bearer ${signedAccessToken}`)
              .expect('Content-Type', /json/)
              .expect(404)
              .end(function(err, res) {
                if (err) done.fail(err);
                scope.done();
                expect(res.body.message).toEqual('No such team');
                done();
              });
          });
        });

        describe('registered agent', () => {
          let knownAgent;
          beforeEach(done => {
            models.Agent.create({ email: 'weknowthisguy@example.com', name: 'Well-known Guy', accessToken: 'somefakeaccesstoken' }).then(result => {
              knownAgent = result;
              done();
            }).catch(err => {
              done.fail(err);
            });
          });

          it('returns the agent added to the membership', done => {
            models.Team.findAll({ include: [ 'creator', { model: models.Agent, as: 'members' } ] }).then(results => {
              expect(results.length).toEqual(1);
              expect(results[0].members.length).toEqual(1);

              request(app)
                .put(`/team/${team.id}/agent`)
                .send({
                  email: knownAgent.email 
                })
                .set('Accept', 'application/json')
                .set('Authorization', `Bearer ${signedAccessToken}`)
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) done.fail(err);
                  scope.done();
                  expect(res.body.name).toEqual(knownAgent.name);
                  expect(res.body.email).toEqual(knownAgent.email);
                  expect(res.body.id).toEqual(knownAgent.id);
                  // `undefined`, as expected
                  expect(res.body.accessToken).toBeUndefined();

                  done();
                });
            }).catch(err => {
              done.fail(err);
            });
          });

          it('adds the agent to team membership', done => {
            models.Team.findAll({ include: [ 'creator', { model: models.Agent, as: 'members' } ] }).then(results => {
              expect(results.length).toEqual(1);
              expect(results[0].members.length).toEqual(1);
  
              request(app)
                .put(`/team/${team.id}/agent`)
                .send({
                  email: knownAgent.email 
                })
                .set('Accept', 'application/json')
                .set('Authorization', `Bearer ${signedAccessToken}`)
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) done.fail(err);
                  scope.done();
  
                  models.Team.findAll({ include: [ 'creator', { model: models.Agent, as: 'members' } ] }).then(results => {
                    expect(results.length).toEqual(1);
                    expect(results[0].members.length).toEqual(2);
                    expect(results[0].members.map(a => a.id).includes(knownAgent.id)).toBe(true);
                    done();
                  }).catch(err => {
                    done.fail(err);
                  });
                });
            }).catch(err => {
              done.fail(err);
            });
          });
  
          it('returns a friendly message if the agent is already a member', done => {
            request(app)
              .put(`/team/${team.id}/agent`)
              .send({
                email: knownAgent.email 
              })
              .set('Accept', 'application/json')
              .set('Authorization', `Bearer ${signedAccessToken}`)
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) done.fail(err);
                scope.done();
                request(app)
                  .put(`/team/${team.id}/agent`)
                  .send({
                    email: knownAgent.email 
                  })
                  .set('Accept', 'application/json')
                  .set('Authorization', `Bearer ${signedAccessToken}`)
                  .expect('Content-Type', /json/)
                  .expect(200)
                  .end(function(err, res) {
                    if (err) done.fail(err);
                    scope.done();
                    expect(res.body.message).toEqual(`${knownAgent.email} is already a member of this team`);
                    done();
                  });
              });
          });

          it('doesn\'t barf if team doesn\'t exist', done => {
            request(app)
              .put('/team/333/agent')
              .send({
                email: knownAgent.email 
              })
              .set('Accept', 'application/json')
              .set('Authorization', `Bearer ${signedAccessToken}`)
              .expect('Content-Type', /json/)
              .expect(404)
              .end(function(err, res) {
                if (err) done.fail(err);
                scope.done();
                expect(res.body.message).toEqual('No such team');
                done();
              });
          });

          it('sends an email to notify agent of new membership', function(done) {
            expect(mailer.transport.sentMail.length).toEqual(0);
            request(app)
              .put(`/team/${team.id}/agent`)
              .send({
                email: knownAgent.email 
              })
              .set('Accept', 'application/json')
              .set('Authorization', `Bearer ${signedAccessToken}`)
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) done.fail(err);
                scope.done();
                expect(mailer.transport.sentMail.length).toEqual(1);
                expect(mailer.transport.sentMail[0].data.to).toEqual(knownAgent.email);
                expect(mailer.transport.sentMail[0].data.from).toEqual(process.env.NOREPLY_EMAIL);
                expect(mailer.transport.sentMail[0].data.subject).toEqual('Identity membership update');
                expect(mailer.transport.sentMail[0].data.text).toContain(`You are now a member of ${team.name}`);
                done();
              });
          });
        });
      });

      describe('delete', () => {
        let knownAgent;
        beforeEach(done => {
          models.Agent.create({ email: 'weknowthisguy@example.com', name: 'Well-known Guy', accessToken: 'somefakeaccesstoken' }).then(result => {
            knownAgent = result;
            team.addMember(knownAgent).then(result => {
              done();
            }).catch(err => {
              done.fail(err);
            });
          }).catch(err => {
            done.fail(err);
          });
        });

        it('removes an existing member record from the team', done => {
          request(app)
            .delete(`/team/${team.id}/agent/${knownAgent.id}`)
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${signedAccessToken}`)
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) done.fail(err);
              scope.done();
              expect(res.body.message).toEqual(`Member removed`);
              done();
            });
        });

        it('doesn\'t barf if team doesn\'t exist', done => {
          request(app)
            .delete(`/team/333/agent/${knownAgent.id}`)
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${signedAccessToken}`)
            .expect('Content-Type', /json/)
            .expect(404)
            .end(function(err, res) {
              if (err) done.fail(err);
              scope.done();
              expect(res.body.message).toEqual('No such team');
              done();
            });
        });

        it('doesn\'t barf if the agent doesn\'t exist', done => {
          request(app)
            .delete(`/team/${team.id}/agent/333`)
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${signedAccessToken}`)
            .expect('Content-Type', /json/)
            .expect(404)
            .end(function(err, res) {
              if (err) done.fail(err);
              scope.done();
              expect(res.body.message).toEqual('That agent is not a member');
              done();
            });
        });

        it('sends an email to notify agent of membership revocation', function(done) {
          expect(mailer.transport.sentMail.length).toEqual(0);
          team.addMember(knownAgent).then(result => {
            request(app)
              .delete(`/team/${team.id}/agent/${knownAgent.id}`)
              .set('Accept', 'application/json')
              .set('Authorization', `Bearer ${signedAccessToken}`)
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) done.fail(err);
                scope.done();
                expect(mailer.transport.sentMail.length).toEqual(1);
                expect(mailer.transport.sentMail[0].data.to).toEqual(knownAgent.email);
                expect(mailer.transport.sentMail[0].data.from).toEqual(process.env.NOREPLY_EMAIL);
                expect(mailer.transport.sentMail[0].data.subject).toEqual('Identity membership update');
                expect(mailer.transport.sentMail[0].data.text).toContain(`You are no longer a member of ${team.name}`);
                done();
              });
          }).catch(err => {
            done.fail(err);
          });
        });
      });
    });

    describe('unauthorized', () => {

      let suspiciousToken, suspiciousAgent;
      beforeEach(done => {
        suspiciousToken = jwt.sign({ ..._access, sub: 'auth0|888888' }, prv, { algorithm: 'RS256', expiresIn: '1h', header: { kid: keystore.all()[0].kid } });

        models.Agent.create({ email: 'suspiciousagent@example.com', accessToken: `Bearer ${suspiciousToken}` }).then(a => {
          suspiciousAgent = a;
          done();
        }).catch(err => {
          done.fail(err);
        });
      });

      describe('create', () => {
        it('doesn\'t allow a non-member agent to add a member', done => {
          request(app)
            .put(`/team/${team.id}/agent`)
            .send({
              email: suspiciousAgent.email 
            })
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${suspiciousToken}`)
            .expect('Content-Type', /json/)
            .expect(403)
            .end(function(err, res) {
              if (err) done.fail(err);
              scope.done();
              expect(res.body.message).toEqual('You are not a member of this team');
              done();
            });
        });
      });

      describe('delete', () => {
        let knownAgent;
        beforeEach(done => {
          models.Agent.create({ email: 'weknowthisguy@example.com', name: 'Well-known Guy', accessToken: 'somefakeaccesstoken' }).then(result => {
            knownAgent = result;
            team.addMember(knownAgent).then(result => {
              done();
            }).catch(err => {
              done.fail(err);
            });
          }).catch(err => {
            done.fail(err);
          });
        });

        it('returns 401', done => {
          request(app)
            .delete(`/team/${team.id}/agent/${knownAgent.id}`)
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${suspiciousToken}`)
            .expect('Content-Type', /json/)
            .expect(401)
            .end(function(err, res) {
              if (err) done.fail(err);
              scope.done();
              expect(res.body.message).toEqual('Unauthorized: Invalid token');
              done();
            });
        });

        it('does not remove the record from the database', done => {
          models.Team.findAll({ include: [ 'creator', { model: models.Agent, as: 'members' } ] }).then(results => {
            expect(results.length).toEqual(1);
            expect(results[0].members.length).toEqual(2);

            request(app)
              .delete(`/team/${team.id}/agent/${knownAgent.id}`)
              .set('Accept', 'application/json')
              .set('Authorization', `Bearer ${suspiciousToken}`)
              .expect('Content-Type', /json/)
              .expect(401)
              .end(function(err, res) {
                if (err) done.fail(err);
                scope.done();
                models.Team.findAll({ include: [ 'creator', { model: models.Agent, as: 'members' } ] }).then(results => {
                  expect(results.length).toEqual(1);
                  expect(results[0].members.length).toEqual(2);
                  done();
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

  describe('not authenticated', () => {

    it('returns 401 if provided an expired token', done => {
      let expiredToken = jwt.sign({ ..._access, iat: Math.floor(Date.now() / 1000) - (60 * 60) }, prv, { algorithm: 'RS256', expiresIn: '1h', header: { kid: keystore.all()[0].kid } });
      request(app)
        .get('/team')
        .send({ name: 'Some org' })
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect('Content-Type', /json/)
        .expect(401)
        .end(function(err, res) {
          if (err) done.fail(err);
          scope.done();
          expect(res.body.message).toEqual('jwt expired');
          done();
        });
    });

    it('returns 401 if provided no token', done => {
      request(app)
        .get('/team')
        .send({ name: 'Some org' })
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(401)
        .end(function(err, res) {
          if (err) done.fail(err);
          expect(res.body.message).toEqual('No authorization token was found');
          done();
        });
    });
  });
});
