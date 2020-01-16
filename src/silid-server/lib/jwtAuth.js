require('dotenv').config();
const jwt = require('jsonwebtoken');
const models = require('../models');
const request = require('request');
const protocol = process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'e2e' ? 'http' : 'https';

const jwtAuth = function(req, res, next) {

  models.Agent.findOne({ where: { accessToken: req.header('Authorization') } }).then(agent => {
    req.agent = agent;

    if (!req.agent) {
      request.get(`${protocol}://${process.env.AUTH0_DOMAIN}/userinfo`, {
          headers: {
            'Authorization': req.header('Authorization')
          }
        },
        function(error, response, body) {
          if (error) {
            return next(error);
          } 
          body = JSON.parse(body);
          models.Agent.update(
            { accessToken: req.header('Authorization'), socialProfile: body },
            { returning: true, where: { email: body.email } }).then(function([rowsUpdate, [updatedAgent]]) {

            if (updatedAgent) {
              req.agent = updatedAgent;
              next();
            }
            else {
              models.Agent.create({ name: body.name, email: body.email, accessToken: req.header('Authorization'), socialProfile: body }).then(agent => {
                req.agent = agent;
                next();
              }).catch(err => {
                res.status(500).json(err);
              });
            }
          }).catch(err => {
            res.status(500).json(err);
          });
        });
    }
    else {
      next();
    }
  }).catch(err => {
    res.status(500).json(err);
  });
}

module.exports = jwtAuth;
