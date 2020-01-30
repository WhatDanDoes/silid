const express = require('express');
const router = express.Router();
const path = require('path');
const passport = require('passport');

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

/* GET home page. */
router.get('/', function(req, res, next) {
  if (req.session.passport) {
    return res.sendFile('index.html', { root: staticPath });
  }
  res.render('index');
});

module.exports = router;
