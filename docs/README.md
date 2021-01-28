The subject of _mental models_ was raised during the SIL global staff meeting on January 26, 2021. SIL leadership invited input on how we explain real-world phenomenon collectively and as individuals. Which mental models are good and worth preserving? Which mental models are bad and should be abandoned? May God allow us all discernment in this capacity.

SIL Identity is where mental models collide. It was born of a marriage that might not seem unusual at first: [Express](https://expressjs.com/), React bootstrapped with [create-react-app](https://github.com/facebook/create-react-app), and [PostgreSQl](https://www.postgresql.org/) backed by the [Sequelize ORM](https://sequelize.org/).

![Core software](figures/core-software.svg)

Apart from the intricacies of `create-react-app`, these were all technologies with which I was familiar and reasonbly _on trend_. I think `create-react-app` imposes a good mental model of how a React project should be organized. It even enforces this model to a degree by constraining development around a build tool preset configurations. If you are not satisified with how how `create-react-app` manages your project, you have the option to [eject](https://create-react-app.dev/docs/available-scripts/) yourself free from those pre-baked constraints.

The Identity application leverages the [Auth0](https://auth0.com/) authentication/access-management platform. Though I was vaguely familiar with OAuth in general, I had no prior knowledge of this third-party service. My appreciation quickly grew as I reverse-engineered its [Authorization Code Flow](https://auth0.com/docs/flows/authorization-code-flow) interactions with my tried-and-true favourite test tools, [Jasmine](https://jasmine.github.io/), [ZombieJS](http://zombie.js.org/), [Nock](https://github.com/nock/nock), and many more.

![Server-side test tools](figures/server-test-tools.svg)

These tests, of course, can only be applied to the [server side](https://github.com/sillsdev/silid/tree/master/src/silid-server) of the Identity application. If measured on a scale of _difficulty_, server-side testing typically falls on the _easy_ end of the spectrum. But Identity has three sides _(at least)_. Testing the [client side](https://github.com/sillsdev/silid/tree/master/src/identity-react) software bootstrapped by `create-react-app` necessitated the introduction of an independent [mock server](https://github.com/sillsdev/silid/blob/master/src/silid-server/spec/support/mockAuth0ServerWithRBAC.js) to occupy the _authentication side_ in place of Auth0. The mock server was built with [Hapi](https://hapi.dev/). You'd think that this by itself would be tricky enough, but no. The _mental model_ constraints enforced by `create-react-app` raised issues so horribly mundane that we all must pray that I never be allowed to expound upon them at great length.

Looking back, I'm glad that ejecting the app wasn't an option. I once had a seminary professor - a favourite among favourites - who said to me, _constraints breed innovation_. And although he probably stole the line, it's no less true. The constraints imposed by `create-react-app`'s strict mental model necessitated a testing topology that closely mirrors the Identity application as deployed in _real life_. This software arrangment is proven with tests executed by [Cypress](https://www.cypress.io/). The client-side component of Identity is a seperate application, afterall. As such, it requires a set of integration tests seperate from its server-side component.

![End-to-end test tools](figures/e2e-test-tools.svg)




That arrangement is as follows:







The benefits of a true-to-form testing configuration reveal themselves immediately when addressing questions from security-minded folk that typically take the form _Well, what if some nefarious hacker did _this_ or _that_?_ Such a topology empowers the concerned party to write a test, see what happens, and submit a pull request when the hole has been fixed.





