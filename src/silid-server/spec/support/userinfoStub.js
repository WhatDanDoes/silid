/**
 * 2019-11-13
 * Sample tokens taken from:
 *
 * https://auth0.com/docs/api-auth/tutorials/adoption/api-tokens
 */
const _identity = require('../fixtures/sample-auth0-identity-token');
const nock = require('nock')

/**
 * Auth0 /userinfo mock
 */
module.exports = function(access) {
  const userinfoScope = nock(`https://${process.env.AUTH0_DOMAIN}`, {
      reqheaders: {
        'Authorization': `Bearer ${access}`
      }
    })
    .persist()
    .get('/userinfo')
    .reply(200, _identity);

  return userinfoScope;
};
