require('dotenv').config();
//const jwt = require('jsonwebtoken');
const models = require('../models');
//const request = require('request');
const protocol = process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'e2e' ? 'http' : 'https';


/**
 * This is called subsequent to the `passport.authenticate` function.
 * `passport` attaches a `user` property to `req`
 */
const sessionAuth = function(req, res, next) {

console.log("HERE I AM LORD");
  models.Agent.findOne({ where: { email: req.user.email } }).then(agent => {
    req.agent = agent;

    if (!req.agent || JSON.stringify(req.agent.socialProfile) !== JSON.stringify(req.user)) {
      models.Agent.update(
        { socialProfile: req.user },
        { returning: true, where: { email: req.user.email } }).then(function([rowsUpdate, [updatedAgent]]) {

        if (updatedAgent) {
          req.agent = updatedAgent;
          next();
        }
        else {
          models.Agent.create({ name: req.user.name, email: req.user.email, socialProfile: req.user }).then(agent => {
            req.agent = agent;
            next();
          }).catch(err => {
            res.status(500).json(err);
          });
        }
      }).catch(err => {
        res.status(500).json(err);
      });
    }
    else {
      next();
    }
  }).catch(err => {
    res.status(500).json(err);
  });
}

module.exports = sessionAuth;
