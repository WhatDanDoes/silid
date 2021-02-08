const nock = require('nock');
const querystring = require('querystring');
const apiScope = require('../../../config/apiPermissions');
const jwt = require('jsonwebtoken');
const stubOauthToken =  require('./stubOauthToken');

const _profile = require('../../fixtures/sample-auth0-profile-response');

/**
 * This stubs the Auth0 endpoint that searches by email and returns agent profile info
 *
 * @param array
 * @param function
 */
module.exports = function(res, done) {

  if (typeof res === 'function') {
    done = res;
    res = [_profile];
  }

  require('../setupKeystore').then(singleton => {
    let { pub, prv, keystore } = singleton.keyStuff;

    stubOauthToken([apiScope.read.users], (err, oauthScopes) => {
      if (err) return done(err);

      ({accessToken, oauthTokenScope} = oauthScopes);

      const userReadByEmailOauthTokenScope = oauthScopes;

      /**
       * GET `/users/:id`. Get a single user by Auth0 ID
       */
      const userReadByEmailScope = nock(`https://${process.env.AUTH0_M2M_DOMAIN}`, { reqheaders: { authorization: `Bearer ${accessToken}`} })
        .log(console.log)
        .get(/api\/v2\/users-by-email\?.+/)
        .reply(200, res);

      done(null, {userReadByEmailScope, userReadByEmailOauthTokenScope});

    });
  });
};
