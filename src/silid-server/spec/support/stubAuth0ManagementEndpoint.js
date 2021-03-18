const nock = require('nock');
const querystring = require('querystring');

/**
 * 2019-11-13
 * Sample tokens taken from:
 *
 * https://auth0.com/docs/api-auth/tutorials/adoption/api-tokens
 *
 * For the moment, it doesn't seem to matter that all authenticated
 * agents are using the same access token for testing purposes.
 */
const _access = { ...require('../fixtures/sample-auth0-access-token'), iss: `http://${process.env.AUTH0_CUSTOM_DOMAIN}/`};

const _profile = require('../fixtures/sample-auth0-profile-response');

const jwt = require('jsonwebtoken');

/**
 * Stub all the Auth0 Management API stuff. Used on a test-by-test basis to
 * provide and test against scoped permissions. Ensure the API is being called
 * when appropriate and likewise _not_ being called when appropriate
 *
 * @param array
 * @param function
 */
module.exports = function(permissions, done) {

  require('./setupKeystore').then(singleton => {
    let { pub, prv, keystore } = singleton.keyStuff;

    /**
     * A new agent needs some basic permissions. This endpoint is called
     * when `silid-server` needs permission to set these permissions
     */
    let accessToken = jwt.sign({..._access, scope: permissions},
                               prv, { algorithm: 'RS256', header: { kid: keystore.all()[0].kid } });
    const oauthTokenScope = nock(`https://${process.env.AUTH0_M2M_DOMAIN}`)
      .log(console.log)
      .post(/oauth\/token/, {
                              'grant_type': 'client_credentials',
                              'client_id': process.env.AUTH0_M2M_CLIENT_ID,
                              'client_secret': process.env.AUTH0_M2M_CLIENT_SECRET,
                              /**
                               * 2020-12-17
                               *
                               * Set as such because we have a custom domain.
                               *
                               * https://auth0.com/docs/custom-domains/configure-features-to-use-custom-domains#apis
                               */
                              //'audience': `https://${process.env.AUTH0_CUSTOM_DOMAIN}/api/v2/`,
                              'audience': process.env.AUTH0_M2M_AUDIENCE,
                              'scope': permissions.join(' ')
                            })
      .reply(200, {
        'access_token': accessToken,
        'token_type': 'Bearer',
      });

    /**
     * POST `/users`
     *
     * Auth0 requires a connection for this endpoint. It is called `Initial-Connection`
     * here. This setting can be configured at:
     *
     * https://manage.auth0.com/dashboard/us/silid/connections
     */
    const userCreateScope = nock(`https://${process.env.AUTH0_M2M_DOMAIN}`, { reqheaders: { authorization: `Bearer ${accessToken}`} })
      .log(console.log)
      .post(/api\/v2\/users/, {
                              'email': /.+/i,
                              'connection': 'Initial-Connection',
                            })
      .reply(201, {
        "user_id": "auth0|507f1f77bcf86c0000000000",
        "email": "doesnotreallymatterforthemoment@example.com",
        "email_verified": false,
        "identities": [
          {
            "connection": "Initial-Connection",
          }
        ]
      });

    /**
     * Create a team
     *
     * PATCH `/users`
     */
    const updateTeamScope = nock(`https://${process.env.AUTH0_M2M_DOMAIN}`, { reqheaders: { authorization: `Bearer ${accessToken}`} })
      .log(console.log)
      .patch(/api\/v2\/users\/.+/, body => {
        if (body.user_metadata) {
          for(let team of body.user_metadata.teams) {
            if(!team.name || !team.leader || !team.id) {
              return false;
            }
          }
          return true;
        }
        return false;
      })
      .reply(201, (uri, requestBody) => {
        _profile.user_metadata = {...requestBody.user_metadata};
        return _profile;
      });

    /**
     * DELETE `/users`
     *
     */
    const userDeleteScope = nock(`https://${process.env.AUTH0_M2M_DOMAIN}`, { reqheaders: { authorization: `Bearer ${accessToken}`} })
      .log(console.log)
      .delete(/api\/v2\/users\/*/)
      .reply(201, {
        "user_id": "auth0|507f1f77bcf86c0000000000",
        "email": "doesnotreallymatterforthemoment@example.com",
        "email_verified": false,
        "identities": [
          {
            "connection": "Initial-Connection",
          }
        ]
      });

    done(null, {
                oauthTokenScope,
                userCreateScope, userDeleteScope,
                updateTeamScope,
    });
  });
};
