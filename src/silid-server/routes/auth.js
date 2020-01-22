const express = require('express');
const router = express.Router();
const path = require('path');
const passport = require('passport');


router.get('/login', (req, res, next) => {
  console.log("LOGGING IN");
  console.log(req.headers);
  const authenticator = passport.authenticate('auth0', { scope: 'openid email profile' })
  authenticator(req, res, next)
});

//router.get('/login', function(req, res, next) {
//  console.log("LOGGING IN");
//console.log(req.session);
//  next();
//}, passport.authenticate('auth0', { scope: 'openid email profile' }), function (req, res) {
//  console.log("LOGIN DONE");
//  res.redirect('/');
//});

/**
 * Perform the final stage of authentication and redirect to previously requested URL or '/'
 */
router.get('/callback', function (req, res, next) {
console.log("CALLING BACK");
console.log(req.headers);
//console.log(req.session);

  passport.authenticate('auth0', function (err, user, info) {
console.log("AUTH DONE");
console.log(err);
console.log(user);
console.log(info);
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.redirect('/');
    }
    req.logIn(user, function (err) {
      if (err) {
        return next(err);
      }
      // const returnTo = req.session.returnTo;
      delete req.session.returnTo;
      // res.redirect(returnTo || '/');

      res.status(200).json(req.user)
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
