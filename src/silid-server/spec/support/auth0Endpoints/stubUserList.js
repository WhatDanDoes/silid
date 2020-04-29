const nock = require('nock');
const querystring = require('querystring');
const apiScope = require('../../../config/apiPermissions');
const jwt = require('jsonwebtoken');
const stubOauthToken =  require('./stubOauthToken');

/**
 * This stubs the Auth0 endpoint that provides a list of users
 *
 * @param array
 * @param function
 */
module.exports = function(done) {

  require('../setupKeystore').then(singleton => {
    let { pub, prv, keystore } = singleton.keyStuff;

    stubOauthToken([apiScope.read.users], (err, oauthScopes) => {
      if (err) return done(err);

      ({accessToken, oauthTokenScope} = oauthScopes);

      /**
       * Get a list of Auth0 users
       *
       * GET `/users`
       */
      const userListScope = nock(`https://${process.env.AUTH0_DOMAIN}`, { reqheaders: { authorization: `Bearer ${accessToken}`} })
        .log(console.log)
        .get('/api/v2/users')
        .query({ per_page: 30, include_totals: true, page: /\d+/ })
        .reply(200, (uri, requestBody, cb) => {
          let q = querystring.parse(uri.split('?')[1]);
          cb(null, {...require('../../fixtures/managementApi/userList'), start: parseInt(q.page) });
        });

        done(null, {userListScope, oauthTokenScope});
    });
  });
};
