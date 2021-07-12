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
 * @params object
 * @params function
 */
function checkForUpdates(req, done) {
  models.Update.findAll({where: { recipient: req.user.email }, order: [['updatedAt', 'DESC']]}).then(updates => {
    if (updates.length) {

      /**
       * 2021-7-12
       *
       * The `Update` model will likely be repurposed for inter-app message
       * passing. The code commented below demonstrates how team-org updates
       * were performed prior to removing the associated functionality.
       *
       * This is being preserved for future reference.
       */
      if (!req.user.user_metadata) {
        req.user.user_metadata = {};
      }

      //if (!req.user.user_metadata) {
      //  req.user.user_metadata = { rsvps: [], teams: [] };
      //}
      //
      //if (!req.user.user_metadata.rsvps) {
      //  req.user.user_metadata.rsvps = [];
      //}
      //
      //if (!req.user.user_metadata.teams) {
      //  req.user.user_metadata.teams = [];
      //}
      //
      //for (let update of updates) {
      //  if (update.type === 'team') {
      //    let teamIndex = req.user.user_metadata.teams.findIndex(team => team.id === update.uuid);
      //    let rsvpIndex = req.user.user_metadata.rsvps.findIndex(rsvp => rsvp.uuid === update.uuid);
      //
      //    if (teamIndex > -1) {
      //      req.user.user_metadata.teams[teamIndex].name = update.data.name;
      //      req.user.user_metadata.teams[teamIndex].organizationId = update.data.organizationId;
      //    }
      //    else if (rsvpIndex > -1) {
      //      req.user.user_metadata.rsvps[rsvpIndex] = {...req.user.user_metadata.rsvps[rsvpIndex], data: update.data}
      //    }
      //    else {
      //      req.user.user_metadata.rsvps.push({ uuid: update.uuid, type: update.type, recipient: update.recipient, data: update.data });
      //    }
      //  }
      //  else if (update.type === 'organization') {
      //    let teamIndex = req.user.user_metadata.teams.findIndex(team => team.id === update.data.teamId);
      //
      //    if (teamIndex > -1) {
      //      req.user.user_metadata.teams[teamIndex].organizationId = update.uuid;
      //    }
      //  }
      //}

      managementClient = getManagementClient([apiScope.read.users, apiScope.read.usersAppMetadata, apiScope.update.usersAppMetadata].join(' '));
      managementClient.updateUser({id: req.user.user_id}, { user_metadata: req.user.user_metadata }).then(result => {

        models.Update.destroy({ where: { recipient: req.user.email } }).then(results => {
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

