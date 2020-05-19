const nock = require('nock');
const querystring = require('querystring');
const apiScope = require('../../../config/apiPermissions');
const jwt = require('jsonwebtoken');
const stubOauthToken =  require('./stubOauthToken');

const _profile = require('../../fixtures/sample-auth0-profile-response');

/**
 * This stubs the Auth0 endpoint that returns agent profile info
 * for the purpose of searching for a team
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

    stubOauthToken([apiScope.read.usersAppMetadata], (err, oauthScopes) => {
      if (err) return done(err);

      ({accessToken, oauthTokenScope} = oauthScopes);

      const teamReadOauthTokenScope = oauthTokenScope;

      /**
       * Search for a team by ID
       *
       * GET `/users`
       */
      const teamReadScope = nock(`https://${process.env.AUTH0_DOMAIN}`, { reqheaders: { authorization: `Bearer ${accessToken}`} })
        .log(console.log)
        .get(/api\/v2\/users/)
        .query({ search_engine: 'v3', q: /.+/ })
        .reply(200, (uri, requestBody) => {
          let qs = querystring.parse(uri.split('?')[1]);
          for (let team of _profile.user_metadata.teams) {
            let regex = new RegExp(team.id);
            if (regex.test(qs.q)) {
              return [_profile];
            }
          }
          return [];
        });


      done(null, {teamReadScope, teamReadOauthTokenScope});

    });
  });
};
