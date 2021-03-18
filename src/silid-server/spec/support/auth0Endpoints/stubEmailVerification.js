const nock = require('nock');
const querystring = require('querystring');
const apiScope = require('../../../config/apiPermissions');
const jwt = require('jsonwebtoken');
const stubOauthToken =  require('./stubOauthToken');

/**
 * Re-send verification emails for agents who sign up at Auth0
 *
 * @param object
 * @param function
 * @param object
 */
module.exports = function(done) {

  require('../setupKeystore').then(singleton => {
    let { pub, prv, keystore } = singleton.keyStuff;

    stubOauthToken([apiScope.update.users], (err, oauthScopes) => {
      if (err) return done(err);

      ({accessToken, oauthTokenScope} = oauthScopes);

      const emailVerificationOauthTokenScope = oauthTokenScope;

      /**
       * GET `/jobs/verification-email`
       *
       * 2020-7-24
       * Sample response taken from:
       * https://auth0.com/docs/api/management/v2?_ga=2.91635738.1600097788.1595507023-63924015.1587573995#!/Jobs/post_verification_email
       */
      const emailVerificationScope = nock(`https://${process.env.AUTH0_M2M_DOMAIN}`, { reqheaders: { authorization: `Bearer ${accessToken}`} })
        .log(console.log)
        .post('/api/v2/jobs/verification-email', {
            'user_id': /.+/i,
        })
        .reply(201, {
          "status": "completed",
          "type": "verification_email",
          "created_at": "",
          "id": "job_0000000000000001"
        });

        done(null, {emailVerificationScope, emailVerificationOauthTokenScope});
    });
  });
};
