const express = require('express');
const router = express.Router();
const path = require('path');

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
  res.sendFile('index.html', { root: staticPath });
});

module.exports = router;
