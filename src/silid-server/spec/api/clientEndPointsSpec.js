const PORT = process.env.NODE_ENV === 'production' ? 3000 : 3001;
const app = require('../../app');
const request = require('supertest');

describe('client end points', () => {

  describe('/', () => {
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
});
