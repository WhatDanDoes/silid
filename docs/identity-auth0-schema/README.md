# Auth0-Supported Agent-Profile Schema

One of Auth0's critical core offerings is the [normalization](https://auth0.com/docs/users/user-profiles#data-normalization) of the agent profile data offered by third-party _Identity Providers_ (e.g. Facebook, Google, et al). Another core offering is the ability to [customize an agent's profile](https://auth0.com/docs/users/user-profiles#custom-user-profile-data).

It is through this _profile customization_ that the Identity application enables the creation of custom agent data.

This document is accompanied by a [formal schema definition](https://json-schema.org/). It was inferred using [this tool](https://www.liquid-technologies.com/online-json-to-schema-converter) and can be obtained [here](schema.json).

## The Normalized Auth0 Profile

[Source documentation](https://auth0.com/docs/users/normalized-user-profiles). This is a normalized sample profile:

```
{
  "email": "johnfoo@gmail.com",
  "email_verified": true,
  "family_name": "Foo",
  "gender": "male",
  "given_name": "John",
  "identities": [
    {
      "provider": "google-oauth2",
      "user_id": "103547991597142817347",
      "connection": "google-oauth2",
      "isSocial": true
    }
  ],
  "locale": "en",
  "name": "John Foo",
  "nickname": "FooJon",
  "picture": "https://lh4.googleusercontent.com/-OdsbOXom9qE/AAAAAAAAAAI/AAAAAAAAADU/_j8SzYTOJ4I/photo.jpg",
  "user_id": "google-oauth2|103547991597142817347"
}
```

Find other samples [here](https://auth0.com/docs/users/sample-user-profiles).

Auth0 allows another property in this structure called `user_metadata`. Identity manipulates the structured data within `user_metadata`. What follows documents how each Identity-defined agent role _customizes_ Auth0 data.

## Identity Roles

Currently, Identity has three levels of access constrained by its own scopes:

- Viewer (the default)
- Organizer
- Sudo

The _viewer_ and _organizer_ roles are of interest here, though their distinction is currently only relevant for the old team-organization management feature, which has been removed in this version. Agents in the _sudo_ role can perform all the same operations, but with elevated permissions in many cases.

### General

Upon first authentication, a new agent's `user_metadata` is an empty object:

```
user_metadata: {}
```

Certain data, [though paired with standard OICD claims](https://openid.net/specs/openid-connect-core-1_0.html#StandardClaims), is not returned as part of a _normalized_ agent profile. Likewise, questions concerning schema requirements made it expedient to slot some data into `user_metadata`. This data includes:

- Locale (superseded by _SIL Locale_)
- Timezone (AKA, _zoneinfo_)
- Phone number

At Auth0, `phone_number` is only relevant for SMS users. As such, and though it is part of the agent profile, it is slotted into `user_metadata`. _Locale_ is delivered as part of a normalized profile, but only as two-character locale shortcodes. Timezone is not provided by Auth0.

#### Locale

Setting the SIL Locale preference changes the `user_metadata` as follows:

```
user_metadata: {
  "silLocale": {
    "name": "Klingon",
    "type": "constructed",
    "scope": "individual",
    "iso6393": "tlh",
    "iso6392B": "tlh",
    "iso6392T": "tlh",
  }
}
```

#### Timezone

Building upon the new `user_metadata` shown above, setting the timezone changes the `user_metadata` as follows:

```
user_metadata: {
  "silLocale": {
    "name": "Klingon",
    "type": "constructed",
    "scope": "individual",
    "iso6393": "tlh",
    "iso6392B": "tlh",
    "iso6392T": "tlh",
  },
  "zoneinfo": {
    "name":"America/Edmonton",
    "country": "CA",
    "utcOffset": -420,
    "utcOffsetStr": "-07:00",
    "dstOffset": -360,
    "dstOffsetStr": "-06:00",
    "aliasOf": NULL,
  }
}
```

#### Phone

Now, if an agent were to set a phone number, it would look like this:

```
user_metadata: {
  "silLocale": {
    "name": "Klingon",
    "type": "constructed",
    "scope": "individual",
    "iso6393": "tlh",
    "iso6392B": "tlh",
    "iso6392T": "tlh",
  },
  "zoneinfo": {
    "name":"America/Edmonton",
    "country": "CA",
    "utcOffset": -420,
    "utcOffsetStr": "-07:00",
    "dstOffset": -360,
    "dstOffsetStr": "-06:00",
    "aliasOf": NULL,
  },
  "phone_number": "+1 (403) 266-1234"
}
```

## Summary

This document provides an overview of Identity agent roles and the impact they have on Auth0-supported `user_metadata`. You can inspect your own normalized profile data and the impact of viewer operations in the Identity app itself (expand _Social Data_ at the bottom of the landing screen).


