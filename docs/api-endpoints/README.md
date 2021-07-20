Identity API Endpoints
======================

This document describes the Identity API, which is meant to be used by SIL applications to consume and modify agent profile data managed by Auth0 (where permitted). It defines and constrains allowable operations performed against the [Auth0 Management API](https://auth0.com/docs/api/management/v2).

# Authentication

## How do I get an Authorization Token?

This depends on the type of application. Auth0 provides several template projects that demonstrate the different schemes available. You may also refer to the [API call _howto_ documentation](../api-call-howto), which provides Identity-specific examples of how to obtain a token and access an agent's full Auth0 profile.


## Making Authenticated Requests

Requests sent to Identity require the authorization token to be included as part of the `Authorization` HTTP header using the `Bearer` authentication scheme.

```
const response = await fetch('https://id-dev.languagetechnology.org/agent', {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
```

Provided a valid access token, this will retrieve the agent's full profile. See [Auth0-Supported Agent-Profile Schema](../identity-auth0-schema/).

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

### Email Verification

Most applications will ensure that an authenticated agent has a _verified_ email address before allowing full access to the app's functionality. The `POST /agent/verify` endpoint sends or _re_-sends the verification email. An email will only be sent if the agent's email is not already verified.

```
const response = await fetch(`/agent/verify`,
  {
    method: 'POST',
    body: JSON.stringify({
      id: agent_id,
    }),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type', 'application/json; charset=utf-8'
    },
  }
);
```

### Account Linking and Unlinking

Identity offers endpoints to link and unlink Auth0-managed accounts registered with the same email address.

To search for [_linkable_](https://auth0.com/docs/api/management/v2#!/Users_By_Email/get_users_by_email) accounts:

```
const response = await fetch(`/agent/profiles`,
  {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type', 'application/json; charset=utf-8'
    },
  }
);
```

This returns an array of Auth0 profiles registered with a matching email address. Each profile object in the array will contain an `identities` property, which is an array of linked Auth0 accounts. See the Auth0 documentation for [how this works](https://auth0.com/docs/users/user-account-linking#how-it-works). A sample `identities` array is included here for convenience:

```
{
  ...
  "identities": [
    {
      "user_id": "560ebaeef609ee1adaa7c551",
      "provider": "sms",
      "connection": "sms",
      "isSocial": false
    }
  ],
  ...
}
```

An agent may link the currently authenticated account (i.e., the _primary_ account) by providing properties from one of these _secondary_ account _identity_ objects:

```
const response = await fetch(`/agent/link`,
  {
    method: 'PUT',
    body: JSON.stringify({
      user_id: '560ebaeef609ee1adaa7c551',
      provider: 'sms',
    }),
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type', 'application/json; charset=utf-8'
    },
  }
);
```

Executed successfully, the above call will combine the accounts managed by Auth0 and return a new `identities` array with the _secondary_ profile properties stored in `profileData`:

```
[
  {
    "provider": "google-oauth2",
    "user_id": "115015401343387192604",
    "connection": "google-oauth2",
    "isSocial": true
  },
  {
    "profileData": {
      "phone_number": "+14258831929",
      "phone_verified": true,
      "name": "+14258831929"
    },
    "user_id": "560ebaeef609ee1adaa7c551",
    "provider": "sms",
    "connection": "sms",
    "isSocial": false
  }
]
```

To unlink this account:

```
const response = await fetch(`/agent/link/${secondary_provider}/${secondary_user_id}`,
  {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type', 'application/json; charset=utf-8'
    },
  }
);
```

This de-couples the accounts at Auth0 and returns an array with the `identity` object just removed:

```
[
  {
    "profileData": {
      "phone_number": "+14258831929",
      "phone_verified": true,
      "name": "+14258831929"
    },
    "user_id": "560ebaeef609ee1adaa7c551",
    "provider": "sms",
    "connection": "sms",
    "isSocial": false
  }
]
```

## Viewer Role

This is the default role assigned immediately upon first authentication.

## Organizer Role

An organizer agent may retrieve a complete list of agents known to Identity. These are returned 30 agents to a page:

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


