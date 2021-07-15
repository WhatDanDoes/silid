const nock = require('nock');
const querystring = require('querystring');
const apiScope = require('../../../config/apiPermissions');
const jwt = require('jsonwebtoken');
const stubOauthToken =  require('./stubOauthToken');

const _profile = require('../../fixtures/sample-auth0-profile-response');

/**
 * Unlink a secondary agent account from the primary
 *
 * @param object - primary profile
 * @param object - options
 * @param function
 */
module.exports = function(primary, options, done) {

  if (typeof options === 'function') {
    done = options;
    options = { status: 200 };
  }

  require('../setupKeystore').then(singleton => {
    let { pub, prv, keystore } = singleton.keyStuff;

    stubOauthToken([apiScope.update.users], (err, oauthScopes) => {
      if (err) return done(err);

      ({accessToken, oauthTokenScope: userUnlinkAccountOauthTokenScope} = oauthScopes);

      const userUnlinkAccountScope = nock(`https://${process.env.AUTH0_M2M_DOMAIN}`, { reqheaders: { authorization: `Bearer ${accessToken}`} })
        .delete(/api\/v2\/users\/.+\/identities\/.+\/.+/)
        .reply(options.status, (uri, requestBody) => {

          if (options.status === 200) {

            // For convenience, and at my peril, I am assuming there's only one
            // other identity in the account to be unlinked
            return [ { ...primary.identities[1] } ];
          }

          return { message: { error_description: 'Some error occurred' } };
        });

      done(null, {userUnlinkAccountScope, userUnlinkAccountOauthTokenScope});
    });
  });
};
