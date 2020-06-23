const nock = require('nock');
const querystring = require('querystring');
const apiScope = require('../../../config/apiPermissions');
const jwt = require('jsonwebtoken');
const stubOauthToken =  require('./stubOauthToken');

const _profile = require('../../fixtures/sample-auth0-profile-response');

/**
 * This stubs the Auth0 endpoint that retrieves defined roles
 *
 * @param array
 * @param function
 */
module.exports = function(done) {

  require('../setupKeystore').then(singleton => {
    let { pub, prv, keystore } = singleton.keyStuff;

    stubOauthToken([apiScope.read.users, apiScope.read.roles], (err, oauthScopes) => {
      if (err) return done(err);

      ({accessToken, oauthTokenScope} = oauthScopes);

        const userRolesReadOauthTokenScope = oauthTokenScope;

        /**
         * GET `/roles`
         */
        const userRolesReadScope = nock(`https://${process.env.AUTH0_DOMAIN}`, { reqheaders: { authorization: `Bearer ${accessToken}`} })
          .log(console.log)
          .get(/api\/v2\/users\/.+\/roles/)
          .reply(200, [
            {
              "id": "123",
              "name": "viewer",
              "description": "View all roles"
            }
          ]);

        done(null, {userRolesReadScope, userRolesReadOauthTokenScope});
    });
  });
};
