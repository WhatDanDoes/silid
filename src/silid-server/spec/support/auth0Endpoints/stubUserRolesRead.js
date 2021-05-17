const nock = require('nock');
const querystring = require('querystring');
const apiScope = require('../../../config/apiPermissions');
const jwt = require('jsonwebtoken');
const stubOauthToken =  require('./stubOauthToken');

/**
 * This stubs the Auth0 endpoint that retrieves defined roles
 *
 * @param array
 * @param function
 */
module.exports = function(roles, done) {

  if (typeof roles === 'function') {
    done = roles;
    roles = null;
  }

  require('../setupKeystore').then(singleton => {
    let { pub, prv, keystore } = singleton.keyStuff;

    stubOauthToken([apiScope.read.users, apiScope.read.roles], (err, oauthScopes) => {
      if (err) return done(err);

      const {accessToken, oauthTokenScope: userRolesReadOauthTokenScope} = oauthScopes;

      /**
       * GET `/roles`
       */
      const userRolesReadScope = nock(`https://${process.env.AUTH0_M2M_DOMAIN}`, { reqheaders: { authorization: `Bearer ${accessToken}`} })
        .get(/api\/v2\/users\/.+\/roles/)
        .reply(200, roles || [
          {
            "id": "345",
            "name": "viewer",
            "description": "Basic agent, organization, and team viewing permissions"
          }
        ]);

      done(null, {userRolesReadScope, userRolesReadOauthTokenScope});
    });
  });
};
