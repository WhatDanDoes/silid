import React from "react";
import { Container, Row, Col } from "reactstrap";

import Highlight from "../components/Highlight";
import Loading from "../components/Loading";
import { useAuth0, withAuthenticationRequired } from "@auth0/auth0-react";
import { getConfig } from "../config";

/**
 * 2021-4-13
 *
 * Adapted from some awesome examples:
 *
 * https://auth0.com/docs/libraries/auth0-react
 * https://github.com/auth0/auth0-react/blob/master/EXAMPLES.md#4-create-a-useapi-hook-for-accessing-protected-apis-with-an-access-token
 */
export const ProfileComponent = () => {
  const config = getConfig();

  const { getAccessTokenSilently, getAccessTokenWithPopup } = useAuth0();
  const [agent, setAgent] = React.useState(null);

  React.useEffect(() => {
    (async () => {
      try {
        /**
         * It is not necessary to set `scope` here. Identity employs
         * _Role-Based Access Control_ and is aware of the agent's permissions.
         */
        const options = {
          audience: config.audience,
        };

        /**
         * 2021-4-13
         *
         * There's an interesting reason for this nested try-catch block:
         *
         * https://github.com/auth0/auth0-react/issues/65
         *
         * > "Only first party apps can skip the consent. Localhost will never
         *   be a verifiable first party app, so Auth0 will always want to show
         *   the consent screen"
         */
        let token;
        try {
          token = await getAccessTokenSilently(options);
        } catch(e) {
          // `consent_required` error
          console.error(e);
          // Ask the agent for permssion and try again
          token = await getAccessTokenWithPopup(options);
        }
        const response = await fetch(`${config.identity}/agent`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setAgent(await response.json());
      } catch (e) {
        console.error(e);
      }
    })();
    // Leave the dependency array as is.
    //
    // If you do what the linter asks, it starts hammering the API endpoint
    // for some reason. I'd love to know why...
  }, []);

  if (agent) {
    return (
      <Container className="mb-5">
        <Row className="align-items-center profile-header mb-5 text-center text-md-left">
          <Col md={2}>
            <img
              src={agent.picture}
              alt="Profile"
              className="rounded-circle img-fluid profile-picture mb-3 mb-md-0"
            />
          </Col>
          <Col md>
            <h2>{agent.name}</h2>
            <p className="lead text-muted">{agent.email}</p>
          </Col>
        </Row>
        <Row>
          <Highlight>{JSON.stringify(agent, null, 2)}</Highlight>
        </Row>
      </Container>
    );
  }
  return <Loading />;
};

export default withAuthenticationRequired(ProfileComponent, {
  onRedirecting: () => <Loading />,
});
