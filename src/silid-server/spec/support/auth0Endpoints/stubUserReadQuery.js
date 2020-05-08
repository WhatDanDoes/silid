const nock = require('nock');
const querystring = require('querystring');
const apiScope = require('../../../config/apiPermissions');
const jwt = require('jsonwebtoken');
const stubOauthToken =  require('./stubOauthToken');

const _profile = require('../../fixtures/sample-auth0-profile-response');

/**
 * This stubs the Auth0 endpoint that returns searched agent profile info
 *
 * @param object
 * @param function
 */
module.exports = function(res, done) {

  require('../setupKeystore').then(singleton => {
    let { pub, prv, keystore } = singleton.keyStuff;

    stubOauthToken([apiScope.read.usersAppMetadata], (err, oauthScopes) => {
      if (err) return done(err);

      ({accessToken, oauthTokenScope} = oauthScopes);

      const userQueryOauthTokenScope = oauthTokenScope;

      /**
       * Search for a team by ID
       *
       * GET `/users`
       */
      const userQueryScope = nock(`https://${process.env.AUTH0_DOMAIN}`, { reqheaders: { authorization: `Bearer ${accessToken}`} })
        .log(console.log)
        .get(/api\/v2\/users/)
        .query({ search_engine: 'v3', q: /.+/ })
        .reply(200, (uri, requestBody) => {
          let qs = querystring.parse(uri.split('?')[1]);
          console.log(qs);
          return res;
        });

      done(null, {userQueryScope, userQueryOauthTokenScope});

    });
  });
};
