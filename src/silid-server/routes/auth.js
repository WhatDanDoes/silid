const express = require('express');
const router = express.Router();
const path = require('path');
const passport = require('passport');
const models = require('../models');
const request = require('request');
const util = require('util');
const querystring = require('querystring');
const url = require('url');
const getManagementClient = require('../lib/getManagementClient');

const apiScope = require('../config/apiPermissions');
const roles = require('../config/roles');

router.get('/login', (req, res, next) => {
  const authenticator = passport.authenticate('auth0', {
    scope: 'openid email profile',
    audience: process.env.AUTH0_AUDIENCE
  });
  return authenticator(req, res, next);
});

/**
 * Perform the final stage of authentication and redirect to previously requested URL or '/'
 */
router.get('/callback', passport.authenticate('auth0'), (req, res) => {
  if (!req.user) {
    return res.redirect('/');
  }

  function login() {
    req.login(req.user, function (err) {
      if (err) {
        return next(err);
      }

      const returnTo = req.session.returnTo;
      delete req.session.returnTo;

      // 2020-2-11 Some kind of session-saving/redirect race condition
      // https://github.com/expressjs/session/issues/360#issuecomment-552312910
      req.session.save(function(err) {
        if (err) {
          return res.json(err);
        }

        res.redirect(returnTo || '/');
      });
    });
  }

  models.Agent.findOne({ where: { email: req.user.email } }).then(result => {
    if (!result) {
      let newAgent = new models.Agent({email: req.user.email, name: req.user.name, socialProfile: req.user});

      newAgent.save().then(result => {
        login();
      }).catch(err => {
        res.json(err);
      });
    } else {
      result.socialProfile = req.user;
      result.save().then(result => {
        login();
      }).catch(err => {
        res.json(err);
      });
    }
  }).catch(err => {
    res.json(err);
  });
});

/**
 * 2020-3-17 https://github.com/auth0-samples/auth0-nodejs-webapp-sample/blob/master/01-Login/routes/auth.js
 *
 * Perform session logout and redirect to silid homepage
 * through Auth0 `/logout` endpoint
 */
router.get('/logout', (req, res) => {
  req.logout();

  let cookies = req.cookies;
  for (var cookie in cookies) {
    res.cookie(cookie, '', {expires: new Date(0)});
  }

  const logoutURL = new url.URL(
    util.format('https://%s/v2/logout', process.env.AUTH0_DOMAIN)
  );

  const searchString = querystring.stringify({
    client_id: process.env.AUTH0_CLIENT_ID,
    returnTo: process.env.SERVER_DOMAIN + '/cheerio',
  });
  logoutURL.search = searchString;

  req.session.destroy(err => {
    res.redirect(logoutURL);
  });
});

/**
 * Recursive function to retrieve all registered clients.
 *
 * The recursion is necessary because /client call returns a
 * maximum of 50 results as of 2021-1-26
 *
 * @param function - callback
 * @param integer - page
 * @param integer - perPage
 * @param array - clients
 */
const managementClient = getManagementClient([apiScope.read.clients].join(' '));
function getAllClients(done, page = 0, perPage = 50, clients = []) {
  managementClient.clients.getAll({
    fields: 'client_id,name,callbacks',
    include_fields: true,
    page: page,
    per_page: perPage
  }).then(results => {

    clients = clients.concat(results);

    if (results.length < perPage) {
      done(null, clients);
    }
    else {
      getAllClients(done, ++page, perPage, clients);
    }

  }).catch(err => {
    done(err);
  });
};

router.get('/cheerio', (req, res) => {
  getAllClients((err, clients) => {
    if (err) {
      return res.status(err.statusCode).json(err.message.error_description);
    }

    /**
     * This assumes every registered client application has a `/logout` route
     */
    const logoutUrls = [];
    for (let client of clients) {
      if (!client.callbacks) continue;
      for (callback of client.callbacks) {
        const urlObj = new url.URL(callback);
        const logoutUrl = urlObj.origin + '/logout';
        if (logoutUrls.indexOf(logoutUrl) < 0) {
          logoutUrls.push(logoutUrl);
        }
      };
    };

    res.render('cheerio', { logoutUrls: logoutUrls });
  });
});

module.exports = router;
