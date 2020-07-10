require('dotenv').config();
const models = require('../models');

const apiScope = require('../config/apiPermissions');
const getManagementClient = require('../lib/getManagementClient');

/**
 * 2020-7-10
 *
 * Originally this function was to accommodate team invitations
 * for unknown agents (i.e., agents who have not logged in before).
 *
 * These _invitations_ are more accurately described as Auth0
 * `user_metadata` updates. They update an agent's user_metadata.
 *
 * Using invitations as updates was originally part of the
 * `lib/checkPermissions` module, so most of the functionality is
 * tested in the corresponding spec file.
 *
 * Organization membership is tested in this module's spec file.
 *
 * @params object
 * @params function
 */
function checkForUpdates(req, done) {
  models.Invitation.findAll({where: { recipient: req.user.email }, order: [['updatedAt', 'DESC']]}).then(invites => {
    if (invites.length) {
      if (!req.user.user_metadata) {
        req.user.user_metadata = { rsvps: [], teams: [] };
      }

      if (!req.user.user_metadata.rsvps) {
        req.user.user_metadata.rsvps = [];
      }

      if (!req.user.user_metadata.teams) {
        req.user.user_metadata.teams = [];
      }

      for (let invite of invites) {
        if (invite.type === 'team') {
          let teamIndex = req.user.user_metadata.teams.findIndex(team => team.id === invite.uuid);
          let rsvpIndex = req.user.user_metadata.rsvps.findIndex(rsvp => rsvp.uuid === invite.uuid);

          if (teamIndex > -1) {
            req.user.user_metadata.teams[teamIndex].name = invite.name;
            req.user.user_metadata.teams[teamIndex].organizationId = invite.organizationId;
          }
          else if (rsvpIndex > -1) {
            req.user.user_metadata.rsvps[rsvpIndex].name = invite.name;
          }
          else {
            req.user.user_metadata.rsvps.push({ uuid: invite.uuid, type: invite.type, name: invite.name, recipient: invite.recipient });
          }
        }
        else if (invite.type === 'organization') {
          let teamIndex = req.user.user_metadata.teams.findIndex(team => team.id === invite.teamId);

          if (teamIndex > -1) {
            req.user.user_metadata.teams[teamIndex].organizationId = invite.uuid;
          }
        }
      }

      managementClient = getManagementClient([apiScope.read.users, apiScope.read.usersAppMetadata, apiScope.update.usersAppMetadata].join(' '));
      managementClient.updateUser({id: req.user.user_id}, { user_metadata: req.user.user_metadata }).then(result => {

        models.Invitation.destroy({ where: { recipient: req.user.email } }).then(results => {
          done();
        }).catch(err => {
          done(err);
        });
      }).catch(err => {
        done(err);
      });
    }
    else {
      done();
    }
  }).catch(err => {
    done(err);
  });
};

module.exports = checkForUpdates;

