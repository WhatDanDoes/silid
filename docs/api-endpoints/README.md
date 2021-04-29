Identity API Endpoints
======================

This document describes the Identity API, which is meant to be used by SIL applications to consume and modify agent profile data managed by Auth0 (where permitted). It defines and constrains allowable operations performed against the [Auth0 Management API](https://auth0.com/docs/api/management/v2).

# Authentication

## How do I get an Authorization Token?

This depends on the type of application. Auth0 provides several template projects that demonstrate the different schemes available. You may also refer to the [API call _howto_ documentation](../api-call-howto), which provide Identity-specific examples of how to obtain a token and access an agent's full Auth0 profile.


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

The _viewer_ role is the default assigned to all new Identity agents. Agents in the _organizer_ and _sudo_ roles can perform all the same operations, but with elevated permissions as described below.

## General

Agents may authenticate against Auth0 via a third-party identity provider like Google, or they may sign up for Auth0-managed _User-Password_ authentication. Identity allows all roles to modify their own _SIL locale_, _timezone_, and _phone number_.

If you are a User-Password-authenticated agent, you may also update fields like _name_, _family name_, _given name_, or _nickname_. The Auth0-stored values for these can be modified for third-party IdP agents, but any changes will be clobbered the next time they authenticate.

```
const response = await fetch(`/agent/${agent_id}`,
  {
    method: 'PATCH',
    body: JSON.stringify({
      name: 'Some Guy',
      given_name: 'Some',
      family_name: 'Guy',
      nickname: 'Guy Lafleur'
    }),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type', 'application/json; charset=utf-8'
    },
  }
);
```

### SIL Locale

Identity comes in-built with support for every _living_ and _constructed_ ISO 639-3 language (as per this [`npm` module](https://www.npmjs.com/package/iso-639-3)).

Execute the following to obtain a list of Identity-supported locales:

```
const response = await fetch('/locale/supported',
  {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type', 'application/json; charset=utf-8'
    },
  }
);
```

This will return an array of objects:

```
[
...
  {
    "name": "Klingon",
    "type": "constructed",
    "scope": "individual",
    "iso6393": "tlh",
    "iso6392B": "tlh",
    "iso6392T": "tlh",
  },
...
]
```

For information on this and subsequent data structures, refer to the [schema document](../identity-auth0-schema/) already mentioned above.

To set an agent's SIL locale, provide the value associated with the _iso6393_ key (_tlh_, as above):

```
const response = await fetch(`/locale/${lang.iso6393}`,
  {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type', 'application/json; charset=utf-8'
    },
  }
);
```

### Timezone

Identity supports timezones of the format defined in the [countries-and-timezones](https://www.npmjs.com/package/countries-and-timezones) `npm` module.

Execute the following to obtain a list of timezones:

```
const response = await fetch('/timezone',
  {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type', 'application/json; charset=utf-8'
    },
  }
);
```

This will return an array of objects:

```
[
...
  {
    name: 'America/Los_Angeles',
    country: 'US',
    utcOffset: -480,
    utcOffsetStr: '-08:00',
    dstOffset: -420,
    dstOffsetStr: '-07:00',
    aliasOf: null
  },
...
]
```

To set an agent's timezone, provide the value associated with the _name_ key (_America/Los_Angeles_, as above):

```
const response = await fetch(`/timezone/${agent_id}`,
  {
    method: 'PUT',
    body: JSON.stringify({
      timezone: 'America/Los_Angeles',
    }),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type', 'application/json; charset=utf-8'
    },
  }
);
```

### Phone Number

The Identity client-side app enforces phone number formatting. Numbers submitted via the Identity API have no such validation. It is up to the API consumer to ensure that phone number strings are submitted in a _recognized_ format.

Execute the following to update an agent's phone number:

```
const response = await fetch(`/agent/${agent_id}`,
  {
    method: 'PATCH',
    body: JSON.stringify({
      phone_number: '+1 (403) 266-1234',
    }),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type', 'application/json; charset=utf-8'
    },
  }
);
```

## Viewer Role

A viewer agent can create _teams_ and invite other agents to join.

Create a team:

```
const response = await fetch(`/team`,
  {
    method: 'POST',
    body: JSON.stringify({
      name: 'The A Team',
      leader: 'coach@example.com',
    }),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type', 'application/json; charset=utf-8'
    },
  }
);
```

Read a team:

```
const response = await fetch(`/team/{team_id}`,
  {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type', 'application/json; charset=utf-8'
    },
  }
);
```

Read all an agent's teams:

```
const response = await fetch(`/team`,
  {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type', 'application/json; charset=utf-8'
    },
  }
);
```

Update a team:

```
const response = await fetch(`/team/${team_id}`,
  {
    method: 'PUT',
    body: JSON.stringify({
      name: 'The B Team',
    }),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type', 'application/json; charset=utf-8'
    },
  }
);
```

Delete a team:

```
const response = await fetch(`/team/${team_id}`,
  {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type', 'application/json; charset=utf-8'
    },
  }
);
```

#### Team Invitations

Invite an agent to join a team:

```
const response = await fetch(`/team/${team_id}/agent`,
  {
    method: 'PUT',
    body: JSON.stringify({
      email: 'brandnewteammate@example.com',
    }),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type', 'application/json; charset=utf-8'
    },
  }
);
```

An invitation has two sides: a `pendingInvitation` registered with the team leader, and an `rsvp` given to the potential team member. These are stored in each agent's _user_metadata_ and can be retrieved with a `GET /agent` call, as in the first example provided in this document.

To accept invitation:

```
const response = await fetch(`/team/${team_id}/invite/accept`,
  {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type', 'application/json; charset=utf-8'
    },
  }
);
```

Reject an invitation:

```
const response = await fetch(`/team/${team_id}/invite/reject`,
  {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type', 'application/json; charset=utf-8'
    },
  }
);
```

A team leader may rescind a pending invitation:

```
const response = await fetch(`/team/${team_id}/invite`,
  {
    method: 'DELETE',
    body: JSON.stringify({
      email: 'brandnewteammate@example.com',
    }),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type', 'application/json; charset=utf-8'
    },
  }
);
```

A team leader may revoke membership:

```
const response = await fetch(`/team/${team_id}/agent/${former_member_id}`,
  {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type', 'application/json; charset=utf-8'
    },
  }
);
```

## Organizer Role

An organizer agent can create _organizations_ and add _teams_ to their membership.

Create an organization:

```
const response = await fetch(`/organization`,
  {
    method: 'POST',
    body: JSON.stringify({
      name: 'The Umbrella Corporation',
      organizer: 'boss@example.com',
    }),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type', 'application/json; charset=utf-8'
    },
  }
);
```

Read an organization:

```
const response = await fetch(`/organization/{organization_id}`,
  {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type', 'application/json; charset=utf-8'
    },
  }
);
```

Read all an agent's organizations:

```
const response = await fetch(`/organization`,
  {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type', 'application/json; charset=utf-8'
    },
  }
);
```

Update an organization:

```
const response = await fetch(`/organization/${organization_id}`,
  {
    method: 'PUT',
    body: JSON.stringify({
      name: 'General Systems',
    }),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type', 'application/json; charset=utf-8'
    },
  }
);
```

Delete an organization:

```
const response = await fetch(`/organization/${organization_id}`,
  {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type', 'application/json; charset=utf-8'
    },
  }
);
```

An organizer agent may also retrieve a complete list of agents known to Identity. These are returned 30 agents to a page:

```
const response = await fetch(`/agent/admin/${page_number}`,
  {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type', 'application/json; charset=utf-8'
    },
  }
);
```

#### Organization Membership

A team may be added to an organization:

```
const response = await fetch(`/organization/${organization_id}/team`,
  {
    method: 'PUT',
    body: JSON.stringify({
      teamId: team_id,
    }),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type', 'application/json; charset=utf-8'
    },
  }
);
```

A team may be removed from an organization:

```
const response = await fetch(`/organization/${organization_id}/team/${team_id}`,
  {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type', 'application/json; charset=utf-8'
    },
  }
);
```

## Sudo Role

A sudo agent has certain elevated privileges, though this is not an _all powerful_ role. Sudo control will likely expand as expectations of the Identity API evolve. What follows is a summary of the requests a sudo agent is allowed to perform on behalf of non-privileged agents.

### General

A sudo agent may set another agent's timezone:

```
const response = await fetch(`/timezone/${agent_id}`,
  {
    method: 'PUT',
    body: JSON.stringify({
      timezone: 'America/Los_Angeles',
    }),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type', 'application/json; charset=utf-8'
    },
  }
);
```

Change a phone number:

```
const response = await fetch(`/agent/${agent_id}`,
  {
    method: 'PATCH',
    body: JSON.stringify({
      phone_number: '+1 (403) 266-1234',
    }),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type', 'application/json; charset=utf-8'
    },
  }
);
```

If an agent is User-Password authenticated, the sudo agent may update name details:

```
const response = await fetch(`/agent/${agent_id}`,
  {
    method: 'PATCH',
    body: JSON.stringify({
      name: 'Some Guy',
      given_name: 'Some',
      family_name: 'Guy',
      nickname: 'Guy Lafleur'
    }),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type', 'application/json; charset=utf-8'
    },
  }
);
```

### Teams

Update a team:

```
const response = await fetch(`/team/${team_id}`,
  {
    method: 'PUT',
    body: JSON.stringify({
      name: 'The B Team',
    }),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type', 'application/json; charset=utf-8'
    },
  }
);
```

Delete a team:

```
const response = await fetch(`/team/${team_id}`,
  {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type', 'application/json; charset=utf-8'
    },
  }
);
```

### Team Membership

Remove an agent from a team:

```
const response = await fetch(`/team/${team_id}/agent/${team_member_id}`,
  {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type', 'application/json; charset=utf-8'
    },
  }
);
```

### Organizations

Update an organization:

```
const response = await fetch(`/organization/${organization_id}`,
  {
    method: 'PUT',
    body: JSON.stringify({
      name: 'General Systems',
    }),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type', 'application/json; charset=utf-8'
    },
  }
);
```

Delete an organization:

```
const response = await fetch(`/organization/${organization_id}`,
  {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type', 'application/json; charset=utf-8'
    },
  }
);
```

### Organization Membership

Remove a team from an organization:

```
const response = await fetch(`/organization/${organization_id}/team/${team_id}`,
  {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type', 'application/json; charset=utf-8'
    },
  }
);
```

### Agent Roles

Sudo's most powerful privilege is the ability to assign roles to agents. That is, the sudo role is the only role able to assign _organizer_ or _sudo_ status.

Retrieve a list of all roles:

```
const response = await fetch('/role',
  {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type', 'application/json; charset=utf-8'
    },
  }
);
```

Assign a role:

```
const response = await fetch(`/role/${roles_id}/agent/${new_organizer_id}`,
  {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type', 'application/json; charset=utf-8'
    },
  }
);
```

Divest an agent of an assigned role:

```
const response = await fetch(`/role/${roles_id}/agent/${former_organizer_id}`,
  {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type', 'application/json; charset=utf-8'
    },
  }
);
```

# Conclusion/Confession

At the time of writing, third-party consumption of these endpoints has not been proven _in the wild_. There will definitely be errors and oversights in this documentation. If you've discovered such a shortcoming, please open an [issue](https://github.com/sillsdev/silid/issues).


