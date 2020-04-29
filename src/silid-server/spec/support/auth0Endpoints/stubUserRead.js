const nock = require('nock');
const querystring = require('querystring');
const apiScope = require('../../../config/apiPermissions');
const jwt = require('jsonwebtoken');
const stubOauthToken =  require('./stubOauthToken');

const _profile = require('../../fixtures/sample-auth0-profile-response');

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
       * GET `/users/:id`. Get a single user by Auth0 ID
       */
      const userReadScope = nock(`https://${process.env.AUTH0_DOMAIN}`, { reqheaders: { authorization: `Bearer ${accessToken}`} })
        .log(console.log)
        .get(/api\/v2\/users\/.+/)
        .query({})
        .reply(200, _profile);

        done(null, {userReadScope, oauthTokenScope});

    });
  });
};
