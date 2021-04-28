Identity API Endpoints
======================

This document describes the Identity API, which is meant to be used by SIL applications to consume and modify agent profile data managed by Auth0 (where permitted). It defines and constrains allowable operations performed against the [Auth0 Management API](https://auth0.com/docs/api/management/v2).

# Authentication

## How do I get an Authorization Token?

This depends on the type of application. Auth0 provides several boilerplate projects that demonstrate the difference schemes available. You may also refer to the [Authorization Code Flow examples](../api-call-howto), which provide Identity-specific examples of how to obtain a token and access an agent's full Auth0 profile.


## Making Authenticated Requests

Requests sent to Identity require the authorization token to be included as part of the `Authorization` HTTP header using the `Bearer` authentication scheme.

```
const response = await fetch('https://id-dev.languagetechnology.org/agent', {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
```

Provided a valid access token, this will retrieve the agent's full profile. See [Auth0-Supported Agent-Profile Schema for Team-Organization Modelling](../identity-auth0-schema/).

# Role-Based Access

Identity has three levels of access constrained by its own scopes:

- Viewer (the default)
- Organizer
- Sudo

The _viewer_ and _organizer_ roles are of interest here. Agents in the _sudo_ role can perform all the same operations, but with elevated permissions in many cases.

## General

Identity allows all roles to modify their own _locale_, _timezone_, and _phone number_. _User-Password_- authenticated agents can also update fields managed by Auth0 (e.g., _nickname_).

#### Locale



#### Timezone


#### Phone
