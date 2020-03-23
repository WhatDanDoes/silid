const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001;
const app = require('../../app');
const fixtures = require('sequelize-fixtures');
const models = require('../../models');
const request = require('supertest');
const stubAuth0Sessions = require('../support/stubAuth0Sessions');
const scope = require('../../config/permissions');

describe('agentSpec', () => {

  /**
   * 2019-11-13
   * Sample tokens taken from:
   *
   * https://auth0.com/docs/api-auth/tutorials/adoption/api-tokens
   */
  const _identity = require('../fixtures/sample-auth0-identity-token');

  let login, pub, prv, keystore;
  beforeAll(done => {
    stubAuth0Sessions((err, sessionStuff) => {
      if (err) return done.fail(err);
      ({ login, pub, prv, keystore } = sessionStuff);
      done();
    });
  });


  let agent;
  beforeEach(done => {
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

  describe('authenticated', () => {

    describe('authorized', () => {

      describe('create', () => {

        let authenticatedSession;
        beforeEach(done => {
          login(_identity, [scope.create.agents], (err, session) => {
            if (err) return done.fail(err);
            authenticatedSession = session;
            done();
          });
        });

        it('adds a new record to the database', done => {
          models.Agent.findAll().then(results => {
            expect(results.length).toEqual(1);

            authenticatedSession
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

        it('returns an error if record already exists', done => {
          authenticatedSession
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

      describe('read', () => {
        let authenticatedSession;
        beforeEach(done => {
          login(_identity, [scope.read.agents], (err, session) => {
            if (err) return done.fail(err);
            authenticatedSession = session;
            done();
          });
        });

        it('retrieves an existing record from the database', done => {
          authenticatedSession
            .get(`/agent/${agent.id}`)
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) return done.fail(err);

              expect(res.body.email).toEqual(agent.email);
              done();
            });
        });

        it('doesn\'t barf if record doesn\'t exist', done => {
          authenticatedSession
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

      describe('update', () => {
        let authenticatedSession;
        beforeEach(done => {
          login(_identity, [scope.update.agents], (err, session) => {
            if (err) return done.fail(err);
            authenticatedSession = session;
            done();
          });
        });

        it('updates an existing record in the database', done => {
          authenticatedSession
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

            authenticatedSession
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
          authenticatedSession
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
        let authenticatedSession;
        beforeEach(done => {
          login(_identity, [scope.delete.agents], (err, session) => {
            if (err) return done.fail(err);
            authenticatedSession = session;
            done();
          });
        });

        it('removes an existing record from the database', done => {
          authenticatedSession
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
          authenticatedSession
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

    describe('forbidden', () => {
      let forbiddenSession;
      beforeEach(done => {
        login({ ..._identity, email: 'someotherguy@example.com', name: 'Some Other Guy' }, (err, session) => {
          if (err) return done.fail(err);
          forbiddenSession = session;
          done();
        });
      });

      describe('update', () => {
        it('returns 403', done => {
          forbiddenSession
            .put('/agent')
            .send({
              id: agent.id,
              name: 'Some Cool Guy'
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(403)
            .end(function(err, res) {
              if (err) return done.fail(err);
              expect(res.body.message).toEqual('Insufficient scope');
              done();
            });
        });

        it('does not change the record in the database', done => {
          forbiddenSession
            .put('/agent')
            .send({
              id: agent.id,
              name: 'Some Cool Guy'
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(403)
            .end(function(err, res) {
              if (err) done.fail(err);
              models.Agent.findOne({ where: { id: agent.id }}).then(results => {
                expect(results.name).toEqual('Some Guy');
                expect(results.email).toEqual(agent.email);
                done();
              }).catch(err => {
                done.fail(err);
              });
            });
        });
      });

      describe('delete', () => {
        it('returns 403', done => {
          forbiddenSession
            .delete('/agent')
            .send({
              id: agent.id
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(403)
            .end(function(err, res) {
              if (err) done.fail(err);
              expect(res.body.message).toEqual('Insufficient scope');
              done();
            });
        });

        it('does not remove the record from the database', done => {
          models.Agent.findAll().then(results => {
            // 2 because the unauthorized agent is in the database
            expect(results.length).toEqual(2);

            forbiddenSession
              .delete('/agent')
              .send({
                id: agent.id
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(403)
              .end(function(err, res) {
                if (err) done.fail(err);
                models.Agent.findAll().then(results => {
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
      });
    });
  });

  describe('unauthenticated', () => {

    it('redirects to login', done => {
      request(app)
        .get('/agent')
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
