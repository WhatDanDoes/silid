const nock = require('nock');
const querystring = require('querystring');
const apiScope = require('../../../config/apiPermissions');
const jwt = require('jsonwebtoken');
const stubOauthToken =  require('./stubOauthToken');

const _profile = require('../../fixtures/sample-auth0-profile-response');

/**
 * This stubs the Auth0 endpoint that returns agent profile info
 * for the purpose of searching for an organization
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

      ({accessToken, oauthTokenScope: organizationReadOauthTokenScope} = oauthScopes);

      /**
       * Search for an organization by ID
       *
       * GET `/users`
       */
      const organizationReadScope = nock(`https://${process.env.AUTH0_M2M_DOMAIN}`, { reqheaders: { authorization: `Bearer ${accessToken}`} })
        .get(/api\/v2\/users/)
        .query({ search_engine: 'v3', q: /.+/ })
        .reply(options.status, (uri, requestBody) => {

          let qs = querystring.parse(uri.split('?')[1]);
          let results = [];

          for (let profile of profiles) {
            if (/organizations/.test(qs.q)) {
              for (let organization of profile.user_metadata.organizations) {

                let regex;
                if (/id/.test(qs.q)) {
                  regex = new RegExp(organization.id);
                }
                else if (/name/.test(qs.q)) {
                  regex = new RegExp(organization.name);
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

      done(null, {organizationReadScope, organizationReadOauthTokenScope});

    });
  });
};
