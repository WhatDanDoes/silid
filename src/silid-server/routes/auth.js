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

  models.Agent.findOne({ where: { email: req.user._json.email } }).then(result => {
    if (!result) {
      let newAgent = new models.Agent({email: req.user._json.email, name: req.user._json.name});

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


/**
 * Verify organization membership via email
 */
router.get('/verify/:uuid', (req, res) => {
  models.OrganizationMember.findOne({ where: { verificationCode: req.params.uuid } }).then(membership => {
    if (!membership) {
      return res.redirect('/login');
    }
    membership.verify().then(m => {
      if (!req.user) {
        return res.redirect('/login');
      }
      res.redirect(`/`);
    }).catch(err => {
      res.status(500).json(err);
    });
  }).catch(err => {
    return res.redirect('/login');
  });
});


module.exports = router;
