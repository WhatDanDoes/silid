const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001;
const app = require('../../app');
const fixtures = require('sequelize-fixtures');
const models = require('../../models');
const jwt = require('jsonwebtoken');
const request = require('supertest');

describe('organizationSpec', () => {

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

    let token;
    beforeEach(done => {
      token = jwt.sign({ email: agent.email, iat: Math.floor(Date.now()) }, process.env.SECRET, { expiresIn: '1h' });
      done();
    });

    describe('authorized', () => {

      describe('create', () => {
        it('adds a new record to the database', done => {
          models.Organization.findAll().then(results => {
            expect(results.length).toEqual(1);

            request(app)
              .post('/organization')
              .send({
                token: token,
                name: 'One Book Canada' 
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(201)
              .end(function(err, res) {
                if (err) done.fail(err);
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

        it('returns an error if record already exists', done => {
          request(app)
            .post('/organization')
            .send({
              token: token,
              name: organization.name 
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) done.fail(err);
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
            .send({ token: token })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) done.fail(err);
              expect(res.body.email).toEqual(organization.email);
              done();
            });
        });

        it('doesn\'t barf if record doesn\'t exist', done => {
          request(app)
            .get('/organization/33')
            .send({ token: token })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) done.fail(err);
              expect(res.body.message).toEqual('No such organization');
              done();
            });
        });
      });
 
      describe('update', () => {
        it('updates an existing record in the database', done => {
          request(app)
            .put('/organization')
            .send({
              token: token,
              id: organization.id,
              name: 'Some Cool Guy'
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(201)
            .end(function(err, res) {
              if (err) done.fail(err);
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
              token: token,
              id: 111,
              name: 'Some Guy' 
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) done.fail(err);
              expect(res.body.message).toEqual('No such organization');
              done();
            });
        });
      });

      describe('delete', () => {
        it('removes an existing record from the database', done => {
          request(app)
            .delete('/organization')
            .send({
              token: token,
              id: organization.id,
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) done.fail(err);
              expect(res.body.message).toEqual('Organization deleted');
              done();
            });
        });

        it('doesn\'t barf if organization doesn\'t exist', done => {
          request(app)
            .delete('/organization')
            .send({
              token: token,
              id: 111,
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(200)
            .end(function(err, res) {
              if (err) done.fail(err);
              expect(res.body.message).toEqual('No such organization');
              done();
            });
        });
      });
    });

    describe('unknown', () => {
      let newToken;
      beforeEach(done => {
        newToken = jwt.sign({ email: 'brandneworganization@example.com', iat: Math.floor(Date.now()) }, process.env.SECRET, { expiresIn: '1h' });
        done();
      });

      describe('create', () => {
        it('returns 500', done => {
          request(app)
            .post('/organization')
            .send({
              token: newToken,
              name: 'One Book Canada' 
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(500)
            .end(function(err, res) {
              if (err) done.fail(err);
              expect(res.body.errors.length).toEqual(1);
              expect(res.body.errors[0].message).toEqual('Organization.creatorId cannot be null');

              done();
            });
        });

        it('does not add a new record to the database', done => {
          models.Organization.findAll().then(results => {
            expect(results.length).toEqual(1);

            request(app)
              .post('/organization')
              .send({
                token: newToken,
                name: 'One Book Canada' 
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(500)
              .end(function(err, res) {
                if (err) done.fail(err);
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

    describe('unauthorized', () => {

      let wrongToken;
      beforeEach(done => {
        wrongToken = jwt.sign({ email: 'unauthorizedorganization@example.com', iat: Math.floor(Date.now()) }, process.env.SECRET, { expiresIn: '1h' });
        done();
      });

      describe('update', () => {
        it('returns 401', done => {
          request(app)
            .put('/organization')
            .send({
              token: wrongToken,
              id: organization.id,
              name: 'Some Cool Guy'
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(401)
            .end(function(err, res) {
              if (err) done.fail(err);
              expect(res.body.message).toEqual('Unauthorized: Invalid token');
              done();
            });
        });

        it('does not change the record in the database', done => {
          request(app)
            .put('/organization')
            .send({
              token: wrongToken,
              id: organization.id,
              name: 'Some Cool Guy'
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(401)
            .end(function(err, res) {
              if (err) done.fail(err);
              models.Organization.findOne({ where: { id: organization.id }}).then(results => {
                expect(results.name).toEqual(organization.name);
                done();
              }).catch(err => {
                done.fail(err);
              });
            });
        });
      });

      describe('delete', () => {
        it('returns 401', done => {
          request(app)
            .delete('/organization')
            .send({
              token: wrongToken,
              id: organization.id
            })
            .set('Accept', 'application/json')
            .expect('Content-Type', /json/)
            .expect(401)
            .end(function(err, res) {
              if (err) done.fail(err);
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
                token: wrongToken,
                id: organization.id
              })
              .set('Accept', 'application/json')
              .expect('Content-Type', /json/)
              .expect(401)
              .end(function(err, res) {
                if (err) done.fail(err);
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
      const expiredToken = jwt.sign({ email: organization.email, iat: Math.floor(Date.now() / 1000) - (60 * 60) }, process.env.SECRET, { expiresIn: '1h' });
      request(app)
        .get('/organization')
        .send({ token: expiredToken })
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(401)
        .end(function(err, res) {
          if (err) done.fail(err);
          expect(res.body.message).toEqual('Unauthorized: Invalid token');
          done();
        });
    });

    it('returns 401 if provided no token', done => {
      request(app)
        .get('/organization')
        .send({})
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(401)
        .end(function(err, res) {
          if (err) done.fail(err);
          expect(res.body.message).toEqual('Unauthorized: No token provided');
          done();
        });
    });
  });
});
