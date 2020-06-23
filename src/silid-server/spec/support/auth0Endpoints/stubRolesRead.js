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

    stubOauthToken([apiScope.read.roles], (err, oauthScopes) => {
      if (err) return done(err);

      ({accessToken, oauthTokenScope} = oauthScopes);

        const rolesReadOauthTokenScope = oauthTokenScope;

        /**
         * GET `/roles`
         *
         * 2020-6-23
         *
         * The default roles defined below match those defined at Auth0 (actual `id`s will vary)
         */
        const rolesReadScope = nock(`https://${process.env.AUTH0_DOMAIN}`, { reqheaders: { authorization: `Bearer ${accessToken}`} })
          .log(console.log)
          .get('/api/v2/roles')
          .reply(200, [
            {
              "id": "123",
              "name": "organizer",
              "description": "Manage organizations and team memberships therein"
            },
            {
              "id": "234",
              "name": "sudo",
              "description": "All-access pass to Identity resources"
            },
            {
              "id": "345",
              "name": "viewer",
              "description": "Basic agent, organization, and team viewing permissions"
            }
          ]);

        done(null, {rolesReadScope, rolesReadOauthTokenScope});
    });
  });
};
