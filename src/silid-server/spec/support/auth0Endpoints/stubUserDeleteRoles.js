const nock = require('nock');
const querystring = require('querystring');
const apiScope = require('../../../config/apiPermissions');
const jwt = require('jsonwebtoken');
const stubOauthToken =  require('./stubOauthToken');

const _profile = require('../../fixtures/sample-auth0-profile-response');

/**
 * This stubs the Auth0 endpoint that deletes an agent's roles
 *
 * @param array - expected role IDs
 * @param function
 */
module.exports = function(expected, done) {

  if (typeof expected === 'function') {
    done = expected;
    expected = null;
  }

  require('../setupKeystore').then(singleton => {
    let { pub, prv, keystore } = singleton.keyStuff;

    stubOauthToken([apiScope.read.roles, apiScope.update.users], (err, oauthScopes) => {
      if (err) return done(err);

      ({accessToken, oauthTokenScope} = oauthScopes);

        const userDeleteRolesOauthTokenScope = oauthTokenScope;

        /**
         * POST `/api/v2/users/:id/roles/`
         */
        const userDeleteRolesScope = nock(`https://${process.env.AUTH0_M2M_DOMAIN}`, { reqheaders: { authorization: `Bearer ${accessToken}`} })
          .log(console.log)
          .delete(/api\/v2\/users\/.+\/roles/, {
                                  'roles': /.+/i,
          })
          .reply((uri, requestBody) => {

            if (expected) {
              if (expected.length !== requestBody.roles.length) {
                return [400, { message: 'Expected role ID parameters do not match' }];
              }
              for (let id of expected) {
                if (requestBody.roles.indexOf(id) < 0) {
                  return [400, { message: 'Expected role ID parameters do not match' }];
                }
              }
            }

            return [200, { message: 'I think this is supposed to return the agent profile data, but Auth0 doesn\'t return anything' }];
          });

        done(null, {userDeleteRolesScope, userDeleteRolesOauthTokenScope});
    });
  });
};
