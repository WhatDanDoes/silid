const nock = require('nock');
const querystring = require('querystring');
const apiScope = require('../../../config/apiPermissions');
const jwt = require('jsonwebtoken');
const stubOauthToken =  require('./stubOauthToken');

const _profile = require('../../fixtures/sample-auth0-profile-response');

/**
 * This stubs the Auth0 endpoint that returns agent profile info
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
    options = { status: 200 };
  }

  require('../setupKeystore').then(singleton => {
    let { pub, prv, keystore } = singleton.keyStuff;

    stubOauthToken([apiScope.read.users], (err, oauthScopes) => {
      if (err) return done(err);

      ({accessToken, oauthTokenScope} = oauthScopes);

      /**
       * GET `/users/:id`. Get a single user by Auth0 ID
       */
      const userReadScope = nock(`https://${process.env.AUTH0_DOMAIN}`, { reqheaders: { authorization: `Bearer ${accessToken}`} })
        .log(console.log)
        .get(/api\/v2\/users\/[\w-%]+$/)
        .query({})
        .reply(options.status, (uri, requestBody) => {
          return profile || _profile;
        });

      done(null, {userReadScope, oauthTokenScope});

    });
  });
};
