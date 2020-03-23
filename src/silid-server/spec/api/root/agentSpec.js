const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001;
const app = require('../../../app');
const fixtures = require('sequelize-fixtures');
const models = require('../../../models');
const request = require('supertest');
const stubAuth0Sessions = require('../../support/stubAuth0Sessions');
const scope = require('../../../config/permissions');

/**
 * 2019-11-13
 * Sample tokens taken from:
 *
 * https://auth0.com/docs/api-auth/tutorials/adoption/api-tokens
 */
const _identity = require('../../fixtures/sample-auth0-identity-token');

describe('root/agentSpec', () => {

  let login, pub, prv, keystore;
  beforeAll(done => {
    stubAuth0Sessions((err, sessionStuff) => {
      if (err) return done.fail(err);
      ({ login, pub, prv, keystore } = sessionStuff);
      done();
    });
  });

  let root, agent;
  beforeEach(done => {
    models.sequelize.sync({force: true}).then(() => {

      fixtures.loadFile(`${__dirname}/../../fixtures/agents.json`, models).then(() => {
        models.Agent.findAll().then(results => {
          agent = results[0];
          expect(agent.isSuper).toBe(false);
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
      login({..._identity, email: process.env.ROOT_AGENT}, (err, session) => {
        if (err) return done.fail(err);
        rootSession = session;
        done();
      });
    });

    describe('read', () => {
      describe('/agent', () => {
        it('retrieves root agent\'s info from the database', done => {
          rootSession
            .get('/agent')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) return done.fail(err);

              expect(res.body.email).toEqual(process.env.ROOT_AGENT);
              expect(res.body.name).toEqual('Professor Fresh');
              done();
            });
        });
      });

      describe('/agent/admin', () => {
        it('retrieves all the agents in the database', done => {
          rootSession
            .get(`/agent/admin`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) return done.fail(err);

              expect(res.body.length).toEqual(2);
              done();
            });
        });
      });

      describe('/agent/:id', () => {
        it('retrieves root agent\'s own record from the database', done => {
          rootSession
            .get(`/agent/${root.id}`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) return done.fail(err);

              expect(res.body.email).toEqual(root.email);
              expect(res.body.isSuper).toEqual(true);
              done();
            });
        });

        it('retrieves another agent\'s record from the database', done => {
          rootSession
            .get(`/agent/${agent.id}`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) return done.fail(err);

              expect(res.body.email).toEqual(agent.email);
              expect(res.body.isSuper).toEqual(false);
              done();
            });
        });

        it('doesn\'t barf if record doesn\'t exist', done => {
          rootSession
            .get('/agent/33')
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) done.fail(err);

              expect(res.body.message).toEqual('No such agent');
              done();
            });
        });
      });
    });

    describe('create', () => {
      it('adds a new record to the database', done => {
        models.Agent.findAll().then(results => {
          expect(results.length).toEqual(2);

          rootSession
            .post('/agent')
            .send({
              email: 'someotherguy@example.com'
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) return done.fail(err);

              expect(res.body.email).toEqual('someotherguy@example.com');

              models.Agent.findAll().then(results => {
                expect(results.length).toEqual(3);
                done();
              }).catch(err => {
                done.fail(err);
              });
            });
        }).catch(err => {
          done.fail(err);
        });
      });

      it('returns an error if record already exists', done => {
        rootSession
          .post('/agent')
          .send({
            email: agent.email
          })
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .expect(500)
          .end(function(err, res) {
            if (err) done.fail(err);

            expect(res.body.errors.length).toEqual(1);
            expect(res.body.errors[0].message).toEqual('That agent is already registered');
            done();
          });
      });
    });

    describe('update', () => {
      it('updates an existing record in the database', done => {
        rootSession
          .put('/agent')
          .send({
            id: agent.id,
            name: 'Some Cool Guy'
          })
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .expect(201)
          .end(function(err, res) {
            if (err) return done.fail(err);

            expect(res.body.name).toEqual('Some Cool Guy');

            models.Agent.findOne({ where: { id: agent.id }}).then(results => {
              expect(results.name).toEqual('Some Cool Guy');
              expect(results.email).toEqual(agent.email);
              done();
            }).catch(err => {
              done.fail(err);
            });
          });
      });

      it('allows updating null fields', done => {
        agent.name = null;
        agent.save().then(agent => {
          expect(agent.name).toBeNull();

          rootSession
            .put('/agent')
            .send({
              id: agent.id,
              name: 'Some Cool Guy'
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) return done.fail(err);

              expect(res.body.name).toEqual('Some Cool Guy');

              models.Agent.findOne({ where: { id: agent.id }}).then(results => {
                expect(results.name).toEqual('Some Cool Guy');
                expect(results.email).toEqual(agent.email);
                done();
              }).catch(err => {
                done.fail(err);
              });
            });
        }).catch(err => {
          done.fail(err);
        });
      });

      it('doesn\'t barf if agent doesn\'t exist', done => {
        rootSession
          .put('/agent')
          .send({
            id: 111,
            name: 'Some Guy'
          })
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) done.fail(err);

            expect(res.body.message).toEqual('No such agent');
            done();
          });
      });
    });

    describe('delete', () => {
      it('removes an existing record from the database', done => {
        rootSession
          .delete('/agent')
          .send({
            id: agent.id,
          })
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) return done.fail(err);

            expect(res.body.message).toEqual('Agent deleted');
            done();
          });
      });

      it('doesn\'t barf if agent doesn\'t exist', done => {
        rootSession
          .delete('/agent')
          .send({
            id: 111,
          })
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .expect(200)
          .end(function(err, res) {
            if (err) return done.fail(err);

            expect(res.body.message).toEqual('No such agent');
            done();
          });
      });
    });
  });

  describe('unauthorized', () => {
    let unauthorizedSession;
    beforeEach(done => {
      login({ ..._identity, email: agent.email }, [scope.read.agents], (err, session) => {
        if (err) return done.fail(err);
        unauthorizedSession = session;
        done();
      });
    });

    describe('read', () => {
      describe('/agent/admin', () => {
        it('returns 403 with message', done => {
          unauthorizedSession
            .get(`/agent/admin`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(403)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.message).toEqual('Insufficient scope');
              done();
            });
        });
      });

      describe('/agent/:id', () => {
        it('retrieves root agent\'s record', done => {
          unauthorizedSession
            .get(`/agent/${root.id}`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.email).toEqual(process.env.ROOT_AGENT);
              expect(res.body.name).toEqual('Professor Fresh');

              done();
            });
        });
      });
    });
  });
});
