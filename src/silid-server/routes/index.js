const express = require('express');
const router = express.Router();
const path = require('path');
const passport = require('passport');

const request = require('request'); //.defaults({proxy: 'http://localhost:3000', tunnel: false});

const httpProxy = require('http-proxy');
const clientProxy = httpProxy.createProxyServer();

/**
 * For the client-side app
 */
let staticPath;
if (
  process.env.NODE_ENV === 'production' ||
  process.env.NODE_ENV === 'staging' ||
  process.env.TEST_BUILD
) {
  staticPath = path.join(__dirname, '/../build');
} else {
  staticPath = path.join(__dirname, '/../public');
}

/**
 * Current end-to-end test configurations require the `react` build server to
 * be running. To avoid cors issues, this requires the client-side app to be
 * served up via proxy. In production-like scenarios, the client app is
 * assembled for production and served from the static folder.
 */
if ((process.env.NODE_ENV === 'e2e' || process.env.NODE_ENV === 'development') && !process.env.TEST_BUILD) {
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
  router.get(/jpeg|gif|png|jpg|js|css|ico|woff|svg|ttf|json|map/, function(
    req,
    res,
    next
  ) {

    /**
     * Language data is not proxied. Neither is any static asset,
     * for that matter... (2021-3-1 Is this still true? I'm only checking
     * for `jpg`s here. Check back later...)
     */
    if (/\/languages\/.+\.json/.test(req.path) || /jpg/.test(req.path)) {
      try {
        return res.sendFile(req.path, { root: staticPath });
      }
      catch (err) {
        console.log('Could not get static file');
        console.error(err);
      }
    }

    if (req.session.passport) {
      try {
        return clientProxy.web(req, res, { target: 'http://localhost:3000' });
      }
      catch (err) {
        console.log('Something went wrong on the proxy');
        console.error(err);
      }
    }

    try {
      res.sendFile(req.path, { root: staticPath });
    }
    catch (err) {
      console.log('Could not get static file');
      console.error(err);
    }
  });
} else {
  router.get('/', function(req, res, next) {
    if (req.session.passport) {
      return res.sendFile('index.html', { root: staticPath });
    }
    res.render('index');
  });
}

module.exports = router;
