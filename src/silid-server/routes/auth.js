const express = require('express');
const router = express.Router();
const path = require('path');
const passport = require('passport');
const models = require('../models');
const request = require('request');

router.get('/login', (req, res, next) => {
  const authenticator = passport.authenticate('auth0', { scope: 'openid email profile' });
  return authenticator(req, res, next);
});

/**
 * Perform the final stage of authentication and redirect to previously requested URL or '/'
 */
router.get('/callback', function (req, res, next) {

  passport.authenticate('auth0', function (err, user, info) {
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.redirect('/');
    }

    function login() {
      req.logIn(user, function (err) {
        if (err) {
          return next(err);
        }

        const returnTo = req.session.returnTo;
        delete req.session.returnTo;
        res.redirect(returnTo || '/');
      });
    }

    models.Agent.findOne({ where: { email: user._json.email } }).then(result => {
      if (!result) {
        let newAgent = new models.Agent({email: user._json.email, name: user._json.name});

        newAgent.save().then(result => {
          login();
        }).catch(err => {
          res.json(err);
        });
      } else {
        result.socialProfile = user;
        result.save().then(result => {
          login();
        }).catch(err => {
          res.json(err);
        });
      }
    }).catch(err => {
      res.json(err);
    });
  })(req, res, next);
});

/**
 * Perform session logout and redirect to homepage
 */
router.get('/logout', (req, res) => {
  req.logout();

  let cookies = req.cookies;
  for (var cookie in cookies) {
    res.cookie(cookie, '', {expires: new Date(0)});
  }
  res.redirect('/');
});

module.exports = router;
