const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001;
const app = require('../../app');
const fixtures = require('sequelize-fixtures');
const models = require('../../models');
const request = require('supertest');
const stubAuth0Sessions = require('../support/stubAuth0Sessions');
const stubAuth0ManagementApi = require('../support/stubAuth0ManagementApi');
const stubAuth0ManagementEndpoint = require('../support/stubAuth0ManagementEndpoint');
const mailer = require('../../mailer');
const { uuid } = require('uuidv4');
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
  beforeAll(done => {
    stubAuth0Sessions((err, sessionStuff) => {
      if (err) return done.fail(err);
      ({ login, pub, prv, keystore } = sessionStuff);
      done();
    });
  });

  afterEach(() => {
    mailer.transport.sentMail = [];
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
              done();
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
        let authenticatedSession;
        beforeEach(done => {
          stubAuth0ManagementApi((err, apiScopes) => {
            if (err) return done.fail();

            login(_identity, [scope.create.organizationMembers], (err, session) => {
              if (err) return done.fail(err);
              authenticatedSession = session;

              // Cached profile doesn't match "live" data, so agent needs to be updated
              // with a call to Auth0
              stubAuth0ManagementEndpoint([apiScope.read.users], (err, apiScopes) => {
                if (err) return done.fail();

                done();
              });
            });
          });
        });

        describe('unknown agent', () => {
          it('returns the agent added to the membership', done => {
            models.Organization.findAll({ include: [ 'creator', { model: models.Agent, as: 'members' } ] }).then(results => {
              expect(results.length).toEqual(1);
              expect(results[0].members.length).toEqual(1);

              authenticatedSession
                .put(`/organization/${organization.id}/agent`)
                .send({
                  email: 'somebrandnewguy@example.com'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) return done.fail(err);
                  expect(res.body.name).toEqual(null);
                  expect(res.body.email).toEqual('somebrandnewguy@example.com');
                  expect(res.body.id).toBeDefined();

                  done();
                });
            }).catch(err => {
              done.fail(err);
            });
          });

          it('adds a new agent to organization membership', done => {
            models.Organization.findAll({ include: [ 'creator', { model: models.Agent, as: 'members' } ] }).then(results => {
              expect(results.length).toEqual(1);
              expect(results[0].members.length).toEqual(1);

              authenticatedSession
                .put(`/organization/${organization.id}/agent`)
                .send({
                  email: 'somebrandnewguy@example.com'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) done.fail(err);

                  models.Organization.findAll({ include: [ 'creator', { model: models.Agent, as: 'members' } ] }).then(results => {
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

              authenticatedSession
                .put(`/organization/${organization.id}/agent`)
                .send({
                  email: 'somebrandnewguy@example.com'
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) done.fail(err);

                  models.Agent.findOne({ where: { email: 'somebrandnewguy@example.com' } }).then(results => {
                    expect(results.email).toEqual('somebrandnewguy@example.com');
                    expect(results.id).toBeDefined();
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
            authenticatedSession
              .put(`/organization/${organization.id}/agent`)
              .send({
                email: 'somebrandnewguy@example.com'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) done.fail(err);

                // Cached profile doesn't match "live" data, so agent needs to be updated
                // with a call to Auth0
                stubAuth0ManagementEndpoint([apiScope.read.users], (err, apiScopes) => {
                  if (err) return done.fail();

                  authenticatedSession
                    .put(`/organization/${organization.id}/agent`)
                    .send({
                      email: 'somebrandnewguy@example.com'
                    })
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(200)
                    .end(function(err, res) {
                      if (err) done.fail(err);
                      expect(res.body.message).toEqual('somebrandnewguy@example.com is already a member of this organization');
                      done();
                    });
                });
              });
          });

          it('doesn\'t barf if organization doesn\'t exist', done => {
            authenticatedSession
              .put('/organization/333/agent')
              .send({
                email: 'somebrandnewguy@example.com'
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

          describe('email', () => {
            describe('notification', () => {
              it('sends an email to notify agent of new membership', function(done) {
                expect(mailer.transport.sentMail.length).toEqual(0);
                authenticatedSession
                  .put(`/organization/${organization.id}/agent`)
                  .send({
                    email: 'somebrandnewguy@example.com'
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) return done.fail(err);
                    expect(mailer.transport.sentMail.length).toEqual(1);
                    expect(mailer.transport.sentMail[0].data.to).toEqual('somebrandnewguy@example.com');
                    expect(mailer.transport.sentMail[0].data.from).toEqual(process.env.NOREPLY_EMAIL);
                    expect(mailer.transport.sentMail[0].data.subject).toEqual('Identity organization invitation');

                    models.Agent.findOne({ where: { email: 'somebrandnewguy@example.com' } }).then(a => {
                      models.OrganizationMember.findOne({ where: { AgentId: a.id } }).then(results => {
                        expect(mailer.transport.sentMail[0].data.text).toContain(`You have been invited to join ${organization.name}`);
                        expect(mailer.transport.sentMail[0].data.text).toContain(`Click or copy-paste the link below to accept:`);
                        expect(mailer.transport.sentMail[0].data.text).toContain(`${process.env.SERVER_DOMAIN}/verify/${results.verificationCode}`);
                        done();
                      }).catch(err => {
                        done.fail(err);
                      });
                    }).catch(err => {
                      done.fail(err);
                    });
                  });
              });
            });

            describe('verification', () => {
              let verificationUrl, unverifiedMembership;

              beforeEach(done => {
                authenticatedSession
                  .put(`/organization/${organization.id}/agent`)
                  .send({
                    email: 'somebrandnewguy@example.com'
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) return done.fail(err);
                    models.Agent.findOne({ where: { email: 'somebrandnewguy@example.com' } }).then(a => {
                      models.OrganizationMember.findOne({ where: { AgentId: a.id } }).then(results => {

                        unverifiedMembership = results;
                        verificationUrl = `/verify/${results.verificationCode}`;

                        done();
                      }).catch(err => {
                        done.fail(err);
                      });
                    }).catch(err => {
                      done.fail(err);
                    });
                  });
              });

              describe('while authenticated', () => {
                it('nullifies the verification code on click', function(done) {
                  expect(unverifiedMembership.verificationCode).toBeDefined();

                  authenticatedSession
                    .get(verificationUrl)
                    .set('Accept', 'application/json')
                    .expect(302)
                    .end(function(err, res) {
                      if (err) return done.fail(err);

                      models.OrganizationMember.findOne({ where: { AgentId: unverifiedMembership.AgentId } }).then(results => {
                        expect(results.verificationCode).toBe(null);
                        done();
                      }).catch(err => {
                        done.fail(err);
                      });
                    });
                });

                it('redirects to root', function(done) {
                  authenticatedSession
                    .get(verificationUrl)
                    .set('Accept', 'application/json')
                    .expect(302)
                    .end(function(err, res) {
                      if (err) return done.fail(err);

                      expect(res.headers.location).toEqual(`/`);
                      done();
                    });
                });

                it('doesn\'t barf if verificationCode is mangled', function(done) {
                  authenticatedSession
                    .get('/verify/some-mangled-code')
                    .set('Accept', 'application/json')
                    .expect(302)
                    .end(function(err, res) {
                      if (err) return done.fail(err);
                      expect(res.headers.location).toEqual(`/login`);
                      done();
                    });
                });

                it('doesn\'t barf if verificationCode does not exist', function(done) {
                  authenticatedSession
                    .get(`/verify/${uuid()}`)
                    .set('Accept', 'application/json')
                    .expect(302)
                    .end(function(err, res) {
                      if (err) return done.fail(err);
                      expect(res.headers.location).toEqual(`/login`);
                      done();
                    });
                });
              });

              describe('while not authenticated', () => {
                it('nullifies the verification code on click', function(done) {
                  expect(unverifiedMembership.verificationCode).toBeDefined();
                  request(app)
                    .get(verificationUrl)
                    .set('Accept', 'application/json')
                    .expect(302)
                    .end(function(err, res) {
                      if (err) return done.fail(err);

                      models.OrganizationMember.findOne({ where: { AgentId: unverifiedMembership.AgentId } }).then(results => {
                        expect(results.verificationCode).toBe(null);
                        done();
                      }).catch(err => {
                        done.fail(err);
                      });
                    });
                });

                it('redirects to /login', function(done) {
                  request(app)
                    .get(verificationUrl)
                    .set('Accept', 'application/json')
                    .expect(302)
                    .end(function(err, res) {
                      if (err) return done.fail(err);

                      expect(res.headers.location).toEqual(`/login`);
                      done();
                    });
                });

                it('doesn\'t barf if verificationCode is invalid', function(done) {
                  request(app)
                    .get('/verify/some-mangled-code')
                    .set('Accept', 'application/json')
                    .expect(302)
                    .end(function(err, res) {
                      if (err) return done.fail(err);
                      expect(res.headers.location).toEqual(`/login`);
                      done();
                    });
                });
              });
            });
          });
        });

        describe('registered agent', () => {
          let knownAgent;
          beforeEach(done => {
            models.Agent.create({ email: 'weknowthisguy@example.com', name: 'Well-known Guy' }).then(result => {
              knownAgent = result;
              done();
            }).catch(err => {
              done.fail(err);
            });
          });

          it('returns the agent added to the membership', done => {
            models.Organization.findAll({ include: [ 'creator', { model: models.Agent, as: 'members' } ] }).then(results => {
              expect(results.length).toEqual(1);
              expect(results[0].members.length).toEqual(1);

              authenticatedSession
                .put(`/organization/${organization.id}/agent`)
                .send({
                  email: knownAgent.email
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) done.fail(err);
                  expect(res.body.name).toEqual(knownAgent.name);
                  expect(res.body.email).toEqual(knownAgent.email);
                  expect(res.body.id).toEqual(knownAgent.id);

                  done();
                });
            }).catch(err => {
              done.fail(err);
            });
          });

          it('adds the agent to organization membership', done => {
            models.Organization.findAll({ include: [ 'creator', { model: models.Agent, as: 'members' } ] }).then(results => {
              expect(results.length).toEqual(1);
              expect(results[0].members.length).toEqual(1);

              authenticatedSession
                .put(`/organization/${organization.id}/agent`)
                .send({
                  email: knownAgent.email
                })
                .set('Accept', 'application/json')
                .expect('Content-Type', /json/)
                .expect(201)
                .end(function(err, res) {
                  if (err) return done.fail(err);

                  models.Organization.findAll({ include: [ 'creator', { model: models.Agent, as: 'members' } ] }).then(results => {
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
            authenticatedSession
              .put(`/organization/${organization.id}/agent`)
              .send({
                email: knownAgent.email
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);

                // Cached profile doesn't match "live" data, so agent needs to be updated
                // with a call to Auth0
                stubAuth0ManagementEndpoint([apiScope.read.users], (err, apiScopes) => {
                  if (err) return done.fail();

                  authenticatedSession
                    .put(`/organization/${organization.id}/agent`)
                    .send({
                      email: knownAgent.email
                    })
                    .set('Accept', 'application/json')
                    .expect('Content-Type', /json/)
                    .expect(200)
                    .end(function(err, res) {
                      if (err) return done.fail(err);
                      expect(res.body.message).toEqual(`${knownAgent.email} is already a member of this organization`);
                      done();
                    });
                });
              });
          });

          it('doesn\'t barf if organization doesn\'t exist', done => {
            authenticatedSession
              .put('/organization/333/agent')
              .send({
                email: knownAgent.email
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(404)
              .end(function(err, res) {
                if (err) done.fail(err);
                expect(res.body.message).toEqual('No such organization');
                done();
              });
          });

          describe('email', () => {
            describe('notification', () => {
              it('sends an email to notify agent of new membership', function(done) {
                expect(mailer.transport.sentMail.length).toEqual(0);
                authenticatedSession
                  .put(`/organization/${organization.id}/agent`)
                  .send({
                    email: knownAgent.email
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) return done.fail(err);
                    expect(mailer.transport.sentMail.length).toEqual(1);
                    expect(mailer.transport.sentMail[0].data.to).toEqual(knownAgent.email);
                    expect(mailer.transport.sentMail[0].data.from).toEqual(process.env.NOREPLY_EMAIL);
                    expect(mailer.transport.sentMail[0].data.subject).toEqual('Identity organization invitation');

                    models.Agent.findOne({ where: { email: knownAgent.email } }).then(a => {
                      models.OrganizationMember.findOne({ where: { AgentId: a.id } }).then(results => {
                        expect(mailer.transport.sentMail[0].data.text).toContain(`You have been invited to join ${organization.name}`);
                        expect(mailer.transport.sentMail[0].data.text).toContain(`Click or copy-paste the link below to accept:`);
                        expect(mailer.transport.sentMail[0].data.text).toContain(`${process.env.SERVER_DOMAIN}/verify/${results.verificationCode}`);
                        done();
                      }).catch(err => {
                        done.fail(err);
                      });
                    }).catch(err => {
                      done.fail(err);
                    });
                  });
              });
            });

            describe('verification', () => {
              let verificationUrl, unverifiedMembership;

              beforeEach(done => {
                authenticatedSession
                  .put(`/organization/${organization.id}/agent`)
                  .send({
                    email: knownAgent.email
                  })
                  .set('Accept', 'application/json')
                  .expect('Content-Type', /json/)
                  .expect(201)
                  .end(function(err, res) {
                    if (err) return done.fail(err);
                    models.Agent.findOne({ where: { email: knownAgent.email } }).then(a => {
                      models.OrganizationMember.findOne({ where: { AgentId: a.id } }).then(results => {

                        unverifiedMembership = results;
                        verificationUrl = `/verify/${results.verificationCode}`;

                        done();
                      }).catch(err => {
                        done.fail(err);
                      });
                    }).catch(err => {
                      done.fail(err);
                    });
                  });
              });

              describe('while authenticated', () => {
                it('nullifies the verification code on click', function(done) {
                  expect(unverifiedMembership.verificationCode).toBeDefined();

                  authenticatedSession
                    .get(verificationUrl)
                    .set('Accept', 'application/json')
                    .expect(302)
                    .end(function(err, res) {
                      if (err) return done.fail(err);

                      models.OrganizationMember.findOne({ where: { AgentId: unverifiedMembership.AgentId } }).then(results => {
                        expect(results.verificationCode).toBe(null);
                        done();
                      }).catch(err => {
                        done.fail(err);
                      });
                    });
                });

                it('redirects to root', function(done) {
                  authenticatedSession
                    .get(verificationUrl)
                    .set('Accept', 'application/json')
                    .expect(302)
                    .end(function(err, res) {
                      if (err) return done.fail(err);

                      expect(res.headers.location).toEqual(`/`);
                      done();
                    });
                });

                it('doesn\'t barf if verificationCode is mangled', function(done) {
                  authenticatedSession
                    .get('/verify/some-mangled-code')
                    .set('Accept', 'application/json')
                    .expect(302)
                    .end(function(err, res) {
                      if (err) return done.fail(err);
                      expect(res.headers.location).toEqual(`/login`);
                      done();
                    });
                });

                it('doesn\'t barf if verificationCode does not exist', function(done) {
                  authenticatedSession
                    .get(`/verify/${uuid()}`)
                    .set('Accept', 'application/json')
                    .expect(302)
                    .end(function(err, res) {
                      if (err) return done.fail(err);
                      expect(res.headers.location).toEqual(`/login`);
                      done();
                    });
                });
              });

              describe('while not authenticated', () => {
                it('nullifies the verification code on click', function(done) {
                  expect(unverifiedMembership.verificationCode).toBeDefined();
                  request(app)
                    .get(verificationUrl)
                    .set('Accept', 'application/json')
                    .expect(302)
                    .end(function(err, res) {
                      if (err) return done.fail(err);

                      models.OrganizationMember.findOne({ where: { AgentId: unverifiedMembership.AgentId } }).then(results => {
                        expect(results.verificationCode).toBe(null);
                        done();
                      }).catch(err => {
                        done.fail(err);
                      });
                    });
                });

                it('redirects to /login', function(done) {
                  request(app)
                    .get(verificationUrl)
                    .set('Accept', 'application/json')
                    .expect(302)
                    .end(function(err, res) {
                      if (err) return done.fail(err);

                      expect(res.headers.location).toEqual(`/login`);
                      done();
                    });
                });

                it('doesn\'t barf if verificationCode is invalid', function(done) {
                  request(app)
                    .get('/verify/some-mangled-code')
                    .set('Accept', 'application/json')
                    .expect(302)
                    .end(function(err, res) {
                      if (err) return done.fail(err);
                      expect(res.headers.location).toEqual(`/login`);
                      done();
                    });
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
              stubAuth0ManagementEndpoint([apiScope.read.users], (err, apiScopes) => {
                if (err) return done.fail();

                done();
              });
            });
          });
        });

        let knownAgent;
        beforeEach(done => {
          models.Agent.create({ email: 'weknowthisguy@example.com', name: 'Well-known Guy' }).then(result => {
            knownAgent = result;
            organization.addMember(knownAgent).then(result => {
              done();
            }).catch(err => {
              done.fail(err);
            });
          }).catch(err => {
            done.fail(err);
          });
        });

        it('removes an existing member record from the organization', done => {
          authenticatedSession
            .delete(`/organization/${organization.id}/agent/${knownAgent.id}`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.message).toEqual(`Member removed`);
              done();
            });
        });

        it('doesn\'t barf if organization doesn\'t exist', done => {
          authenticatedSession
            .delete(`/organization/333/agent/${knownAgent.id}`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(404)
            .end(function(err, res) {
              if (err) done.fail(err);
              expect(res.body.message).toEqual('No such organization');
              done();
            });
        });

        it('doesn\'t barf if the agent doesn\'t exist', done => {
          authenticatedSession
            .delete(`/organization/${organization.id}/agent/333`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(404)
            .end(function(err, res) {
              if (err) done.fail(err);
              expect(res.body.message).toEqual('That agent is not a member');
              done();
            });
        });

        it('sends an email to notify agent of membership revocation', function(done) {
          expect(mailer.transport.sentMail.length).toEqual(0);
          organization.addMember(knownAgent).then(result => {
            authenticatedSession
              .delete(`/organization/${organization.id}/agent/${knownAgent.id}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) done.fail(err);
                expect(mailer.transport.sentMail.length).toEqual(1);
                expect(mailer.transport.sentMail[0].data.to).toEqual(knownAgent.email);
                expect(mailer.transport.sentMail[0].data.from).toEqual(process.env.NOREPLY_EMAIL);
                expect(mailer.transport.sentMail[0].data.subject).toEqual('Identity membership update');
                expect(mailer.transport.sentMail[0].data.text).toContain(`You are no longer a member of ${organization.name}`);
                done();
              });
          }).catch(err => {
            done.fail(err);
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

            login({ ..._identity, email: suspiciousAgent.email }, [scope.create.organizationMembers], (err, session) => {
              if (err) return done.fail(err);
              forbiddenSession = session;

              // Cached profile doesn't match "live" data, so agent needs to be updated
              // with a call to Auth0
              stubAuth0ManagementEndpoint([apiScope.read.users], (err, apiScopes) => {
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
        it('doesn\'t allow a non-member agent to add a member', done => {
          forbiddenSession
            .put(`/organization/${organization.id}/agent`)
            .send({
              email: suspiciousAgent.email
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(403)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.message).toEqual('You are not a member of this organization');
              done();
            });
        });
      });

      describe('delete', () => {
        let knownAgent;
        beforeEach(done => {
          models.Agent.create({ email: 'weknowthisguy@example.com', name: 'Well-known Guy' }).then(result => {
            knownAgent = result;
            organization.addMember(knownAgent).then(result => {
              done();
            }).catch(err => {
              done.fail(err);
            });
          }).catch(err => {
            done.fail(err);
          });
        });

        it('returns 403', done => {
          forbiddenSession
            .delete(`/organization/${organization.id}/agent/${knownAgent.id}`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(403)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.message).toEqual('Insufficient scope');
              done();
            });
        });

        it('does not remove the record from the database', done => {
          models.Organization.findAll({ include: [ 'creator', { model: models.Agent, as: 'members' } ] }).then(results => {
            expect(results.length).toEqual(1);
            expect(results[0].members.length).toEqual(2);

            forbiddenSession
              .delete(`/organization/${organization.id}/agent/${knownAgent.id}`)
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(403)
              .end(function(err, res) {
                if (err) return done.fail(err);
                models.Organization.findAll({ include: [ 'creator', { model: models.Agent, as: 'members' } ] }).then(results => {
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

    it('redirects to /login', done => {
      request(app)
        .get('/organization')
        .send({ name: 'Some org' })
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
