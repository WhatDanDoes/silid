const express = require('express');
const router = express.Router();
const path = require('path');
const passport = require('passport');

const request = require('request');//.defaults({proxy: 'http://localhost:3000', tunnel: false});

const httpProxy = require('http-proxy');
const clientProxy = httpProxy.createProxyServer();

/**
 * For the client-side app
 */
let staticPath;
if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging') {
  staticPath = path.join(__dirname, '/../build');
}
else {
  staticPath = path.join(__dirname, '/../public');
}

/**
 * Send app to client if authenticated.
 * Render home otherwise
 */
router.get('/', function(req, res, next) {
  if (req.session.passport) {
    return req.pipe(request(process.env.CLIENT_DOMAIN)).pipe(res);
  }
  res.render('index');
});

/**
 * If client app is served from another domain, proxy requested
 * static resources
 */
router.get(/jpeg|gif|png|jpg|js|css|ico|woff|svg|ttf|json|map/, function(req, res, next) {
  if (req.session.passport) {
    return clientProxy.web(req, res, { target: 'http://localhost:3000' });
  }

  res.sendFile(req.path, { root: staticPath });
});


module.exports = router;
