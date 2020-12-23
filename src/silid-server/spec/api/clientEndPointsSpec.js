const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001;
const app = require('../../app');
const request = require('supertest');

const stubAuth0Sessions = require('../support/stubAuth0Sessions');
const stubAuth0ManagementApi = require('../support/stubAuth0ManagementApi');

/**
 * 2019-11-13
 * Sample tokens taken from:
 *
 * https://auth0.com/docs/api-auth/tutorials/adoption/api-tokens
 */
const _identity = { ...require('../fixtures/sample-auth0-identity-token'), iss: `https://${process.env.AUTH0_DOMAIN}/`};

describe('client end points', () => {
  describe('/', () => {
    describe('not authenticated', () => {
      it('returns successfully', done => {
        request(app)
          .get('/')
          .set('Accept', 'text/html')
          .expect('Content-Type', /html/)
          .expect(200)
          .end(function(err, res) {
            if (err) return done.fail(err);
            expect(res.text).toMatch('Login');
            done();
          });
      });
    });

    describe('authenticated', () => {
      let login, pub, prv, keystore;
      beforeAll(done => {
        stubAuth0Sessions((err, sessionStuff) => {
          if (err) return done.fail(err);
          ({ login, pub, prv, keystore } = sessionStuff);
          done();
        });
      });

      let authenticatedSession;
      beforeEach(done => {
        stubAuth0ManagementApi((err, apiScopes) => {
          if (err) return done.fail(err);

          login(_identity, (err, session) => {
            if (err) return done.fail(err);
            authenticatedSession = session;
            done();
          });
        });
      });

      it('returns successfully', done => {
        authenticatedSession
          .get('/')
          .set('Accept', 'text/html')
          .expect('Content-Type', /html/)
          .expect(200)
          .end(function(err, res) {
            if (err) return done.fail(err);
            expect(res.text).toMatch('Logout');
            done();
          });
      });
    });
  });
});
