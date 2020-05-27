const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001;
const app = require('../../../app');
const fixtures = require('sequelize-fixtures');
const models = require('../../../models');
const request = require('supertest');
const stubAuth0Sessions = require('../../support/stubAuth0Sessions');
const stubAuth0ManagementApi = require('../../support/stubAuth0ManagementApi');
const stubUserRead = require('../../support/auth0Endpoints/stubUserRead');
const mailer = require('../../../mailer');
const { uuid } = require('uuidv4');

/**
 * 2019-11-13
 * Sample tokens taken from:
 *
 * https://auth0.com/docs/api-auth/tutorials/adoption/api-tokens
 */
const _identity = require('../../fixtures/sample-auth0-identity-token');
const _profile = require('../../fixtures/sample-auth0-profile-response');

describe('root/organizationMembershipSpec', () => {

  let login, pub, prv, keystore;
  beforeAll(done => {
    stubAuth0Sessions((err, sessionStuff) => {
      if (err) return done.fail(err);
      ({ login, pub, prv, keystore } = sessionStuff);
      done();
    });
  });

  let originalProfile;
  afterEach(() => {
    mailer.transport.sentMail = [];
    // Through the magic of node I am able to adjust the profile data returned.
    // This resets the default values
    _profile.email = originalProfile.email;
  });

  let root, organization, agent;
  beforeEach(done => {
    originalProfile = {..._profile};
    _profile.email = process.env.ROOT_AGENT;

    models.sequelize.sync({force: true}).then(() => {
      fixtures.loadFile(`${__dirname}/../../fixtures/agents.json`, models).then(() => {
        models.Agent.findAll().then(results => {
          agent = results[0];
          fixtures.loadFile(`${__dirname}/../../fixtures/organizations.json`, models).then(() => {
            models.Organization.findAll().then(results => {
              organization = results[0];
              models.Agent.create({ email: process.env.ROOT_AGENT }).then(results => {
                root = results;
                expect(root.isSuper).toBe(true);
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

  describe('authorized', () => {
    let rootSession;
    beforeEach(done => {
      stubAuth0ManagementApi((err, apiScopes) => {
        if (err) return done.fail(err);

        login({..._identity, email: process.env.ROOT_AGENT, name: 'Professor Fresh'}, (err, session) => {
          if (err) return done.fail(err);
          rootSession = session;

          // Cached profile doesn't match "live" data, so agent needs to be updated
          // with a call to Auth0
          stubUserRead((err, apiScopes) => {
            if (err) return done.fail();

            done();
          });
        });
      });
    });

    describe('create', () => {
      describe('unknown agent', () => {
        it('returns the agent added to the membership', done => {
          models.Organization.findAll({ include: [ 'creator', { model: models.Agent, as: 'members' } ] }).then(results => {
            expect(results.length).toEqual(1);
            expect(results[0].members.length).toEqual(1);

            rootSession
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

            rootSession
              .put(`/organization/${organization.id}/agent`)
              .send({
                email: 'somebrandnewguy@example.com'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);

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

            rootSession
              .put(`/organization/${organization.id}/agent`)
              .send({
                email: 'somebrandnewguy@example.com'
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);

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
          rootSession
            .put(`/organization/${organization.id}/agent`)
            .send({
              email: 'somebrandnewguy@example.com'
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

                rootSession
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
          rootSession
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
              rootSession
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

            rootSession
              .put(`/organization/${organization.id}/agent`)
              .send({
                email: knownAgent.email
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) return done.fail(err);
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

            rootSession
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
          rootSession
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
              stubUserRead((err, apiScopes) => {
                if (err) return done.fail();

                rootSession
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
          rootSession
            .put('/organization/333/agent')
            .send({
              email: knownAgent.email
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
              rootSession
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

      it('removes an existing member record from the organization', done => {
        rootSession
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
        rootSession
          .delete(`/organization/333/agent/${knownAgent.id}`)
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .expect(404)
          .end(function(err, res) {
            if (err) return done.fail(err);
            expect(res.body.message).toEqual('No such organization');
            done();
          });
      });

      it('doesn\'t barf if the agent doesn\'t exist', done => {
        rootSession
          .delete(`/organization/${organization.id}/agent/333`)
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .expect(404)
          .end(function(err, res) {
            if (err) return done.fail(err);
            expect(res.body.message).toEqual('That agent is not a member');
            done();
          });
      });

      it('sends an email to notify agent of membership revocation', function(done) {
        expect(mailer.transport.sentMail.length).toEqual(0);
        organization.addMember(knownAgent).then(result => {
          rootSession
            .delete(`/organization/${organization.id}/agent/${knownAgent.id}`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) return done.fail(err);
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
});
