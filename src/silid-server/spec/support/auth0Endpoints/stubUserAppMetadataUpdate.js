const nock = require('nock');
const querystring = require('querystring');
const apiScope = require('../../../config/apiPermissions');
const jwt = require('jsonwebtoken');
const stubOauthToken =  require('./stubOauthToken');

const _profile = require('../../fixtures/sample-auth0-profile-response');

/**
 * Update an agent's user_metadata
 *
 * @param array
 * @param function
 */
module.exports = function(done) {

  require('../setupKeystore').then(singleton => {
    let { pub, prv, keystore } = singleton.keyStuff;

    stubOauthToken([apiScope.update.users, apiScope.read.usersAppMetadata, apiScope.update.usersAppMetadata], (err, oauthScopes) => {
      if (err) return done(err);

      ({accessToken, oauthTokenScope} = oauthScopes);

      const userAppMetadataUpdateOauthTokenScope = oauthTokenScope;

      /**
       * General user_metadata update endpoint stub 
       *
       * PATCH `/users`
       */
      const userAppMetadataUpdateScope = nock(`https://${process.env.AUTH0_DOMAIN}`, { reqheaders: { authorization: `Bearer ${accessToken}`} })
        .log(console.log)
        .patch(/api\/v2\/users\/.+/)
        .reply(201, (uri, requestBody) => {
          _profile.user_metadata = {...requestBody.user_metadata};

          return _profile;
        });

        done(null, {userAppMetadataUpdateScope, userAppMetadataUpdateOauthTokenScope});

    });
  });
};
