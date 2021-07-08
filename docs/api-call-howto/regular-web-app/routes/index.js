const router = require('express').Router();
const { requiresAuth } = require('express-openid-connect');
const fetch = require('node-fetch');

router.get('/', function (req, res, next) {
  res.render('index', {
    title: 'Auth0 Webapp sample Nodejs',
    isAuthenticated: req.oidc.isAuthenticated()
  });
});

/**
 * This is the original bootstrapped code (as of 2021-4-9).
 *
 * It only provides standard OIDC data. To retrieve an agent's full
 * profile (including `user_metadata`) you may call upon Identity
 * as below.
 */
//router.get('/profile', requiresAuth(), function (req, res, next) {
//  res.render('profile', {
//    userProfile: JSON.stringify(req.oidc.user, null, 2),
//    title: 'Profile page'
//  });
//});

/**
 * Call the configured `Identity` `GET /agent` endpoint to retrieve
 * an agent's full Auth0 profile.
 *
 * Assuming `IDENTITY_ENDPOINT=https://id.languagetechnology.org`
 *
 * the `Authorization` header is the configuration of interest.
 */
router.get('/profile', async (req, res) => {
  let { token_type, access_token } = req.oidc.accessToken;
  fetch(`${process.env.IDENTITY_ENDPOINT}/agent`, {
      method: 'get',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `${token_type} ${access_token}`
      },
    })
    .then(res => res.json())
    .then(json => {
      res.render('profile', {
        userProfile: JSON.stringify(json, null, 2),
        title: 'Profile page'
      });
    });
});

module.exports = router;
