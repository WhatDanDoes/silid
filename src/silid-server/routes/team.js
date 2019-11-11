const express = require('express');
const router = express.Router();
const jwtAuth = require('../lib/jwtAuth');
const models = require('../models');

/* GET team listing. */
router.get('/', jwtAuth, function(req, res, next) {
  res.send('respond with a resource');
});

router.get('/:id', jwtAuth, function(req, res, next) {
  models.Team.findOne({ where: { id: req.params.id } }).then(result => {
    if (!result) {
      result = { message: 'No such team' };
    }
    res.json(result);
  }).catch(err => {
    res.json(err);
  });
});

router.post('/', jwtAuth, function(req, res, next) {
  delete req.body.token;
  models.Organization.findOne({ where: { id: req.body.organizationId } }).then(organization => {
    organization.getAgents({attributes: ['email']}).then(agents => {
      // 2019-11-1 https://github.com/sequelize/sequelize/issues/6950#issuecomment-373937803
      // Sequelize doesn't return a flat array
      agents = agents.map(agent => agent.email);
      organization.getCreator().then(creator => {

        if (creator.email !== req.user.email && !agents.includes(req.user.email)) {
          return res.status(401).json( { message: 'Unauthorized: Invalid token' });
        }

        let team = new models.Team(req.body);
        team.save().then(result => {
          res.status(201).json(result);
        }).catch(err => {
          let status = 500;
          if (err instanceof models.Sequelize.UniqueConstraintError) {
            status = 200;
          }
          res.status(status).json(err);
        });
      }).catch(err => {
        res.status(500).json(err);
      });
    }).catch(err => {
      res.json(err);
    });
  }).catch(err => {
    res.json(err);
  });
});

router.put('/', jwtAuth, function(req, res, next) {
  models.Team.findOne({where: {id: req.body.id}}).then(team => {
    if (!team) {
      return res.json( { message: 'No such team' });
    }
    team.getOrganization().then(organization => {
      
      organization.getAgents({attributes: ['email']}).then(agents => {
        agents = agents.map(agent => agent.email);
        organization.getCreator().then(creator => {

          if (creator.email !== req.user.email && !agents.includes(req.user.email)) {
            return res.status(401).json( { message: 'Unauthorized: Invalid token' });
          }
          for (let key in req.body) {
            if (team[key]) {
              team[key] = req.body[key];
            }
          }
          team.save().then(result => {
            res.status(201).json(result);
          }).catch(err => {
            res.status(500).json(err);
          });
        }).catch(err => {
          res.status(500).json(err);
        });
      }).catch(err => {
        res.status(500).json(err);
      });
    }).catch(err => {
      res.json(err);
    });
  }).catch(err => {
    res.json(err);
  });
});

router.delete('/', jwtAuth, function(req, res, next) {
  models.Team.findOne({ where: { id: req.body.id } }).then(team => {
    if (!team) {
      return res.json( { message: 'No such team' });
    }

    team.getOrganization().then(organization => {

      organization.getCreator().then(creator => {

        if (creator.email !== req.user.email) {
          return res.status(401).json( { message: 'Unauthorized: Invalid token' });
        }

        team.destroy().then(results => {
          res.json({ message: 'Team deleted' });
        }).catch(err => {
          res.json(err);
        });
      }).catch(err => {
        res.status(500).json(err);
      });
    }).catch(err => {
      res.status(500).json(err);
    });
  }).catch(err => {
    res.json(err);
  });
});

module.exports = router;
