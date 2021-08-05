context('viewer/Agent show', () => {

  let memberAgent;
  before(function() {
    cy.fixture('google-profile-response').as('profile');
    cy.fixture('permissions.js').as('scope');
  });

  let _profile;
  beforeEach(function() {
    _profile = {...this.profile};
  });

  afterEach(() => {
    cy.task('query', 'TRUNCATE TABLE "Agents" CASCADE;');
    cy.task('query', 'TRUNCATE TABLE "Updates" CASCADE;');
  });

  describe('unauthenticated', done => {
    beforeEach(() => {
      cy.visit(`/#/agent/333`);
    });

    it('shows the home page', () => {
      cy.get('header h1').contains('Identity');
    });

    it('displays the login button', () => {
      cy.get('#login-link').contains('Login');
    });

    it('does not display the logout button', () => {
      cy.get('#logout-button').should('not.exist');
    });

    it('redirects home', () => {
      cy.location('pathname').should('equal', '/');
    });
  });

  describe('authenticated', () => {
    let memberAgent;

    describe('email verified', () => {
      beforeEach(() => {
        // A convenient way to create a new agent
        cy.login('someotherguy@example.com', _profile);
        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someotherguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
          memberAgent = results[0];
        });
      });

      describe('viewing member agent\'s profile', () => {
        beforeEach(() => {
          cy.login('someguy@example.com', _profile);
          cy.visit(`/#/agent/${memberAgent.socialProfile.user_id}`);
          cy.wait(300);
        });

        it('lands in the right spot', () => {
          cy.url().should('contain', `/#/agent/${memberAgent.socialProfile.user_id}`);
        });

        it('displays agent\'s info', () => {
          cy.get('h3').contains('Profile');
          cy.get('#profile-table table tbody tr th').contains('Name:');
          cy.get('#profile-table table tbody tr td input#agent-name-field').should('have.value', memberAgent.socialProfile.name);
          cy.get('#profile-table table tbody tr td input#agent-name-field').should('be.disabled');

          cy.get('#profile-table table tbody tr th').contains('Email:');
          cy.get('#profile-table table tbody tr td').contains(memberAgent.socialProfile.email);

          cy.get('#profile-table table tbody tr th').contains('Provider Locale:');
          cy.get('#profile-table table tbody tr td').contains(memberAgent.socialProfile.locale);

          cy.get('#profile-table table tbody tr th').contains('SIL Locale:');
          cy.get('#profile-table table tbody tr td #sil-local-dropdown').should('be.disabled');

          cy.get('#profile-table table tbody tr:last-of-type th').contains('Roles:');
          cy.get('#profile-table table tbody tr:last-of-type div').its('length').should('eq', 1);
          cy.get('#profile-table table tbody tr:last-of-type div').contains('viewer');
          cy.get('#profile-table table tbody tr:last-of-type div#assign-role').should('not.exist');

          cy.get('button#save-agent').should('not.exist');
          cy.get('button#cancel-agent-changes').should('not.exist');
        });

        it('does not display the assign-role chip', () => {
          cy.get('#profile-table table tbody tr ul li:last-of-type #assign-role').should('not.exist');
        });

        describe('account linking', () => {
          it("does not display a 'Find Linkable Accounts' button", () => {
            cy.get('button#find-linkable-accounts').should('not.exist');
          });

          describe('no linked account', () => {
            it('does not display a linked-accounts table', () => {
              cy.get('#linked-accounts').should('not.exist');
            });
          });

          describe('linked accounts', () => {
            it('displays a linked-accounts table', () => {
              cy.login(_profile.email, {..._profile,
                sub: 'google-oauth2|117550400000000000000',
                identities: [
                  {
                    "provider": "google-oauth2",
                    "access_token": "ya29.abc-12e",
                    "expires_in": 3599,
                    "user_id": "117550400000000000000",
                    "connection": "google-oauth2",
                    "isSocial": true
                  },
                  {
                    "user_id": "60eda0000000000000000000",
                    "provider": "auth0",
                    "connection": "Username-Password-Authentication",
                    "isSocial": false
                  }
                ]
              });
              cy.url().should('contain', '/#/agent');

              cy.visit(`/#/agent/${memberAgent.socialProfile.user_id}`);
              cy.wait(300);
              cy.url().should('contain', `/#/agent/${memberAgent.socialProfile.user_id}`);

              cy.get('#linked-accounts').should('not.exist');
            });
          });
        });

        describe('social profile data', () => {
          it('toggles JSON display', () => {
            cy.get('.react-json-view').its('length').should('eq', 1);

            // Toggle closed
            cy.get('.react-json-view .icon-container .collapsed-icon').should('exist');
            cy.get('.react-json-view .icon-container .expanded-icon').should('not.exist');
            cy.get('.react-json-view').contains('name').should('not.exist');

            // Toggle open
            cy.get('.react-json-view .icon-container .collapsed-icon').click();
            cy.get('.react-json-view .icon-container .expanded-icon').should('exist');

            cy.get('.react-json-view').contains('locale');
            cy.get('.react-json-view').contains('picture');
            cy.get('.react-json-view').contains('user_id');
            cy.get('.react-json-view').contains('name');

            // Toggle closed again
            cy.get('.react-json-view .icon-container .expanded-icon').click();
            cy.get('.react-json-view .icon-container .collapsed-icon').should('exist');
            cy.get('.react-json-view .icon-container .expanded-icon').should('not.exist');
            cy.get('.react-json-view').contains('name').should('not.exist');
          });
        });
      });

      describe('viewing your own profile', () => {

        let agent;
        beforeEach(() => {
          cy.login('someguy@example.com', _profile);
          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
            agent = results[0];
            cy.visit(`/#/agent/${agent.socialProfile.user_id}`);
            cy.wait(500);
          });
        });

        it('lands in the right spot', () => {
          cy.url().should('contain', `/#/agent/${agent.socialProfile.user_id}`);
        });

        it('displays agent\'s info', () => {
          cy.get('h3').contains('Profile');
          cy.get('#profile-table table tbody tr th').contains('Name:');
          cy.get('#profile-table table tbody tr td input#agent-name-field').should('have.value', agent.socialProfile.name);
          cy.get('#profile-table table tbody tr td input#agent-name-field').should('be.disabled');

          cy.get('#profile-table table tbody tr th').contains('Email:');
          cy.get('#profile-table table tbody tr td').contains(agent.socialProfile.email);

          cy.get('#profile-table table tbody tr th').contains('Provider Locale:');
          cy.get('#profile-table table tbody tr td').contains(agent.socialProfile.locale);

          cy.get('#profile-table table tbody tr th').contains('SIL Locale:');
          cy.get('#profile-table table tbody tr td #sil-local-dropdown').should('not.be.disabled');

          cy.get('#profile-table table tbody tr:last-of-type th').contains('Roles:');
          cy.get('#profile-table table tbody tr:last-of-type div').its('length').should('eq', 1);
          cy.get('#profile-table table tbody tr:last-of-type div').contains('viewer');
          cy.get('#profile-table table tbody tr:last-of-type div#assign-role').should('not.exist');

          cy.get('button#save-agent').should('not.exist');
          cy.get('button#cancel-agent-changes').should('not.exist');
        });

        describe('account linking', () => {
          it("displays a 'Find Linkable Accounts' button", () => {
            cy.get('button#find-linkable-accounts').should('exist');
          });

          describe('no linked account', () => {
            it('does not display a linked-accounts table', () => {
              cy.get('#linked-accounts').should('not.exist');
            });
          });

          describe('linked accounts', () => {
            it('displays a linked-accounts table', () => {
              cy.login(_profile.email, {..._profile,
                sub: 'google-oauth2|117550400000000000000',
                identities: [
                  {
                    "provider": "google-oauth2",
                    "access_token": "ya29.abc-12e",
                    "expires_in": 3599,
                    "user_id": "117550400000000000000",
                    "connection": "google-oauth2",
                    "isSocial": true
                  },
                  {
                    "user_id": "60eda0000000000000000000",
                    "provider": "auth0",
                    "connection": "Username-Password-Authentication",
                    "isSocial": false
                  }
                ]
              });
              cy.url().should('contain', '/#/agent');

              cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
                agent = results[0];
                cy.visit(`/#/agent/${agent.socialProfile.user_id}`);
                cy.wait(500);
              });
            });
          });
        });

        describe('social profile data', () => {
          it('toggles JSON display', () => {
            cy.get('.react-json-view').its('length').should('eq', 1);

            // Toggle closed
            cy.get('.react-json-view .icon-container .collapsed-icon').should('exist');
            cy.get('.react-json-view .icon-container .expanded-icon').should('not.exist');
            cy.get('.react-json-view').contains('name').should('not.exist');

            // Toggle open
            cy.get('.react-json-view .icon-container .collapsed-icon').click();
            cy.get('.react-json-view .icon-container .expanded-icon').should('exist');

            cy.get('.react-json-view').contains('locale');
            cy.get('.react-json-view').contains('picture');
            cy.get('.react-json-view').contains('user_id');
            cy.get('.react-json-view').contains('name');

            // Toggle closed again
            cy.get('.react-json-view .icon-container .expanded-icon').click();
            cy.get('.react-json-view .icon-container .collapsed-icon').should('exist');
            cy.get('.react-json-view .icon-container .expanded-icon').should('not.exist');
            cy.get('.react-json-view').contains('name').should('not.exist');
          });
        });
      });
    });

    describe('email not verified', () => {
      beforeEach(() => {
        // A convenient way to create a new agent
        cy.login('someotherguy@example.com', _profile);
        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someotherguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
          memberAgent = results[0];
        });
      });

      describe('viewing member agent\'s profile', () => {
        beforeEach(() => {
          cy.login('someguy@example.com', {..._profile, email_verified: false });
          cy.visit(`/#/agent/${memberAgent.socialProfile.user_id}`);
          cy.wait(300);
        });

        it('lands in the right spot', () => {
          cy.url().should('contain', `/#/agent/${memberAgent.socialProfile.user_id}`);
        });

        it('tells you what\'s up', () => {
          cy.get('#flash-message').contains('Check your email to verify your account');
        });
      });

      describe('viewing your own profile', () => {
        let agent;
        beforeEach(() => {
          cy.login('someguy@example.com', {..._profile, email_verified: false });
          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
            agent = results[0];
            cy.visit(`/#/agent/${agent.socialProfile.user_id}`);
            cy.wait(500);
          });
        });

        it('lands in the right spot', () => {
          cy.url().should('contain', `/#/agent/${agent.socialProfile.user_id}`);
        });

        it('displays agent\'s info', () => {
          cy.get('h3').contains('Profile');
          cy.get('#profile-table table tbody tr th').contains('Name:');
          cy.get('#profile-table table tbody tr td input#agent-name-field').should('have.value', agent.socialProfile.name);
          cy.get('#profile-table table tbody tr td input#agent-name-field').should('be.disabled');

          cy.get('#profile-table table tbody tr th').contains('Email:');
          cy.get('#profile-table table tbody tr td').contains(agent.socialProfile.email);

          cy.get('#profile-table table tbody tr th').contains('Provider Locale:');
          cy.get('#profile-table table tbody tr td').contains(agent.socialProfile.locale);

          cy.get('#profile-table table tbody tr th').contains('SIL Locale:');
          cy.get('#profile-table table tbody tr td #sil-local-dropdown').should('not.be.disabled');

          cy.get('#profile-table table tbody tr:last-of-type th').contains('Roles:');
          cy.get('#profile-table table tbody tr:last-of-type div').its('length').should('eq', 1);
          cy.get('#profile-table table tbody tr:last-of-type div').contains('viewer');
          cy.get('#profile-table table tbody tr:last-of-type div#assign-role').should('not.exist');

          cy.get('button#save-agent').should('not.exist');
          cy.get('button#cancel-agent-changes').should('not.exist');
        });

        describe('account linking', () => {
          it("it does not display a 'Find Linkable Accounts' button", () => {
            cy.get('button#find-linkable-accounts').should('not.exist');
          });

          describe('no linked account', () => {
            it('does not display a linked-accounts table', () => {
              cy.get('#linked-accounts').should('not.exist');
            });
          });

          describe('linked accounts', () => {
            it('displays a linked-accounts table', () => {
              cy.login(_profile.email, {
                ..._profile,
                email_verified: false,
                sub: 'google-oauth2|117550400000000000000',
                identities: [
                  {
                    "provider": "google-oauth2",
                    "access_token": "ya29.abc-12e",
                    "expires_in": 3599,
                    "user_id": "117550400000000000000",
                    "connection": "google-oauth2",
                    "isSocial": true
                  },
                  {
                    "user_id": "60eda0000000000000000000",
                    "provider": "auth0",
                    "connection": "Username-Password-Authentication",
                    "isSocial": false
                  }
                ]
              });
              cy.url().should('contain', '/#/agent');

              cy.visit(`/#/agent/${agent.socialProfile.user_id}`);
              cy.wait(300);
              cy.url().should('contain', `/#/agent/${agent.socialProfile.user_id}`);

              cy.get('#linked-accounts').should('not.exist');
            });
          });
        });

        describe('social profile data', () => {
          it('toggles JSON display', () => {
            cy.get('.react-json-view').its('length').should('eq', 1);

            // Toggle closed
            cy.get('.react-json-view .icon-container .collapsed-icon').should('exist');
            cy.get('.react-json-view .icon-container .expanded-icon').should('not.exist');
            cy.get('.react-json-view').contains('name').should('not.exist');

            // Toggle open
            cy.get('.react-json-view .icon-container .collapsed-icon').click();
            cy.get('.react-json-view .icon-container .expanded-icon').should('exist');

            cy.get('.react-json-view').contains('locale');
            cy.get('.react-json-view').contains('picture');
            cy.get('.react-json-view').contains('user_id');
            cy.get('.react-json-view').contains('name');

            // Toggle closed again
            cy.get('.react-json-view .icon-container .expanded-icon').click();
            cy.get('.react-json-view .icon-container .collapsed-icon').should('exist');
            cy.get('.react-json-view .icon-container .expanded-icon').should('not.exist');
            cy.get('.react-json-view').contains('name').should('not.exist');
          });
        });
      });
    });
  });
});

export {}
