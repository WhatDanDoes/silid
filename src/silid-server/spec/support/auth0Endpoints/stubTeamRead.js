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
module.exports = function(profiles, done, options) {

  if (typeof profiles === 'function') {
    if (typeof done === 'object') {
      options = done;
    }
    done = profiles;
    profiles = [_profile];
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
        .reply(options.status, (uri, requestBody) => {

          let qs = querystring.parse(uri.split('?')[1]);
          let results = [];

          for (let profile of profiles) {
            if (/teams/.test(qs.q)) {
              for (let team of profile.user_metadata.teams) {
                let regex;
                if(/organizationId/.test(qs.q)) {
                  regex = new RegExp(team.organizationId);
                }
                else {
                  regex = new RegExp(team.id);
                }
                if (regex.test(qs.q)) {
                  results.push(profile);
                }
              }
            }
            else if (/rsvps/.test(qs.q) && profile.user_metadata.rsvps) {
              for (let rsvp of profile.user_metadata.rsvps) {
                let regex = new RegExp(rsvp.id);
                if (regex.test(qs.q)) {
                  results.push(profile);
                }
              }
            }
          }

          return results;
        });

      done(null, {teamReadScope, teamReadOauthTokenScope});

    });
  });
};
