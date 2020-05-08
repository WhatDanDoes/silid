const express = require('express');
const router = express.Router();
const models = require('../models');
const mailer = require('../mailer');
const uuid = require('uuid');

/**
 * Configs must match those defined for RBAC at Auth0
 */
const scope = require('../config/permissions');
const roles = require('../config/roles');
const checkPermissions = require('../lib/checkPermissions');

const apiScope = require('../config/apiPermissions');
const getManagementClient = require('../lib/getManagementClient');

/**
 * Take agent user_metadata and collate it into manageable team data
 *
 * @param array
 * @param string
 * @param string
 *
 * @returns array
 */
function collateTeams(agents, teamId, agentId) {
  const agentIndex = agents.findIndex(a => a.user_id === agentId);

  // Requesting agent is not a member of the team
  if (agentIndex < 0) {
    return;
  }

  const teamIndex = agents[agentIndex].user_metadata.teams.findIndex(t => t.id === teamId);
  let teams = {
    id: agents[agentIndex].user_metadata.teams[teamIndex].id,
    name: agents[agentIndex].user_metadata.teams[teamIndex].name,
    leader: agents[agentIndex].user_metadata.teams[teamIndex].leader,
    members: [],
  };

  agents.map(agent => {
    teams.members.push({ name: agent.name, email: agent.email, user_id: agent.user_id });
  });

  return teams;
}


/* GET team listing. */
router.get('/admin', checkPermissions(roles.sudo), function(req, res, next) {
  if (!req.agent.isSuper) {
    return res.status(403).json( { message: 'Forbidden' });
  }

  // Super agent gets entire listing
  models.Team.findAll().then(orgs => {
    res.json(orgs);
  }).catch(err => {
    res.status(500).json(err);
  });
});

router.get('/', checkPermissions([scope.read.teams]), function(req, res, next) {
  const managementClient = getManagementClient([apiScope.read.users, apiScope.read.usersAppMetadata].join(' '));
  managementClient.getUser({id: req.user.user_id}).then(agent => {
    res.status(200).json(agent.user_metadata.teams);
  }).catch(err => {
    res.status(err.statusCode).json(err.message.error_description);
  });
});

router.get('/:id', checkPermissions([scope.read.teams]), function(req, res, next) {
  const managementClient = getManagementClient(apiScope.read.usersAppMetadata);
  managementClient.getUsers({ search_engine: 'v3', q: `user_metadata.teams.id:"${req.params.id}"` }).then(agents => {
    if (agents.length) {

      const teams = collateTeams(agents, req.params.id, req.user.user_id);

      if (!teams) {
        return res.status(403).json({ message: 'You are not a member of that team' });
      }

      return res.status(200).json(teams);
    }
    res.status(404).json({ message: 'No such team' });
  }).catch(err => {
    res.status(err.statusCode).json(err.message.error_description);
  });
});

router.post('/', checkPermissions([scope.create.teams]), function(req, res, next) {
  let managementClient = getManagementClient([apiScope.read.users].join(' '));
  managementClient.getUser({id: req.user.user_id}).then(agent => {

    // No duplicate team names
    if (agent.user_metadata) {
      if (agent.user_metadata.teams) {
        let teams = agent.user_metadata.teams.map(team => team.name);
        if (teams.includes(req.body.name)) {
          return res.status(400).json({ errors: [{ message: 'That team is already registered' }] });
        }
      }
      else {
        agent.user_metadata.teams = [];
      }
    }
    else {
      agent.user_metadata = { teams: [] };
    }

    // Make sure incoming data is legit
    let teamName = req.body.name;
    if (teamName) {
      teamName = teamName.trim();
    }
    if (!teamName) {
      return res.status(400).json({ errors: [{ message: 'Team requires a name' }] });
    }

    agent.user_metadata.teams.push({
      id: uuid.v4(),
      name: teamName,
      leader: req.user.email,
    });

    managementClient = getManagementClient([apiScope.update.users, apiScope.read.usersAppMetadata, apiScope.update.usersAppMetadata].join(' '));
    managementClient.updateUser({id: req.user.user_id}, { user_metadata: agent.user_metadata }).then(result => {
      // Auth0 does not return agent scope
      result.scope = req.user.scope;
      // 2020-4-30 https://stackoverflow.com/a/24498660/1356582
      // This updates the agent's session data
      req.login(result, err => {
        if (err) return next(err);

        res.status(201).json(result);
      });
    }).catch(err => {
      res.status(err.statusCode ? err.statusCode : 500).json(err.message.error_description);
    });
  }).catch(err => {
    res.status(err.statusCode ? err.statusCode : 500).json(err.message.error_description);
  });
});

router.put('/:id', checkPermissions([scope.update.teams]), function(req, res, next) {

  // Validate incoming data
  const teamName = req.body.name.trim();
  if (!teamName) {
    return res.status(400).json({ errors: [{ message: 'Team requires a name' }] });
  }
  // Make sure edited name isn't a duplicate
  const nameCount = req.user.user_metadata.teams.reduce((n, team) => n + (team.name === teamName), 0);
  if (nameCount > 0) {
    return res.status(400).json({ errors: [{ message: 'That team is already registered' }] });
  }

  // Find the team
  const teamIndex = req.user.user_metadata.teams.findIndex(t => t.id === req.params.id);
  if (teamIndex < 0) {
    return res.status(404).json({ message: 'No such team' });
  }

  // Decide permission
  if (req.user.email !== req.user.user_metadata.teams[teamIndex].leader) {
    return res.status(403).json({ message: 'Unauthorized' });
  }

  // Update team
  req.user.user_metadata.teams[teamIndex].name = teamName;

  // Update user_metadata at Auth0
  const managementClient = getManagementClient([apiScope.read.users, apiScope.read.usersAppMetadata, apiScope.update.usersAppMetadata].join(' '));
  managementClient.updateUserMetadata({id: req.user.user_id}, req.user.user_metadata).then(agent => {

    // Refresh team info
    managementClient.getUsers({ search_engine: 'v3', q: `user_metadata.teams.id:"${req.params.id}"` }).then(agents => {
      const teams = collateTeams(agents, req.params.id, req.user.user_id);

      //res.status(201).json({ message: 'Team updated', agent: agent });
      res.status(201).json(teams);
    }).catch(err => {
      res.status(err.statusCode).json(err.message.error_description);
    });
  }).catch(err => {
    res.status(err.statusCode).json(err.message.error_description);
  });
});

router.delete('/:id', checkPermissions([scope.delete.teams]), function(req, res, next) {
  const managementClient = getManagementClient([apiScope.read.users, apiScope.read.usersAppMetadata, apiScope.update.usersAppMetadata].join(' '));
  managementClient.getUsers({ search_engine: 'v3', q: `user_metadata.teams.id:"${req.params.id}"` }).then(agents => {
    if (!agents.length) {
      return res.status(404).json({ message: 'No such team' });
    }

    // There should only ever be one agent given the application of UUIDs
    let teamIndex = 0;
    for (let agent of agents) {
      for (let team of agent.user_metadata.teams) {
        if (team.id === req.params.id) {
          break;
        }
        teamIndex++;
      }
      if (teamIndex === agent.user_metadata.teams.length) {
        return res.status(404).json({ message: 'No such team' });
      }

      if (!req.agent.isSuper && req.user.email !== agent.user_metadata.teams[teamIndex].leader) {
        return res.status(403).json({ message: 'Unauthorized' });
      }

      agent.user_metadata.teams.splice(teamIndex, 1);

      managementClient.updateUserMetadata({id: req.user.user_id}, agent.user_metadata).then(agent => {
        // Auth0 does not return agent scope
        agent.scope = req.user.scope;
        // 2020-4-30 https://stackoverflow.com/a/24498660/1356582
        // This updates the agent's session data
        req.login(agent, err => {
          if (err) return next(err);
          res.status(201).json({ message: 'Team deleted', agent: agent });
        });
      }).catch(err => {
        res.status(err.statusCode).json(err.message.error_description);
      });
    }
  }).catch(err => {
    res.status(err.statusCode).json(err.message.error_description);
  });
});

/**
 * PATCH is used to modify associations (i.e., memberships and orgs).
 * cf., PUT
 */
const patchTeam = function(req, res, next) {
  models.Team.findOne({ where: { id: req.body.id },
                                 include: ['members', 'organization', 'creator'] }).then(team => {
    if (!team) {
      return res.status(404).json( { message: 'No such team' });
    }

    let members = team.members.map(member => member.id);
    if (!req.agent.isSuper && !members.includes(req.agent.id)) {
      return res.status(403).json( { message: 'You are not a member of this team' });
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

    team.setMembers(members).then(results => {
      models.Agent.findOne({ where: { id: req.body.memberId } }).then(agent => {
        let mailOptions = {
          to: agent.email,
          from: process.env.NOREPLY_EMAIL,
          subject: 'Identity membership update',
          text: `You are ${memberStatus} member of ${team.name}`
        };
        mailer.transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.error('Mailer Error', error);
            return res.status(501).json(error);
          }
          res.status(201).json({ message: 'Update successful' });
        });
      }).catch(err => {
        res.status(500).json(err);
      });
    }).catch(err => {
      let status = 500;
      if (err instanceof models.Sequelize.ForeignKeyConstraintError) {
        status = 404;
        if (err.parent.table === 'TeamMembers') {
          err = { message: 'No such agent' }
        }
      }
      res.status(status).json(err);
    });
  }).catch(err => {
    res.status(500).json(err);
  });
}

router.patch('/', checkPermissions([scope.update.teams]), function(req, res, next) {
  if (req.body.email) {
    models.Agent.findOne({ where: { email: req.body.email } }).then(agent => {
      if (!agent) {
        let newAgent = new models.Agent({ email: req.body.email });
        newAgent.save().then(result => {
          req.body.memberId = result.id;
          patchTeam(req, res, next);
        }).catch(err => {
          res.json(err);
        });
      }
      else {
        req.body.memberId = agent.id;
        patchTeam(req, res, next);
      }
    }).catch(err => {
      res.status(500).json(err);
    });
  }
  else {
    patchTeam(req, res, next);
  }
});

router.put('/:id/agent', checkPermissions([scope.create.teamMembers]), function(req, res, next) {

  let team;
  if (req.user.user_metadata.teams) {
    team = req.user.user_metadata.teams.find(team => team.id === req.params.id && team.leader === req.user.email);
  }

  if (!team) {
    return res.status(404).json( { message: 'No such team' });
  }

  models.Invitation.findOne({ where: { uuid: req.params.id, recipient: req.body.email } }).then(invite => {
    const mailOptions = {
      from: process.env.NOREPLY_EMAIL,
      subject: 'Identity team invitation',
      text: `
        You have been invited to join a team:

        ${team.name}

        Login at the link below to view the invitation:

        ${process.env.SERVER_DOMAIN}
      `
    };

    if (!invite) {

        /**
         * NOTE TO SELF:
         *
         * Remember to test this leader user_metadata persistence on client-side
         *
         */
        // Auth0 does not return agent scope
        // result.scope = req.user.scope;
        // 2020-4-30 https://stackoverflow.com/a/24498660/1356582
        // This updates the agent's session data
        // req.login(result, err => {
        //   if (err) return next(err);

      const invite = { uuid: req.params.id, recipient: req.body.email, type: 'team', name: team.name };
      models.Invitation.create(invite).then(results => {

        if (!req.user.user_metadata.pendingInvitations) {
          req.user.user_metadata.pendingInvitations = [];
        }
        req.user.user_metadata.pendingInvitations.push(invite);

        const managementClient = getManagementClient([apiScope.update.users, apiScope.read.usersAppMetadata, apiScope.update.usersAppMetadata].join(' '));
        managementClient.updateUser({id: req.user.user_id}, { user_metadata: req.user.user_metadata }).then(result => {

          mailOptions.to = invite.recipient;

          mailer.transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
              console.error('Mailer Error', error);
              return res.status(501).json(error);
            }

            res.status(201).json({ message: 'Invitation sent' });
          });
        }).catch(err => {
          res.status(500).json(err);
        });
      }).catch(err => {
        res.status(500).json(err);
      });
    }
    else {
      mailOptions.to = invite.recipient;

      // 2020-5-7 Force updating the timestamp - https://github.com/sequelize/sequelize/issues/3759
      invite.changed('updatedAt', true);
      invite.save().then(result => {
        return res.status(201).json({ message: 'Invitation sent' });
      }).catch(err => {
        res.status(500).json(err);
      });
    }
  }).catch(err => {
    res.status(500).json(err);
  });
});

/**
 * Accept or reject team invitation
 */
router.get('/:id/invite/:action', checkPermissions([scope.create.teamMembers]), function(req, res, next) {
  const rsvpIndex = req.user.user_metadata.rsvps.findIndex(rsvp => rsvp.uuid === req.params.id && rsvp.type === 'team' && rsvp.recipient === req.user.email);
  if (rsvpIndex < 0) {
    return res.status(404).json({ message: 'No such invitation' });
  }
  const managementClient = getManagementClient(apiScope.read.usersAppMetadata);
  managementClient.getUsers({ search_engine: 'v3', q: `user_metadata.pendingInvitations.uuid:"${req.params.id}"` }).then(agents => {

    /**
     * Can there (or will there ever) be more than one agent in this scenario?
     */
    if (agents.length) {
      let inviteIndex;
      const teamLeader = agents.find(a => {
        if (a.user_metadata && a.user_metadata.pendingInvitations) {
          inviteIndex = a.user_metadata.pendingInvitations.findIndex(i => i.uuid === req.params.id && i.type === 'team' && i.recipient === req.user.email);
          return inviteIndex > -1;
        }
        return false;
      });

      if (!teamLeader) {
        return res.status(404).json({ message: 'No such invitation' });
      }

      if (!req.user.user_metadata.teams) {
        req.user.user_metadata.teams = [];
      }

      if (req.params.action === 'accept') {
        let team = teamLeader.user_metadata.teams.find(t => t.id === req.params.id)
        req.user.user_metadata.teams.push(team);

      }
      else if (req.params.action !== 'reject') {
        return res.status(404).send();
      }

      req.user.user_metadata.rsvps.splice(rsvpIndex, 1);
      teamLeader.user_metadata.pendingInvitations.splice(inviteIndex, 1);

      managementClient.updateUser({id: req.user.user_id}, { user_metadata: req.user.user_metadata }).then(result => {
        managementClient.updateUser({id: teamLeader.user_id}, { user_metadata: teamLeader.user_metadata }).then(result => {
          res.status(201).json(req.user);
        }).catch(err => {
          res.status(err.statusCode).json(err.message.error_description);
        });
      }).catch(err => {
        res.status(err.statusCode).json(err.message.error_description);
      });
    }
    else {
      res.status(404).json({ message: 'No such invitation' });
    }
  }).catch(err => {
    res.status(err.statusCode).json(err.message.error_description);
  });
});


/**
 * Delete pending team invitation
 */
router.delete('/:id/invite', checkPermissions([scope.delete.teamMembers]), function(req, res, next) {
  const inviteIndex = req.user.user_metadata.pendingInvitations.findIndex(invite =>
                                                                          invite.uuid === req.params.id && invite.type === 'team' && invite.recipient === req.body.email);
  if (inviteIndex < 0) {
    return res.status(404).json({ message: 'No such invitation' });
  }

  models.Invitation.destroy({ where: { uuid: req.params.id, recipient: req.body.email } }).then(results => {
    req.user.user_metadata.pendingInvitations.splice(inviteIndex, 1);

    const managementClient = getManagementClient([apiScope.update.users, apiScope.read.usersAppMetadata, apiScope.update.usersAppMetadata].join(' '));
    managementClient.updateUser({id: req.user.user_id}, { user_metadata: req.user.user_metadata }).then(result => {
      res.status(201).json(req.user);
    }).catch(err => {
      res.status(err.statusCode).json(err.message.error_description);
    });
  }).catch(err => {
    res.status(500).json(err);
  });
});


router.delete('/:id/agent/:agentId', checkPermissions([scope.delete.teamMembers]), function(req, res, next) {
  models.Team.findOne({ where: { id: req.params.id },
                                 include: [ 'creator',
                                          { model: models.Agent, as: 'members' },
                                           'organization'] }).then(team => {
    if (!team) {
      return res.status(404).json( { message: 'No such team' });
    }

    if (!req.agent.isSuper && req.agent.email !== team.creator.email) {
      return res.status(401).json( { message: 'Unauthorized' });
    }

    models.Agent.findOne({ where: { id: req.params.agentId } }).then(agent => {
      if (!agent || !team.members.map(member => member.id).includes(agent.id)) {
        return res.status(404).json({ message: 'That agent is not a member' });
      }

      team.removeMember(req.params.agentId).then(results => {
        let mailOptions = {
          to: agent.email,
          from: process.env.NOREPLY_EMAIL,
          subject: 'Identity membership update',
          text: `You are no longer a member of ${team.name}`
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
