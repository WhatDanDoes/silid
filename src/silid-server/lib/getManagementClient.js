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
    domain: process.env.AUTH0_M2M_DOMAIN,
    //domain: 'silid-migration.us.auth0.com',
    clientId: process.env.AUTH0_M2M_CLIENT_ID,
    //clientId: 'Zm5fEvtGuCblahblahblahblah',
    clientSecret: process.env.AUTH0_M2M_CLIENT_SECRET,
    //clientSecret: '36YVw0Q-blah-blah-blah',
    /**
     * 2020-12-17
     *
     * Set as such because we have a custom domain.
     *
     * https://auth0.com/docs/custom-domains/configure-features-to-use-custom-domains#apis
     */

    // This probably already correct? Better double check...
    //audience: 'https://silid-migration.us.auth0.com/api/v2/',
    audience: process.env.AUTH0_DEFAULT_AUDIENCE,

    scope: permissions
  });
}

// Original
//
//function getManagementClient(permissions) {
//  return new ManagementClient({
//    domain: process.env.AUTH0_DOMAIN,
//    clientId: process.env.AUTH0_CLIENT_ID,
//    clientSecret: process.env.AUTH0_CLIENT_SECRET,
//    /**
//     * 2020-12-17
//     *
//     * Set as such because we have a custom domain.
//     *
//     * https://auth0.com/docs/custom-domains/configure-features-to-use-custom-domains#apis
//     */
//    audience: process.env.AUTH0_DEFAULT_AUDIENCE,
//    scope: permissions
//  });
//}


module.exports = getManagementClient;
