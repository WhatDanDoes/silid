/**
 * 2020-3-27
 *
 * https://community.auth0.com/t/node-managementclient-getuserroles-is-not-a-function/24514
 *
 * @param string
 */
const ManagementClient = require('auth0').ManagementClient;

function getManagementClient(permissions) {
  return new ManagementClient({
    domain: process.env.AUTH0_DOMAIN,
    clientId: process.env.AUTH0_CLIENT_ID,
    clientSecret: process.env.AUTH0_CLIENT_SECRET,
    scope: permissions
  });
}


module.exports = getManagementClient;
