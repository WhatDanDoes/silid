const nock = require('nock');
const querystring = require('querystring');
const apiScope = require('../../../config/apiPermissions');
const jwt = require('jsonwebtoken');
const stubOauthToken =  require('./stubOauthToken');

const _profile = require('../../fixtures/sample-auth0-profile-response');

/**
 * This stubs the Auth0 endpoint that updates agent root profile info
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

    stubOauthToken([apiScope.update.users], (err, oauthScopes) => {
      if (err) return done(err);

      ({accessToken, oauthTokenScope} = oauthScopes);

      const userUpdateOauthTokenScope = oauthTokenScope;

      /**
       * PATCH `/users/:id`. Get a single user by Auth0 ID
       */
      const userUpdateScope = nock(`https://${process.env.AUTH0_DOMAIN}`, { reqheaders: { authorization: `Bearer ${accessToken}`} })
        .log(console.log)
        .patch(/api\/v2\/users\/[\w-%]+$/)
        .reply(options.status, (uri, requestBody) => {

          if (profile) {
            profile = {...profile, ...requestBody};
          }
          else {
            _profile = {..._profile, ...requestBody};
          }

          // Be very careful here... this is manipulating a value in a wide scope
          return profile || _profile;
        });



      done(null, {userUpdateScope, userUpdateOauthTokenScope});

    });
  });
};
