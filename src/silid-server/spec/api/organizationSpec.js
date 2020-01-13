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

describe('organizationSpec', () => {

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

  let organization, agent;
  beforeEach(done => {
    models.sequelize.sync({force: true}).then(() => {
      fixtures.loadFile(`${__dirname}/../fixtures/agents.json`, models).then(() => {
        models.Agent.findAll().then(results => {
          agent = results[0];
          fixtures.loadFile(`${__dirname}/../fixtures/organizations.json`, models).then(() => {
            models.Organization.findAll().then(results => {
              organization = results[0];

              // This agent has recently returned for a visit
              agent.accessToken = `Bearer ${signedAccessToken}`;
              agent.save().then(() => {
                done();
              }).catch(err => {
                done.fail(err);
              });
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
        it('adds a new record to the database', done => {
          models.Organization.findAll().then(results => {
            expect(results.length).toEqual(1);

            request(app)
              .post('/organization')
              .send({
                name: 'One Book Canada' 
              })
              .set('Accept', 'application/json')
              .set('Authorization', `Bearer ${signedAccessToken}`)
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) done.fail(err);
                scope.done();
                expect(res.body.name).toEqual('One Book Canada');

                models.Organization.findAll().then(results => {
                  expect(results.length).toEqual(2);
                  done();
                }).catch(err => {
                  done.fail(err);
                });
              });
          }).catch(err => {
            done.fail(err);
          });
        });

        it('credits creator agent', done => {
          request(app)
            .post('/organization')
            .send({
              name: 'One Book Canada'
            })
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${signedAccessToken}`)
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) done.fail(err);
              scope.done();
              expect(res.body.creatorId).toEqual(agent.id);
              done();
            });
        });

        it('returns an error if record already exists', done => {
          request(app)
            .post('/organization')
            .send({
              name: organization.name 
            })
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${signedAccessToken}`)
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) done.fail(err);
              scope.done();
              expect(res.body.errors.length).toEqual(1);
              expect(res.body.errors[0].message).toEqual('That organization is already registered');
              done();
            });
        });
      });

      describe('read', () => {
        it('retrieves an existing record from the database', done => {
          request(app)
            .get(`/organization/${organization.id}`)
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${signedAccessToken}`)
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) done.fail(err);
              scope.done();
              expect(res.body.name).toBeDefined();
              expect(res.body.name).toEqual(organization.name);
              done();
            });
        });

        it('doesn\'t barf if record doesn\'t exist', done => {
          request(app)
            .get('/organization/33')
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${signedAccessToken}`)
            .expect('Content-Type', /json/)
            .expect(404)
            .end(function(err, res) {
              if (err) return done.fail(err);
              scope.done();
              expect(res.body.message).toEqual('No such organization');
              done();
            });
        });

        it('retrieves all organization memberships for the agent', done => {
          agent.getOrganizations().then((results) => {
            expect(results.length).toEqual(1);
            request(app)
              .get(`/organization`)
              .set('Accept', 'application/json')
              .set('Authorization', `Bearer ${signedAccessToken}`)
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) done.fail(err);
                scope.done();
                expect(res.body.length).toEqual(1);
                done();
              });
          }).catch(err => {
            done.fail(err);
          });
        });

        it('retrieves all organizations created by the agent in addition to memberships', done => {
          agent.getOrganizations().then((results) => {
            expect(results.length).toEqual(1);

            models.Organization.create({ name: 'Lutheran Bible Translators', creatorId: agent.id }).then(org => {

              request(app)
                .get(`/organization`)
                .set('Accept', 'application/json')
                .set('Authorization', `Bearer ${signedAccessToken}`)
                .expect('Content-Type', /json/)
                .expect(200)
                .end(function(err, res) {
                  if (err) done.fail(err);
                  scope.done();
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

        it('populates the organization creator field', done => {
          request(app)
            .get(`/organization/${organization.id}`)
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${signedAccessToken}`)
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) done.fail(err);
              scope.done();
              expect(res.body.creator).toBeDefined();
              expect(res.body.creator.email).toEqual(agent.email);
              expect(res.body.creator.accessToken).toBeUndefined();
              done();
            });
        });

        it('populates the team list', done => {
          models.Team.create({ name: 'Alpha Squad 1', organizationId: organization.id, creatorId: agent.id }).then(team => {
            request(app)
              .get(`/organization/${organization.id}`)
              .set('Accept', 'application/json')
              .set('Authorization', `Bearer ${signedAccessToken}`)
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) done.fail(err);
                scope.done();
                expect(res.body.teams).toBeDefined();
                expect(res.body.teams.length).toEqual(1);
                expect(res.body.teams[0].name).toEqual('Alpha Squad 1');
                done();
              });
            }).catch(err => {
              done.fail(err);
            });
        });

        it('populates the teams on the organization team list', done => {
          models.Team.create({ name: 'Alpha Squad 1', organizationId: organization.id, creatorId: agent.id }).then(team => {
            request(app)
              .get(`/organization/${organization.id}`)
              .set('Accept', 'application/json')
              .set('Authorization', `Bearer ${signedAccessToken}`)
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) done.fail(err);
                scope.done();
                expect(res.body.teams).toBeDefined();
                expect(res.body.teams.length).toEqual(1);
                expect(res.body.teams[0].members.length).toEqual(1);
                expect(res.body.teams[0].members[0].email).toEqual(agent.email);
                expect(res.body.teams[0].members[0].accessToken).toBeUndefined();
                done();
              });
            }).catch(err => {
              done.fail(err);
            });
        });

        it('populates the membership', done => {
          request(app)
            .get(`/organization/${organization.id}`)
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${signedAccessToken}`)
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) done.fail(err);
              scope.done();
              expect(res.body.members).toBeDefined();
              expect(res.body.members.length).toEqual(1);
              expect(res.body.members[0].id).toEqual(agent.id);
              done();
            });
        });

        it('omits agent tokens in populated membership', done => {
          request(app)
            .get(`/organization/${organization.id}`)
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${signedAccessToken}`)
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) done.fail(err);
              scope.done();
              expect(res.body.members[0].accessToken).toBeUndefined();
              done();
            });
        });
      });

      describe('update', () => {

        describe('PUT', () => {
          it('updates an existing record in the database', done => {
            request(app)
              .put('/organization')
              .send({
                id: organization.id,
                name: 'Some Cool Guy'
              })
              .set('Accept', 'application/json')
              .set('Authorization', `Bearer ${signedAccessToken}`)
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) done.fail(err);
                scope.done();
                expect(res.body.name).toEqual('Some Cool Guy');

                models.Organization.findOne({ where: { id: organization.id }}).then(results => {
                  expect(results.name).toEqual('Some Cool Guy');
                  expect(results.email).toEqual(organization.email);
                  done();
                }).catch(err => {
                  done.fail(err);
                });
              });
          });

          it('doesn\'t barf if organization doesn\'t exist', done => {
            request(app)
              .put('/organization')
              .send({
                id: 111,
                name: 'Some Guy'
              })
              .set('Accept', 'application/json')
              .set('Authorization', `Bearer ${signedAccessToken}`)
              .expect('Content-Type', /json/)
              .expect(200)
              .end(function(err, res) {
                if (err) done.fail(err);
                scope.done();
                expect(res.body.message).toEqual('No such organization');
                done();
              });
          });
        });

        /**
         * The idempotent PUT is best used to change the properties of the organization.
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
                request(app)
                  .patch('/organization')
                  .send({
                    id: organization.id,
                    memberId: anotherAgent.id
                  })
                  .set('Accept', 'application/json')
                  .set('Authorization', `Bearer ${signedAccessToken}`)
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) done.fail(err);
                    scope.done();
                    expect(res.body.message).toEqual('Update successful');

                    models.Organization.findOne({ where: { id: organization.id }, include: ['members'] }).then(results => {
                      expect(results.members.length).toEqual(2);
                      expect(results.members[1].name).toEqual(anotherAgent.name);
                      expect(results.members[1].email).toEqual(anotherAgent.email);
                      done();
                    }).catch(err => {
                      done.fail(err);
                    });
                  });
              });

              it('sends an email to notify agent of new membership', function(done) {
                expect(mailer.transport.sentMail.length).toEqual(0);
                request(app)
                  .patch('/organization')
                  .send({
                    id: organization.id,
                    memberId: anotherAgent.id
                  })
                  .set('Accept', 'application/json')
                  .set('Authorization', `Bearer ${signedAccessToken}`)
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) done.fail(err);
                    scope.done();
                    expect(mailer.transport.sentMail.length).toEqual(1);
                    expect(mailer.transport.sentMail[0].data.to).toEqual(anotherAgent.email);
                    expect(mailer.transport.sentMail[0].data.from).toEqual(process.env.NOREPLY_EMAIL);
                    expect(mailer.transport.sentMail[0].data.subject).toEqual('Identity membership update');
                    expect(mailer.transport.sentMail[0].data.text).toContain(`You are now a member of ${organization.name}`);
                    done();
                  });
              });

              it('removes a member agent when agent provided is currently a member', done => {
                organization.addMember(anotherAgent).then(result => {
                  request(app)
                    .patch('/organization')
                    .send({
                      id: organization.id,
                      memberId: anotherAgent.id
                    })
                    .set('Accept', 'application/json')
                    .set('Authorization', `Bearer ${signedAccessToken}`)
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end(function(err, res) {
                      if (err) done.fail(err);
                      scope.done();
                      expect(res.body.message).toEqual('Update successful');

                      models.Organization.findOne({ where: { id: organization.id }, include: ['members']}).then(results => {
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
                organization.addMember(anotherAgent).then(result => {
                  request(app)
                    .patch('/organization')
                    .send({
                      id: organization.id,
                      memberId: anotherAgent.id
                    })
                    .set('Accept', 'application/json')
                    .set('Authorization', `Bearer ${signedAccessToken}`)
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end(function(err, res) {
                      if (err) done.fail(err);
                      scope.done();
                      expect(mailer.transport.sentMail.length).toEqual(1);
                      expect(mailer.transport.sentMail[0].data.to).toEqual(anotherAgent.email);
                      expect(mailer.transport.sentMail[0].data.from).toEqual(process.env.NOREPLY_EMAIL);
                      expect(mailer.transport.sentMail[0].data.subject).toEqual('Identity membership update');
                      expect(mailer.transport.sentMail[0].data.text).toContain(`You are no longer a member of ${organization.name}`);
                      done();
                    });
                }).catch(err => {
                  done.fail(err);
                });
              });

              it('doesn\'t barf if member agent doesn\'t exist', done => {
                request(app)
                  .patch('/organization')
                  .send({
                    id: organization.id,
                    memberId: 333
                  })
                  .set('Accept', 'application/json')
                  .set('Authorization', `Bearer ${signedAccessToken}`)
                  .expect('Content-Type', /json/)
                  .expect(404)
                  .end(function(err, res) {
                    if (err) done.fail(err);
                    scope.done();
                    expect(res.body.message).toEqual('No such agent');
                    done();
                  });
              });

              it('doesn\'t send an email if member agent doesn\'t exist', done => {
                expect(mailer.transport.sentMail.length).toEqual(0);
                request(app)
                  .patch('/organization')
                  .send({
                    id: organization.id,
                    memberId: 333
                  })
                  .set('Accept', 'application/json')
                  .set('Authorization', `Bearer ${signedAccessToken}`)
                  .expect('Content-Type', /json/)
                  .expect(404)
                  .end(function(err, res) {
                    if (err) done.fail(err);
                    scope.done();
                    expect(mailer.transport.sentMail.length).toEqual(0);
                    done();
                  });
              });

              it('doesn\'t barf if organization doesn\'t exist', done => {
                request(app)
                  .patch('/organization')
                  .send({
                    id: 111,
                    memberId: anotherAgent.id
                  })
                  .set('Accept', 'application/json')
                  .set('Authorization', `Bearer ${signedAccessToken}`)
                  .expect('Content-Type', /json/)
                  .expect(404)
                  .end(function(err, res) {
                    if (err) done.fail(err);
                    scope.done();
                    expect(res.body.message).toEqual('No such organization');
                    done();
                  });
              });

              it('doesn\'t send an email if organization doesn\'t exist', done => {
                expect(mailer.transport.sentMail.length).toEqual(0);
                request(app)
                  .patch('/organization')
                  .send({
                    id: 111,
                    memberId: anotherAgent.id
                  })
                  .set('Accept', 'application/json')
                  .set('Authorization', `Bearer ${signedAccessToken}`)
                  .expect('Content-Type', /json/)
                  .expect(404)
                  .end(function(err, res) {
                    if (err) done.fail(err);
                    scope.done();
                    expect(mailer.transport.sentMail.length).toEqual(0);
                    done();
                  });
              });

              it('doesn\'t allow a non-member agent to add a member', done => {
                let unauthorizedToken = jwt.sign({ ..._access, sub: 'auth0|888888' }, prv, { algorithm: 'RS256', expiresIn: '1h', header: { kid: keystore.all()[0].kid } });
                anotherAgent.accessToken = `Bearer ${unauthorizedToken}`;
                anotherAgent.save().then(() => {
                  request(app)
                    .patch('/organization')
                    .send({
                      id: organization.id,
                      memberId: anotherAgent.id
                    })
                    .set('Accept', 'application/json')
                    .set('Authorization', `Bearer ${unauthorizedToken}`)
                    .expect('Content-Type', /json/)
                    .expect(403)
                    .end(function(err, res) {
                      if (err) done.fail(err);
                      scope.done();
                      expect(res.body.message).toEqual('You are not a member of this organization');
                      done();
                    });
                }).catch(err => {
                  done.fail(err);
                });
              });
            });

            describe('updated via email', () => {
              it('adds a member agent when agent provided isn\'t currently a member', done => {
                request(app)
                  .patch('/organization')
                  .send({
                    id: organization.id,
                    email: anotherAgent.email
                  })
                  .set('Accept', 'application/json')
                  .set('Authorization', `Bearer ${signedAccessToken}`)
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) done.fail(err);
                    scope.done();
                    expect(res.body.message).toEqual('Update successful');

                    models.Organization.findOne({ where: { id: organization.id }, include: ['members'] }).then(results => {
                      expect(results.members.length).toEqual(2);
                      expect(results.members[1].name).toEqual(anotherAgent.name);
                      expect(results.members[1].email).toEqual(anotherAgent.email);
                      done();
                    }).catch(err => {
                      done.fail(err);
                    });
                  });
              });

              it('sends an email to notify agent of new membership', function(done) {
                expect(mailer.transport.sentMail.length).toEqual(0);
                request(app)
                  .patch('/organization')
                  .send({
                    id: organization.id,
                    email: anotherAgent.email
                  })
                  .set('Accept', 'application/json')
                  .set('Authorization', `Bearer ${signedAccessToken}`)
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) done.fail(err);
                    scope.done();
                    expect(mailer.transport.sentMail.length).toEqual(1);
                    expect(mailer.transport.sentMail[0].data.to).toEqual(anotherAgent.email);
                    expect(mailer.transport.sentMail[0].data.from).toEqual(process.env.NOREPLY_EMAIL);
                    expect(mailer.transport.sentMail[0].data.subject).toEqual('Identity membership update');
                    expect(mailer.transport.sentMail[0].data.text).toContain(`You are now a member of ${organization.name}`);
                    done();
                  });
              });

              it('removes a member agent when agent provided is currently a member', done => {
                organization.addMember(anotherAgent).then(result => {
                  request(app)
                    .patch('/organization')
                    .send({
                      id: organization.id,
                      email: anotherAgent.email
                    })
                    .set('Accept', 'application/json')
                    .set('Authorization', `Bearer ${signedAccessToken}`)
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end(function(err, res) {
                      if (err) done.fail(err);
                      scope.done();
                      expect(res.body.message).toEqual('Update successful');

                      models.Organization.findOne({ where: { id: organization.id }, include: ['members']}).then(results => {
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
                organization.addMember(anotherAgent).then(result => {
                  request(app)
                    .patch('/organization')
                    .send({
                      id: organization.id,
                      email: anotherAgent.email
                    })
                    .set('Accept', 'application/json')
                    .set('Authorization', `Bearer ${signedAccessToken}`)
                    .expect('Content-Type', /json/)
                    .expect(201)
                    .end(function(err, res) {
                      if (err) done.fail(err);
                      scope.done();
                      expect(mailer.transport.sentMail.length).toEqual(1);
                      expect(mailer.transport.sentMail[0].data.to).toEqual(anotherAgent.email);
                      expect(mailer.transport.sentMail[0].data.from).toEqual(process.env.NOREPLY_EMAIL);
                      expect(mailer.transport.sentMail[0].data.subject).toEqual('Identity membership update');
                      expect(mailer.transport.sentMail[0].data.text).toContain(`You are no longer a member of ${organization.name}`);
                      done();
                    });
                }).catch(err => {
                  done.fail(err);
                });
              });

              it('adds record if member agent doesn\'t exist', done => {
                request(app)
                  .patch('/organization')
                  .send({
                    id: organization.id,
                    email: 'someunknownagent@example.com'
                  })
                  .set('Accept', 'application/json')
                  .set('Authorization', `Bearer ${signedAccessToken}`)
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) done.fail(err);
                    expect(res.body.message).toEqual('Update successful');

                    models.Agent.findOne({ where: { email: 'someunknownagent@example.com' } }).then(newAgent => {
                      expect(newAgent.name).toBe(null);
                      expect(newAgent.email).toEqual('someunknownagent@example.com');

                      models.Organization.findOne({ where: { id: organization.id }, include: ['members']}).then(results => {
                        expect(results.members.length).toEqual(2);
                        expect(results.members[1].name).toEqual(newAgent.name);
                        expect(results.members[1].email).toEqual(newAgent.email);
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
                request(app)
                  .patch('/organization')
                  .send({
                    id: organization.id,
                    email: 'someunknownagent@example.com'
                  })
                  .set('Accept', 'application/json')
                  .set('Authorization', `Bearer ${signedAccessToken}`)
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) done.fail(err);
                    expect(mailer.transport.sentMail.length).toEqual(1);
                    expect(mailer.transport.sentMail[0].data.to).toEqual('someunknownagent@example.com');
                    expect(mailer.transport.sentMail[0].data.from).toEqual(process.env.NOREPLY_EMAIL);
                    expect(mailer.transport.sentMail[0].data.subject).toEqual('Identity membership update');
                    expect(mailer.transport.sentMail[0].data.text).toContain(`You are now a member of ${organization.name}`);
                    done();
                  });
              });

              it('doesn\'t barf if organization doesn\'t exist', done => {
                request(app)
                  .patch('/organization')
                  .send({
                    id: 111,
                    email: anotherAgent.email
                  })
                  .set('Accept', 'application/json')
                  .set('Authorization', `Bearer ${signedAccessToken}`)
                  .expect('Content-Type', /json/)
                  .expect(404)
                  .end(function(err, res) {
                    if (err) done.fail(err);
                    scope.done();
                    expect(res.body.message).toEqual('No such organization');
                    done();
                  });
              });

              it('doesn\'t allow a non-member agent to add a member', done => {
                let unauthorizedToken = jwt.sign({ ..._access, sub: 'auth0|888888' }, prv, { algorithm: 'RS256', expiresIn: '1h', header: { kid: keystore.all()[0].kid } });
                anotherAgent.accessToken = `Bearer ${unauthorizedToken}`;
                anotherAgent.save().then(() => {
                  request(app)
                    .patch('/organization')
                    .send({
                      id: organization.id,
                      email: anotherAgent.email
                    })
                    .set('Accept', 'application/json')
                    .set('Authorization', `Bearer ${unauthorizedToken}`)
                    .expect('Content-Type', /json/)
                    .expect(403)
                    .end(function(err, res) {
                      if (err) done.fail(err);
                      scope.done();
                      expect(res.body.message).toEqual('You are not a member of this organization');
                      done();
                    });
                }).catch(err => {
                  done.fail(err);
                });
              });
            });
          });

          describe('team membership', () => {

            let newTeam, newOrg;
            beforeEach(done => {
              anotherAgent.createOrganization({ name: 'International Association of Vigilante Crime Fighters', creatorId: anotherAgent.id }).then(result => {
                newOrg = result;
                newOrg.createTeam({ name: 'The A-Team', organizationId: newOrg.id, creatorId: agent.id }).then(result => {
                  newTeam = result;
                  done();
                }).catch(err => {
                  done.fail(err);
                });
              });
            });

            it('adds a team when the organization isn\'t currently a participant', done => {
              request(app)
                .patch('/organization')
                .send({
                  id: organization.id,
                  teamId: newTeam.id
                })
                .set('Accept', 'application/json')
                .set('Authorization', `Bearer ${signedAccessToken}`)
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) done.fail(err);
                  scope.done();
                  expect(res.body.message).toEqual('Update successful');

                  models.Organization.findOne({ where: { id: organization.id }, include: ['teams'] }).then(results => {
                    expect(results.teams.length).toEqual(1);
                    expect(results.teams[0].name).toEqual('The A-Team');
                    done();
                  }).catch(err => {
                    done.fail(err);
                  });
                });
            });

            it('removes a team when the organization is a current participant', done => {
              organization.addTeam(newTeam).then(result => {
                request(app)
                  .patch('/organization')
                  .send({
                    id: organization.id,
                    teamId: newTeam.id
                  })
                  .set('Accept', 'application/json')
                  .set('Authorization', `Bearer ${signedAccessToken}`)
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) done.fail(err);
                    scope.done();
                    expect(res.body.message).toEqual('Update successful');

                    models.Organization.findOne({ where: { id: organization.id }, include: ['teams'] }).then(results => {
                      expect(results.teams.length).toEqual(0);
                      done();
                    }).catch(err => {
                      done.fail(err);
                    });
                  });
              }).catch(err => {
                done.fail(err);
              });
            });

            it('doesn\'t barf if team doesn\'t exist', done => {
              request(app)
                .patch('/organization')
                .send({
                  id: organization.id,
                  teamId: 333
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

            it('doesn\'t barf if organization doesn\'t exist', done => {
              request(app)
                .patch('/organization')
                .send({
                  id: 333,
                  teamId: newTeam
                })
                .set('Accept', 'application/json')
                .set('Authorization', `Bearer ${signedAccessToken}`)
                .expect('Content-Type', /json/)
                .expect(404)
                .end(function(err, res) {
                  if (err) done.fail(err);
                  scope.done();
                  expect(res.body.message).toEqual('No such organization');
                  done();
                });
            });

            it('doesn\'t allow a non-member agent to add a team', done => {
              let unauthorizedToken = jwt.sign({ ..._access, sub: 'auth0|888888' }, prv, { algorithm: 'RS256', expiresIn: '1h', header: { kid: keystore.all()[0].kid } });
              anotherAgent.accessToken = `Bearer ${unauthorizedToken}`;
              anotherAgent.save().then(() => {
                request(app)
                  .patch('/organization')
                  .send({
                    id: organization.id,
                    teamId: newTeam.id
                  })
                  .set('Accept', 'application/json')
                  .set('Authorization', `Bearer ${unauthorizedToken}`)
                  .expect('Content-Type', /json/)
                  .expect(403)
                  .end(function(err, res) {
                    if (err) done.fail(err);
                    scope.done();
                    expect(res.body.message).toEqual('You are not a member of this organization');
                    done();
                  });
              }).catch(err => {
                done.fail(err);
              });
            });
          });
        });
      });

      describe('delete', () => {
        it('removes an existing record from the database', done => {
          request(app)
            .delete('/organization')
            .send({
              id: organization.id,
            })
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${signedAccessToken}`)
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) done.fail(err);
              scope.done();
              expect(res.body.message).toEqual('Organization deleted');
              done();
            });
        });

        it('doesn\'t barf if organization doesn\'t exist', done => {
          request(app)
            .delete('/organization')
            .send({
              id: 111,
            })
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${signedAccessToken}`)
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) done.fail(err);
              scope.done();
              expect(res.body.message).toEqual('No such organization');
              done();
            });
        });
      });
    });

    describe('unauthorized', () => {

      let suspiciousToken;
      beforeEach(done => {
        suspiciousToken = jwt.sign({ ..._access, sub: 'auth0|888888' }, prv, { algorithm: 'RS256', expiresIn: '1h', header: { kid: keystore.all()[0].kid } });

        models.Agent.create({ email: 'suspiciousagent@example.com', accessToken: `Bearer ${suspiciousToken}` }).then(a => {
          done();
        }).catch(err => {
          done.fail(err);
        });
      });

      describe('update', () => {
        describe('PUT', () => {
          it('returns 403', done => {
            request(app)
              .put('/organization')
              .send({
                id: organization.id,
                name: 'Some Cool Guy'
              })
              .set('Accept', 'application/json')
              .set('Authorization', `Bearer ${suspiciousToken}`)
              .expect('Content-Type', /json/)
              .expect(403)
              .end(function(err, res) {
                if (err) done.fail(err);
                scope.done();
                expect(res.body.message).toEqual('Unauthorized: Invalid token');
                done();
              });
          });

          it('does not change the record in the database', done => {
            request(app)
              .put('/organization')
              .send({
                id: organization.id,
                name: 'Some Cool Guy'
              })
              .set('Accept', 'application/json')
              .set('Authorization', `Bearer ${suspiciousToken}`)
              .expect('Content-Type', /json/)
              .expect(403)
              .end(function(err, res) {
                if (err) done.fail(err);
                scope.done();
                models.Organization.findOne({ where: { id: organization.id }}).then(results => {
                  expect(results.name).toEqual(organization.name);
                  done();
                }).catch(err => {
                  done.fail(err);
                });
              });
          });
        });

        describe('PATCH', () => {
          it('returns 403', done => {
            request(app)
              .patch('/organization')
              .send({
                id: organization.id,
                memberId: 333
              })
              .set('Accept', 'application/json')
              .set('Authorization', `Bearer ${suspiciousToken}`)
              .expect('Content-Type', /json/)
              .expect(403)
              .end(function(err, res) {
                if (err) done.fail(err);
                scope.done();
                expect(res.body.message).toEqual('You are not a member of this organization');
                done();
              });
          });

          it('does not change the record in the database', done => {
            request(app)
              .patch('/organization')
              .send({
                id: organization.id,
                memberId: 333
              })
              .set('Accept', 'application/json')
              .set('Authorization', `Bearer ${suspiciousToken}`)
              .expect('Content-Type', /json/)
              .expect(403)
              .end(function(err, res) {
                if (err) done.fail(err);
                scope.done();
                models.Organization.findOne({ where: { id: organization.id }, include: ['members'] }).then(results => {
                  expect(results.members.length).toEqual(1);
                  done();
                }).catch(err => {
                  done.fail(err);
                });
              });
          });
        });
      });

      describe('read', () => {
        it('returns 403 on organization show', done => {
          request(app)
            .get(`/organization/${organization.id}`)
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${suspiciousToken}`)
            .expect('Content-Type', /json/)
            .expect(403)
            .end(function(err, res) {
              if (err) done.fail(err);
              scope.done();
              expect(res.body.message).toEqual('You are not a member of that organization');
              done();
            });
        });
      });

      describe('delete', () => {
        it('returns 401', done => {
          request(app)
            .delete('/organization')
            .send({
              id: organization.id
            })
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
          models.Organization.findAll().then(results => {
            expect(results.length).toEqual(1);

            request(app)
              .delete('/organization')
              .send({
                id: organization.id
              })
              .set('Accept', 'application/json')
              .set('Authorization', `Bearer ${suspiciousToken}`)
              .expect('Content-Type', /json/)
              .expect(401)
              .end(function(err, res) {
                if (err) done.fail(err);
                scope.done();
                models.Organization.findAll().then(results => {
                  expect(results.length).toEqual(1);
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
        .get('/organization')
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
        .get('/organization')
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
