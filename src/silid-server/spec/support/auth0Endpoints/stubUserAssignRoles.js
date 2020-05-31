const nock = require('nock');
const querystring = require('querystring');
const apiScope = require('../../../config/apiPermissions');
const jwt = require('jsonwebtoken');
const stubOauthToken =  require('./stubOauthToken');

const _profile = require('../../fixtures/sample-auth0-profile-response');

/**
 * This stubs the Auth0 endpoint that updates and agent's roles 
 *
 * @param array
 * @param function
 */
module.exports = function(done) {

  require('../setupKeystore').then(singleton => {
    let { pub, prv, keystore } = singleton.keyStuff;

    stubOauthToken([apiScope.read.roles, apiScope.update.users], (err, oauthScopes) => {
      if (err) return done(err);

      ({accessToken, oauthTokenScope} = oauthScopes);

        const userAssignRolesOauthTokenScope = oauthTokenScope;

        /**
         * POST `/api/v2/users/:id/roles/`
         */
        const userAssignRolesScope = nock(`https://${process.env.AUTH0_DOMAIN}`, { reqheaders: { authorization: `Bearer ${accessToken}`} })
          .log(console.log)
          .post(/api\/v2\/users\/.+\/roles/, {
                                  'roles': /.+/i,
          })
          .reply(200, { });

        done(null, {userAssignRolesScope, userAssignRolesOauthTokenScope});
    });
  });
};
