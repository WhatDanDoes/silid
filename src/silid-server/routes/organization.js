const express = require('express');
const router = express.Router();
const jwtAuth = require('../lib/jwtAuth');
const sessionAuth = require('../lib/sessionAuth');
const models = require('../models');
const mailer = require('../mailer');

/* GET organization listing. */
router.get('/', sessionAuth, function(req, res, next) {
  req.agent.getOrganizations().then(orgs => {
    res.json(orgs);
  }).catch(err => {
    res.status(500).json(err);
  });
});

router.get('/:id', jwtAuth, function(req, res, next) {
  models.Organization.findOne({ where: { id: req.params.id },
                                include: [ { model: models.Agent, as: 'creator', attributes: { exclude: ['accessToken'] } },
                                           { model: models.Agent, as: 'members', attributes: { exclude: ['accessToken'] } },
                                           { model: models.Team, as: 'teams',
                                             include: [{ model: models.Agent, as: 'members', attributes: { exclude: ['accessToken'] } }] } ] }).then(result => {
    if (!result) {
      return res.status(404).json({ message: 'No such organization' });
    }

    if (!result.members.map(member => member.id).includes(req.agent.id)) {
      return res.status(403).json({ message: 'You are not a member of that organization' });
    }

    res.status(200).json(result);
  }).catch(err => {
    res.json(err);
  });
});

router.post('/', jwtAuth, function(req, res, next) {
  delete req.body.token;
  req.body.creatorId = req.agent.id;

  req.agent.createOrganization(req.body).then(org => {
    res.status(201).json(org);
  }).catch(err => {
    let status = 500;
    if (err instanceof models.Sequelize.UniqueConstraintError) {
      status = 200;
    }
    res.status(status).json(err);
  });
});

router.put('/', jwtAuth, function(req, res, next) {
  models.Organization.findOne({ where: { id: req.body.id } }).then(organization => {
    if (!organization) {
      return res.json( { message: 'No such organization' });
    }

    organization.getCreator().then(creator => {
      if (req.agent.email !== creator.email) {
        return res.status(403).json( { message: 'Unauthorized: Invalid token' });
      }
  
      for (let key in req.body) {
        if (organization[key]) {
          organization[key] = req.body[key];
        }
      }
      organization.save().then(result => {
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
});

/**
 * PATCH is used to modify associations (i.e., memberships and teams).
 * cf., PUT
 */
const patchOrg = function(req, res, next) {
  models.Organization.findOne({ where: { id: req.body.id },
                                include: ['members', 'teams'] }).then(organization => {
    if (!organization) {
      return res.status(404).json( { message: 'No such organization' });
    }

    let members = organization.members.map(member => member.id);
    if (!members.includes(req.agent.id)) {
      return res.status(403).json( { message: 'You are not a member of this organization' });
    }

    // Agent membership
    let memberStatus = 'now a';
    if (req.body.memberId) {
      const index = members.indexOf(req.body.memberId);
      // Delete
      if (index > -1) {
        memberStatus = 'no longer a';
        members.splice(index, 1);
      }
      // Add
      else {
        members.push(req.body.memberId);
      }
    }

    // Team
    let teams = organization.teams.map(team => team.id);
    if (req.body.teamId) {
      const index = teams.indexOf(req.body.teamId);
      // Delete
      if (index > -1) {
        teams.splice(index, 1);
      }
      // Add
      else {
        teams.push(req.body.teamId);
      }
    }

    Promise.all([ organization.setMembers(members), organization.setTeams(teams) ]).then(results => {
      if (req.body.memberId) {
        models.Agent.findOne({ where: { id: req.body.memberId } }).then(agent => {
          let mailOptions = {
            to: agent.email,
            from: process.env.NOREPLY_EMAIL,
            subject: 'Identity membership update',
            text: `You are ${memberStatus} member of ${organization.name}`
          };
          mailer.transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
              console.error('Mailer Error', error);
              return res.status(501).json(error);
            }
            res.status(201).json({ message: 'Update successful' });
          });
        }).catch(err => {
          res.status(status).json(err);
        });
      }
      else {
        res.status(201).json({ message: 'Update successful' });
      }
    }).catch(err => {
      let status = 500;
      if (err instanceof models.Sequelize.ForeignKeyConstraintError) {
        status = 404;
        if (err.parent.table === 'agent_organization') {
          err = { message: 'No such agent' }
        }
        else if (err.parent.table === 'organization_team') {
          err = { message: 'No such team' }
        }
      }
      res.status(status).json(err);
    });
  }).catch(err => {
    res.status(500).json(err);
  });
}

router.patch('/', jwtAuth, function(req, res, next) {
  if (req.body.email) {
    models.Agent.findOne({ where: { email: req.body.email } }).then(agent => {
      if (!agent) {
        let newAgent = new models.Agent({ email: req.body.email });
        newAgent.save().then(result => {
          req.body.memberId = result.id;
          patchOrg(req, res, next);
        }).catch(err => {
          res.status(500).json(err);
        });
      }
      else {
        req.body.memberId = agent.id;
        patchOrg(req, res, next);
      }
    }).catch(err => {
      res.status(500).json(err);
    });
  }
  else {
    patchOrg(req, res, next);
  }
});

router.delete('/', jwtAuth, function(req, res, next) {
  models.Organization.findOne({ where: { id: req.body.id } }).then(organization => {
    if (!organization) {
      return res.json( { message: 'No such organization' });
    }

    organization.getCreator().then(creator => {
      if (req.agent.email !== creator.email) {
        return res.status(401).json( { message: 'Unauthorized: Invalid token' });
      }
  
      organization.destroy().then(results => {
        res.json( { message: 'Organization deleted' });
      }).catch(err => {
        res.status(500).json(err);
      });   
    }).catch(err => {
      res.status(500).json(err);
    });
  }).catch(err => {
    res.status(500).json(err);
  });
});

router.put('/:id/agent', sessionAuth, function(req, res, next) {
  models.Organization.findOne({ where: { id: req.params.id },
                                include: [ 'creator',
                                           { model: models.Agent, as: 'members', attributes: { exclude: ['accessToken'] } },
                                           'teams'] }).then(organization => {

    if (!organization) {
      return res.status(404).json( { message: 'No such organization' });
    }

    if (!organization.members.map(member => member.id).includes(req.agent.id)) {
      return res.status(403).json({ message: 'You are not a member of this organization' });
    }

    models.Agent.findOne({ where: { email: req.body.email }, attributes: { exclude: ['accessToken'] } }).then(agent => {

      const mailOptions = {
        from: process.env.NOREPLY_EMAIL,
        subject: 'Identity membership update',
        text: `You are now a member of ${organization.name}`
      };

      if (!agent) {
        let newAgent = new models.Agent({ email: req.body.email });
        newAgent.save().then(result => {
          organization.addMember(newAgent.id).then(result => {

            mailOptions.to = newAgent.email;
            mailer.transporter.sendMail(mailOptions, (error, info) => {
              if (error) {
                console.error('Mailer Error', error);
                return res.status(501).json(error);
              }
              res.status(201).json(newAgent);
            });
          }).catch(err => {
            res.status(500).json(err);
          })
        }).catch(err => {
          res.status(500).json(err);
        });
      }
      else {
        if (organization.members.map(a => a.id).includes(agent.id)) {
          return res.status(200).json({ message: `${agent.email} is already a member of this organization` });
        }

        organization.addMember(agent.id).then(result => {

          mailOptions.to = agent.email;
          mailer.transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
              console.error('Mailer Error', error);
              return res.status(501).json(error);
            }
            res.status(201).json(agent);
          });
        }).catch(err => {
          res.status(500).json(err);
        });
      }
    }).catch(err => {
      res.status(500).json(err);
    });
  }).catch(err => {
    res.status(500).json(err);
  });
});


router.delete('/:id/agent/:agentId', sessionAuth, function(req, res, next) {
  models.Organization.findOne({ where: { id: req.params.id },
                                include: [ 'creator',
                                           { model: models.Agent, as: 'members', attributes: { exclude: ['accessToken'] } },
                                           'teams'] }).then(organization => {
    if (!organization) {
      return res.status(404).json( { message: 'No such organization' });
    }

    if (req.agent.email !== organization.creator.email) {
      return res.status(401).json( { message: 'Unauthorized: Invalid token' });
    }

    models.Agent.findOne({ where: { id: req.params.agentId } }).then(agent => {
      if (!agent || !organization.members.map(member => member.id).includes(agent.id)) {
        return res.status(404).json({ message: 'That agent is not a member' });
      }

      organization.removeMember(req.params.agentId).then(results => {
        let mailOptions = {
          to: agent.email,
          from: process.env.NOREPLY_EMAIL,
          subject: 'Identity membership update',
          text: `You are no longer a member of ${organization.name}`
        };
        mailer.transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.error('Mailer Error', error);
            return res.status(501).json(error);
          }
          res.status(201).json({ message: 'Member removed' });
        });
      }).catch(err => {
        res.status(500).json(err);
      });
    }).catch(err => {
      res.status(500).json(err);
    });
  }).catch(err => {
    res.status(500).json(err);
  });
});


module.exports = router;
