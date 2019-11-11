require('dotenv').config();
const jwt = require('jsonwebtoken');
const models = require('../models');
const jwtAuth = function(req, res, next) {
  const token =
    req.body.token ||
    req.query.token ||
    req.headers['x-access-token'] ||
    req.cookies.token;
  if (!token) {
    res.status(401).json({ message: 'Unauthorized: No token provided' });
  } else {
    jwt.verify(token, process.env.SECRET, function(err, decoded) {
      if (err) {
        res.status(401).json({ message: 'Unauthorized: Invalid token' });
      } else {
        models.Agent.findOne({ where: { email: decoded.email } }).then(agent => {
          req.user = agent;
          if (!req.user) {
            req.user = decoded;
          }
          next();
        }).catch(err => {
          res.status(500).json(err);
        });
      }
    });
  }
}
module.exports = jwtAuth;
