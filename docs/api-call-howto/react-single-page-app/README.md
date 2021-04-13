Calling the Identity API with a React Single Page Application
=============================================================

This React SPA demonstration application obtains an _access token_ via the Auth0-provided _Universal Login_. It is then submitted in an `Authorization` header to Identity. Upon receipt, Identity verifies the token with Auth0. If the token is legit, Identity fulfills the original request with the authorized agent's full Auth0 profile.

This documentation and the accompanying demo app is a direct plagiarization of [Auth0's own documentation](https://auth0.com/docs/microsites/call-api/call-api-single-page-app). The code was bootstrapped on 2021-4-13.

## React Customization

The bootstrapped code was customized in a manner specific to the React framework. Though related client-side frameworks will employ different methods, if they use `fetch` to call an Identity endpoint they will all follow this basic approach.

Upon authentication, the agent is provided a simple interface to access the app's _Home_, _Profile_, and _External API_ pages. There is a also a _Logout_ link.

_Note:_ The _External API_ link, despite what it suggests, does not contact Identity. Rather, it hits a locally-deployed API server that came bundled with the bootstrapped code. See `api-server.js` for a valuable example of token validation.

The API functionality of interest here is demonstrated when you click on the _Profile_ link. Upon doing so, the demo app sends a request to Identity. It asks to provide the data that only Identity can provide. Most significantly, the data contained in `user_metadata`. What follows is a **simplified** example. Refer to `src/views/Profile.js` to see the full version and some important inline documentation:

```
  const config = getConfig();
  const { getAccessTokenSilently } = useAuth0();
  const [agent, setAgent] = React.useState(null);

  React.useEffect(() => {
    (async () => {
      try {
        const options = {
          audience: config.audience,
        };

        const token = await getAccessTokenSilently(options);

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
  }, []);
```

The configuration of interest for this and any request made to Identity is the `Authorization` header. Upon authentication, the client is allowed to obtain a JWT-encoded string when required. When accompanying a request, the Identity app verifies the token against the Auth0 `GET /userinfo` endpoint. If the token is valid, Identity fulfills the request. If not, an error is returned.

# Auth0 React SDK Sample Application

The folowing is adapted from the original `README.md` included with the Auth0 sample project.

This sample demonstrates the integration of [Auth0 React SDK](https://github.com/auth0/auth0-react) into a React application created using [create-react-app](https://reactjs.org/docs/create-a-new-react-app.html). The sample is a companion to the [Auth0 React SDK Quickstart](https://auth0.com/docs/quickstart/spa/react).

## Project setup

Use `npm` to install the project dependencies:

```bash
npm install
```

## Configuration

### Configure credentials

The project needs to be configured with your Auth0 domain and client ID in order for the authentication flow to work.

To do this, first copy `src/auth_config.json.example` into a new file in the same folder called `src/auth_config.json`, and replace the values with your own Auth0 application credentials and the base URL of the Identity API:

```json
{
  "domain": "{YOUR AUTH0 DOMAIN}",
  "clientId": "{YOUR AUTH0 CLIENT ID}",
  "audience": "{YOUR AUTH0 API_IDENTIFIER}",
  "identity": "{THE BASE URL OF THE IDENTITY API (example: https://id.languagetechnology.org)}"
}
```

## Run the sample

### Compile and hot-reload for development

This compiles and serves the React app at http://localhost:3000. It starts the backend API server on port 3001.

```bash
npm run dev
```

## Deployment

### Compiles and minifies for production

```bash
npm run build
```

