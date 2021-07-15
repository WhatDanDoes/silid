const nock = require('nock');
const querystring = require('querystring');
const apiScope = require('../../../config/apiPermissions');
const jwt = require('jsonwebtoken');
const stubOauthToken =  require('./stubOauthToken');

const _profile = require('../../fixtures/sample-auth0-profile-response');

/**
 * Link a secondary agent account to the primary
 *
 * @param object - primary profile
 * @param object - secondary profile
 * @param object - options
 * @param function
 */
module.exports = function(primary, secondary, options, done) {

  if (typeof options === 'function') {
    done = options;
    options = { status: 201 };
  }

  require('../setupKeystore').then(singleton => {
    let { pub, prv, keystore } = singleton.keyStuff;

    stubOauthToken([apiScope.update.users], (err, oauthScopes) => {
      if (err) return done(err);

      ({accessToken, oauthTokenScope: userLinkAccountOauthTokenScope} = oauthScopes);

      // Assumes only a single identity in the secondary account
      const body = {
        'provider': secondary.identities[0].provider,
        // 2021-7-14 Docs say this should be `connection_id`: https://auth0.github.io/node-auth0/module-management.ManagementClient.html#linkUsers
        'connection': secondary.identities[0].connection,
        'user_id': secondary.identities[0].user_id,
      };

      const url = `/api/v2/users/${encodeURIComponent(primary.user_id)}/identities`;
      const userLinkAccountScope = nock(`https://${process.env.AUTH0_M2M_DOMAIN}`, { reqheaders: { authorization: `Bearer ${accessToken}`} })
        .post(url, body)
        .reply(options.status, (uri, requestBody) => {

          if (options.status === 201) {

            // Again, assuming only single identities in the accounts to be linked
            return [
              {
                ...primary.identities[0],
              },
              {
                ...secondary.identities[0],
                profileData: {
                  email: secondary.email,
                  email_verified: secondary.email_verified,
                  name: secondary.name,
                  username: secondary.username,
                  given_name: secondary.given_name,
                  phone_number: secondary.phone_number,
                  phone_verified: secondary.phone_verified,
                  family_name: secondary.family_name,
                }
              }
            ];
          }

          return { message: { error_description: 'Some error occurred' } };
        });

      done(null, {userLinkAccountScope, userLinkAccountOauthTokenScope});
    });
  });
};
