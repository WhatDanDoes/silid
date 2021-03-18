const nock = require('nock');
const querystring = require('querystring');
const apiScope = require('../../../config/apiPermissions');

/**
 * 2019-11-13
 * Sample tokens taken from:
 *
 * https://auth0.com/docs/api-auth/tutorials/adoption/api-tokens
 *
 * For the moment, it doesn't seem to matter that all authenticated
 * agents are using the same access token for testing purposes.
 */
const _access = require('../../fixtures/sample-auth0-access-token');
_access.iss = `http://${process.env.AUTH0_CUSTOM_DOMAIN}/`;
const _profile = require('../../fixtures/sample-auth0-profile-response');

const jwt = require('jsonwebtoken');

/**
 * This stubs the Auth0 endpoint that provides a list of users
 *
 * @param array
 * @param function
 */
module.exports = function(permissions, done) {

  require('../setupKeystore').then(singleton => {
    let { pub, prv, keystore } = singleton.keyStuff;

    /**
     * A new agent needs some basic permissions. This endpoint is called
     * when `silid-server` needs permission to set these permissions
     *
     * 2020-12-2 NOTE:
     *
     * Previously, the `iat` field in the signed `accessToken` was set by
     * `jwt` in the signing process. This led to mismatched `nock` interceptors
     * getting confused by differences of seconds (or possibly milliseconds)
     *
     * As of today, the `iat` field is permantely set to 1606929800
     * (Wed Dec 02 2020 10:23:20 GMT-0700) in the `sample-auth0-access-token`
     */
    let accessToken = jwt.sign({..._access, scope: [apiScope.read.users]},
                               prv, { algorithm: 'RS256', header: { kid: keystore.all()[0].kid } });

    const oauthTokenScope = nock(`https://${process.env.AUTH0_M2M_DOMAIN}`)
      .log(console.log)
      .post(/oauth\/token/, {
                              'grant_type': 'client_credentials',
                              //'client_id': process.env.AUTH0_CLIENT_ID,
                              'client_id': process.env.AUTH0_M2M_CLIENT_ID,
                              //'client_secret': process.env.AUTH0_CLIENT_SECRET,
                              'client_secret': process.env.AUTH0_M2M_CLIENT_SECRET,
                              /**
                               * 2020-12-21
                               *
                               * Though you may have a custom domain configured, the management client requires the
                               * `audience` to be set as below.
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

    done(null, {accessToken, oauthTokenScope});
  });
};
