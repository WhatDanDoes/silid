const nock = require('nock');
const querystring = require('querystring');
const apiScope = require('../../../config/apiPermissions');
const jwt = require('jsonwebtoken');
const stubOauthToken =  require('./stubOauthToken');

const _profile = require('../../fixtures/sample-auth0-profile-response');

/**
 * 2020-5-5
 *
 * I'm pretty sure this stub doesn't reflect reality. It satisifies
 * the tests to retrieve a list of a agents's teams, but I'm not
 * 100% sure this will even ever happen in real life.
 *
 *
 * This stubs the Auth0 endpoint that reads a user and his metadata
 *
 * @param object
 * @param function
 */
module.exports = function(profile, done) {

  if (typeof profile === 'function') {
    done = profile;
    profile = null;
  }

  require('../setupKeystore').then(singleton => {
    let { pub, prv, keystore } = singleton.keyStuff;

    stubOauthToken([apiScope.read.users, apiScope.read.usersAppMetadata], (err, oauthScopes) => {
      if (err) return done(err);

      ({accessToken, oauthTokenScope} = oauthScopes);

      const userAppMetadataReadOauthTokenScope = oauthTokenScope;

      /**
       * GET `/users/:id`. Get a single user by Auth0 ID
       */
      const userAppMetadataReadScope = nock(`https://${process.env.AUTH0_DOMAIN}`, { reqheaders: { authorization: `Bearer ${accessToken}`} })
        .log(console.log)
        .get(/api\/v2\/users\/.+/)
        .query({})
        .reply(200, profile || _profile);

        done(null, {userAppMetadataReadScope, userAppMetadataReadOauthTokenScope});

    });
  });
};
