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
    clientId: process.env.AUTH0_M2M_CLIENT_ID,
    clientSecret: process.env.AUTH0_M2M_CLIENT_SECRET,
    /**
     * 2020-12-17
     *
     * Set as such because we have a custom domain.
     *
     * https://auth0.com/docs/custom-domains/configure-features-to-use-custom-domains#apis
     */
    audience: process.env.AUTH0_DEFAULT_AUDIENCE,

    scope: permissions
  });
}

module.exports = getManagementClient;
