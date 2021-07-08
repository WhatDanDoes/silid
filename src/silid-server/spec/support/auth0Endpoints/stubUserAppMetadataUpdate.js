const nock = require('nock');
const querystring = require('querystring');
const apiScope = require('../../../config/apiPermissions');
const jwt = require('jsonwebtoken');
const stubOauthToken =  require('./stubOauthToken');

const _profile = require('../../fixtures/sample-auth0-profile-response');

/**
 * Update an agent's user_metadata
 *
 * @param object
 * @param function
 * @param object
 */
module.exports = function(profile, done, options) {

  if (typeof profile === 'function') {
    if (typeof done === 'object') {
      options = done;
    }
    done = profile;
    profile = null;
  }

  if (!options) {
    options = { status: 201 };
  }

  require('../setupKeystore').then(singleton => {
    let { pub, prv, keystore } = singleton.keyStuff;

    stubOauthToken([apiScope.read.users, apiScope.read.usersAppMetadata, apiScope.update.usersAppMetadata], (err, oauthScopes) => {
      if (err) return done(err);

      ({accessToken, oauthTokenScope: userAppMetadataUpdateOauthTokenScope} = oauthScopes);

      /**
       * General user_metadata update endpoint stub
       *
       * PATCH `/users`
       */
      const userAppMetadataUpdateScope = nock(`https://${process.env.AUTH0_M2M_DOMAIN}`, { reqheaders: { authorization: `Bearer ${accessToken}`} })
        .patch(/api\/v2\/users\/.+/)
        .reply(options.status, (uri, requestBody) => {

          if (profile) {
            profile.user_metadata = {...requestBody.user_metadata};
          }
          else {
            _profile.user_metadata = {...requestBody.user_metadata};
          }

          // Be very careful here... this is manipulating a value in a wide scope
          return profile || _profile;
        });

      done(null, {userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope});

    });
  });
};
