// Can't import regular Javascript as a fixture
import rolePermissions from '../../fixtures/roles-with-permissions.js';

context('root/Agent linking', function() {

  let memberAgent;
  before(function() {
    cy.fixture('google-profile-response').as('profile');
    cy.fixture('permissions.js').as('scope');
    cy.fixture('roles-defined-at-auth0.json').as('roleDescriptions');
  });

  let sudoRole;
  before(function() {
    /**
     * 2020-7-16
     * Why can't this happen in the `before` block above?
     */
    sudoRole = this.roleDescriptions.find(r => r.name === 'sudo');
  });

  afterEach(() => {
    cy.task('query', 'TRUNCATE TABLE "Agents" CASCADE;');
    cy.task('query', 'TRUNCATE TABLE "Updates" CASCADE;');
  });

  let _profile, rootAgent;
  beforeEach(function() {
    // Root email set in `silid-server/.env`
    _profile = {...this.profile, email: 'root@example.com', name: 'Professor Fresh'};

    // A convenient way to create a new agent
    cy.login(_profile.email, {..._profile}, rolePermissions.sudo);
    // Make this agent root via a call to the mock server
    cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
      rootAgent = results[0];
      cy.request('POST', `https://localhost:3002/api/v2/users/${rootAgent.socialProfile.user_id}/roles`, { roles: [sudoRole.id] });
    });
  });


  describe('root agent\'s own profile', () => {

    describe('#find-linkable-accounts button', () => {

      describe('no linkable accounts exist', () => {

        beforeEach(() => {
          cy.login(_profile.email, {..._profile}, rolePermissions.sudo);
          cy.get('#flash-message #close-flash').click();
        });

        it('displays a progress spinner', () => {
          cy.get('#load-linkable-spinner').should('not.exist');
          cy.get('#find-linkable-accounts').should('not.be.disabled');
          cy.get('#find-linkable-accounts').click();
          cy.wait(300);
          // Cypress goes too fast for the spinner. This ensures it disappears when done
          //cy.get('#load-linkable-spinner').should('exist');
          cy.get('#load-linkable-spinner').should('not.exist');
          cy.get('#find-linkable-accounts').should('not.be.disabled');
        });

        it('displays a friendly message', () => {
          cy.get('#flash-message').should('not.exist');
          cy.get('#find-linkable-accounts').click();
          cy.wait(300);
          cy.get('#flash-message').contains('No linkable accounts');
        });

        it('does not display linkable-accounts table', () => {
          cy.get('#linkable-accounts').should('not.exist');
          cy.get('#find-linkable-accounts').click();
          cy.wait(300);
          cy.get('#linkable-accounts').should('not.exist');
        });
      });

      describe('account is already linked to another', () => {

        beforeEach(() => {
          cy.login(_profile.email, {
            ..._profile,
            identities: [
              {
                connection: 'google-oauth2',
                user_id: '111110000000',
                provider: 'google-oauth2',
                isSocial: true,
              },
              {
                connection: 'twitter',
                user_id: 'abc-123',
                provider: 'twitter',
                isSocial: true,
              }
            ]
          });
          cy.wait(300);
          cy.get('#flash-message #close-flash').click();

          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
            rootAgent = results[0];
          });
        });

        it('displays linked account info in the linkable-accounts table', () => {
          cy.get('#linked-accounts').should('exist');
          cy.get('#linked-accounts tbody').find('tr').should('have.length', 1);

          cy.get('#linked-accounts tbody tr td.connection').contains('twitter');
          cy.get('#linked-accounts tbody tr td.is-social').contains('true');
          cy.get('#linked-accounts tbody tr td.provider').contains('twitter');
          cy.get('#linked-accounts tbody tr td.user-id').contains('abc-123');
          cy.get('#linked-accounts tbody tr td.action').contains('Unlink');
        });
      });

      describe('linkable accounts exist', () => {

        let linkableAcct;
        beforeEach(() => {
          cy.login('root@pretendthisisthesameemail.com', { ..._profile });
          cy.wait(300);
          cy.login(_profile.email, {..._profile });
          cy.get('#flash-message #close-flash').click();

          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='root@pretendthisisthesameemail.com' LIMIT 1;`).then(([results, metadata]) => {
            linkableAcct = results[0];
          });

          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
            rootAgent = results[0];
          });
        });

        it('displays a progress spinner', () => {
          cy.get('#load-linkable-spinner').should('not.exist');
          cy.get('#find-linkable-accounts').should('not.be.disabled');
          cy.get('#find-linkable-accounts').click();
          cy.wait(300);
          // Cypress goes too fast for the spinner. This ensures it disappears when done
          //cy.get('#load-linkable-spinner').should('exist');
          cy.get('#load-linkable-spinner').should('not.exist');
          cy.get('#find-linkable-accounts').should('not.be.disabled');
        });

        it('displays linkable account info in a linkable-accounts table', () => {
          cy.get('#linkable-accounts').should('not.exist');
          cy.get('#find-linkable-accounts').click();
          cy.wait(300);
          cy.get('#linkable-accounts').should('exist');
          cy.get('#linkable-accounts tbody').find('tr').should('have.length', 1);

          cy.get('#linkable-accounts tbody tr td.connection').contains(linkableAcct.socialProfile.identities[0].connection);
          cy.get('#linkable-accounts tbody tr td.is-social').contains(`${linkableAcct.socialProfile.identities[0].isSocial}`);
          cy.get('#linkable-accounts tbody tr td.provider').contains(linkableAcct.socialProfile.identities[0].provider);
          cy.get('#linkable-accounts tbody tr td.user-id').contains(linkableAcct.socialProfile.identities[0].user_id);
          cy.get('#linkable-accounts tbody tr td.action').contains('Link');
        });

        describe('linking', () => {
          beforeEach(() => {
            cy.get('#find-linkable-accounts').click();
          })

          it('displays a progress spinner', () => {
            cy.get('.link-account-spinner').should('not.exist');
            cy.get('.link-accounts').first().click();
            cy.wait(300);
            // Cypress goes too fast for the spinner. This ensures it disappears when done
            //cy.get('.link-account-spinner').should('exist');
            cy.get('.link-account-spinner').should('not.exist');
          });

          it('displays a friendly message', () => {
            cy.get('#flash-message').should('not.exist');
            cy.get('.link-accounts').first().click();
            cy.wait(300);
            cy.get('#flash-message').contains('Accounts linked');
          });

          it('removes the account from the linkable-accounts table', () => {
            cy.get('#linkable-accounts tbody').find('tr').should('have.length', 1);
            cy.get('.link-accounts').first().click();
            cy.wait(300);
            cy.get('#linkable-accounts').should('not.exist');
          });

          it('adds the account to the linked-accounts table with an "Unlink" button', () => {
            cy.get('#linked-accounts').should('not.exist');
            cy.get('#linkable-accounts tbody tr td.action').contains('Link');
            cy.get('.link-accounts').first().click();
            cy.wait(300);
            cy.get('#linked-accounts tbody tr td.action').contains('Unlink');
            cy.get('#linked-accounts tbody').find('tr').should('have.length', 1);

            cy.get('#linked-accounts tbody tr td.connection').contains(linkableAcct.socialProfile.identities[0].connection);
            cy.get('#linked-accounts tbody tr td.is-social').contains(`${linkableAcct.socialProfile.identities[0].isSocial}`);
            cy.get('#linked-accounts tbody tr td.provider').contains(linkableAcct.socialProfile.identities[0].provider);
            cy.get('#linked-accounts tbody tr td.user-id').contains(linkableAcct.socialProfile.identities[0].user_id);
            cy.get('#linked-accounts tbody tr td.action').contains('Unlink');
          });

          describe('unlinking', () => {
            beforeEach(() => {
              cy.get('.link-accounts').first().click();
              cy.get('#flash-message #close-flash').click();
            })

            it('displays a progress spinner', () => {
              cy.get('.link-account-spinner').should('not.exist');
              cy.get('.unlink-accounts').first().click();
              cy.wait(300);
              // Cypress goes too fast for the spinner. This ensures it disappears when done
              //cy.get('.link-account-spinner').should('exist');
              cy.get('.link-account-spinner').should('not.exist');
            });

            it('displays a friendly message', () => {
              cy.get('#flash-message').should('not.exist');
              cy.get('.unlink-accounts').first().click();
              cy.wait(300);
              cy.get('#flash-message').contains('Accounts unlinked');
            });

            it('removes the account from the linked-accounts table', () => {
              cy.get('#linked-accounts tbody').find('tr').should('have.length', 1);
              cy.get('.unlink-accounts').first().click();
              cy.wait(300);
              cy.get('#linked-accounts tbody').should('not.exist');
            });

            it('adds the account to the linkable-accounts table with a "Link" button', () => {
              cy.get('#linkable-accounts').should('not.exist');
              cy.get('#linked-accounts tbody tr td.action').contains('Unlink');
              cy.get('.unlink-accounts').first().click();
              cy.wait(300);
              cy.get('#linkable-accounts tbody tr td.action').contains('Link');
              cy.get('#linkable-accounts tbody').find('tr').should('have.length', 1);

              cy.get('#linkable-accounts tbody tr td.connection').contains(linkableAcct.socialProfile.identities[0].connection);
              cy.get('#linkable-accounts tbody tr td.is-social').contains(`${linkableAcct.socialProfile.identities[0].isSocial}`);
              cy.get('#linkable-accounts tbody tr td.provider').contains(linkableAcct.socialProfile.identities[0].provider);
              cy.get('#linkable-accounts tbody tr td.user-id').contains(linkableAcct.socialProfile.identities[0].user_id);
              cy.get('#linkable-accounts tbody tr td.action').contains('Link');
            });
          });
        });
      });
    });
  });

  describe('regular agent\'s profile', () => {

    let regularAgent, rootAgent;
    beforeEach(function() {
      // A convenient way to create a new agent
      cy.login('someotherguy@example.com', {..._profile, email: 'someotherguy@example.com', name: 'Some Other Guy' });
      cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someotherguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
        regularAgent = results[0];

        cy.login(_profile.email, {..._profile}, rolePermissions.sudo);
        cy.visit(`/#/agent/${regularAgent.socialProfile.user_id}`);
        cy.wait(300);
      });
    });


    describe('#find-linkable-accounts button', () => {

      describe('no linkable accounts exist', () => {

        it('displays a progress spinner', () => {
          cy.get('#load-linkable-spinner').should('not.exist');
          cy.get('#find-linkable-accounts').should('not.be.disabled');
          cy.get('#find-linkable-accounts').click();
          cy.wait(300);
          // Cypress goes too fast for the spinner. This ensures it disappears when done
          //cy.get('#load-linkable-spinner').should('exist');
          cy.get('#load-linkable-spinner').should('not.exist');
          cy.get('#find-linkable-accounts').should('not.be.disabled');
        });

        it('displays a friendly message', () => {
          cy.get('#flash-message').should('not.exist');
          cy.get('#find-linkable-accounts').click();
          cy.wait(300);
          cy.get('#flash-message').contains('No linkable accounts');
        });

        it('does not display linkable-accounts table', () => {
          cy.get('#linkable-accounts').should('not.exist');
          cy.get('#find-linkable-accounts').click();
          cy.wait(300);
          cy.get('#linkable-accounts').should('not.exist');
        });
      });

      describe('account is already linked to another', () => {

        beforeEach(() => {
          cy.login('someotherguy@example.com', {
            ..._profile,
            email: 'someotherguy@example.com',
            name: 'Some Other Guy',
            identities: [
              {
                connection: 'google-oauth2',
                user_id: '111110000000',
                provider: 'google-oauth2',
                isSocial: true,
              },
              {
                connection: 'twitter',
                user_id: 'abc-123',
                provider: 'twitter',
                isSocial: true,
              }
            ]
          });

          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someotherguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
            regularAgent = results[0];

            cy.login(_profile.email, {..._profile}, rolePermissions.sudo);
            cy.visit(`/#/agent/${regularAgent.socialProfile.user_id}`);
            cy.wait(300);
          });
        });

        it('displays linked account info in the linkable-accounts table', () => {
          cy.get('#linked-accounts').should('exist');
          cy.get('#linked-accounts tbody').find('tr').should('have.length', 1);

          cy.get('#linked-accounts tbody tr td.connection').contains('twitter');
          cy.get('#linked-accounts tbody tr td.is-social').contains('true');
          cy.get('#linked-accounts tbody tr td.provider').contains('twitter');
          cy.get('#linked-accounts tbody tr td.user-id').contains('abc-123');
          cy.get('#linked-accounts tbody tr td.action').contains('Unlink');
          cy.get('#linked-accounts tbody tr td.action button.unlink-accounts').first().should('not.be.disabled');
        });
      });

      describe('linkable accounts exist', () => {

        let linkableAcct;
        beforeEach(() => {
          cy.login('someotherguy@pretendthisisthesameemail.com', { ..._profile, email: 'someotherguy@pretendthisisthesameemail.com', name: 'Some Other Guy' });

          cy.login(_profile.email, {..._profile}, rolePermissions.sudo);
          cy.visit(`/#/agent/${regularAgent.socialProfile.user_id}`);
          cy.wait(300);

          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someotherguy@pretendthisisthesameemail.com' LIMIT 1;`).then(([results, metadata]) => {
            linkableAcct = results[0];
          });

          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
            rootAgent = results[0];
          });
        });

        it('displays a progress spinner', () => {
          cy.get('#load-linkable-spinner').should('not.exist');
          cy.get('#find-linkable-accounts').should('not.be.disabled');
          cy.get('#find-linkable-accounts').click();
          cy.wait(300);
          // Cypress goes too fast for the spinner. This ensures it disappears when done
          //cy.get('#load-linkable-spinner').should('exist');
          cy.get('#load-linkable-spinner').should('not.exist');
          cy.get('#find-linkable-accounts').should('not.be.disabled');
        });

        it('displays linkable account info in a linkable-accounts table', () => {
          cy.get('#linkable-accounts').should('not.exist');
          cy.get('#find-linkable-accounts').click();
          cy.wait(300);
          cy.get('#linkable-accounts').should('exist');
          cy.get('#linkable-accounts tbody').find('tr').should('have.length', 1);

          cy.get('#linkable-accounts tbody tr td.connection').contains(linkableAcct.socialProfile.identities[0].connection);
          cy.get('#linkable-accounts tbody tr td.is-social').contains(`${linkableAcct.socialProfile.identities[0].isSocial}`);
          cy.get('#linkable-accounts tbody tr td.provider').contains(linkableAcct.socialProfile.identities[0].provider);
          cy.get('#linkable-accounts tbody tr td.user-id').contains(linkableAcct.socialProfile.identities[0].user_id);
          cy.get('#linkable-accounts tbody tr td.action').contains('Link');
          cy.get('#linkable-accounts tbody tr td.action button.link-accounts').first().should('not.be.disabled');
        });

        describe('linking', () => {
          beforeEach(() => {
            cy.get('#find-linkable-accounts').click();
          })

          it('displays a progress spinner', () => {
            cy.get('.link-account-spinner').should('not.exist');
            cy.get('.link-accounts').first().click();
            cy.wait(300);
            // Cypress goes too fast for the spinner. This ensures it disappears when done
            //cy.get('.link-account-spinner').should('exist');
            cy.get('.link-account-spinner').should('not.exist');
          });

          it('displays a friendly message', () => {
            cy.get('#flash-message').should('not.exist');
            cy.get('.link-accounts').first().click();
            cy.wait(300);
            cy.get('#flash-message').contains('Accounts linked');
          });

          it('removes the account from the linkable-accounts table', () => {
            cy.get('#linkable-accounts tbody').find('tr').should('have.length', 1);
            cy.get('.link-accounts').first().click();
            cy.wait(300);
            cy.get('#linkable-accounts').should('not.exist');
          });

          it('adds the account to the linked-accounts table with an "Unlink" button', () => {
            cy.get('#linked-accounts').should('not.exist');
            cy.get('#linkable-accounts tbody tr td.action').contains('Link');
            cy.get('.link-accounts').first().click();
            cy.wait(300);
            cy.get('#linked-accounts tbody tr td.action').contains('Unlink');
            cy.get('#linked-accounts tbody').find('tr').should('have.length', 1);

            cy.get('#linked-accounts tbody tr td.connection').contains(linkableAcct.socialProfile.identities[0].connection);
            cy.get('#linked-accounts tbody tr td.is-social').contains(`${linkableAcct.socialProfile.identities[0].isSocial}`);
            cy.get('#linked-accounts tbody tr td.provider').contains(linkableAcct.socialProfile.identities[0].provider);
            cy.get('#linked-accounts tbody tr td.user-id').contains(linkableAcct.socialProfile.identities[0].user_id);
            cy.get('#linked-accounts tbody tr td.action').contains('Unlink');
          });

          describe('unlinking', () => {
            beforeEach(() => {
              cy.get('.link-accounts').first().click();
              cy.get('#flash-message #close-flash').click();
            })

            it('displays a progress spinner', () => {
              cy.get('.link-account-spinner').should('not.exist');
              cy.get('.unlink-accounts').first().click();
              cy.wait(300);
              // Cypress goes too fast for the spinner. This ensures it disappears when done
              //cy.get('.link-account-spinner').should('exist');
              cy.get('.link-account-spinner').should('not.exist');
            });

            it('displays a friendly message', () => {
              cy.get('#flash-message').should('not.exist');
              cy.get('.unlink-accounts').first().click();
              cy.wait(300);
              cy.get('#flash-message').contains('Accounts unlinked');
            });

            it('removes the account from the linked-accounts table', () => {
              cy.get('#linked-accounts tbody').find('tr').should('have.length', 1);
              cy.get('.unlink-accounts').first().click();
              cy.wait(300);
              cy.get('#linked-accounts tbody').should('not.exist');
            });

            it('adds the account to the linkable-accounts table with a "Link" button', () => {
              cy.get('#linkable-accounts').should('not.exist');
              cy.get('#linked-accounts tbody tr td.action').contains('Unlink');
              cy.get('.unlink-accounts').first().click();
              cy.wait(300);
              cy.get('#linkable-accounts tbody tr td.action').contains('Link');
              cy.get('#linkable-accounts tbody').find('tr').should('have.length', 1);

              cy.get('#linkable-accounts tbody tr td.connection').contains(linkableAcct.socialProfile.identities[0].connection);
              cy.get('#linkable-accounts tbody tr td.is-social').contains(`${linkableAcct.socialProfile.identities[0].isSocial}`);
              cy.get('#linkable-accounts tbody tr td.provider').contains(linkableAcct.socialProfile.identities[0].provider);
              cy.get('#linkable-accounts tbody tr td.user-id').contains(linkableAcct.socialProfile.identities[0].user_id);
              cy.get('#linkable-accounts tbody tr td.action').contains('Link');
            });
          });
        });
      });
    });
  });
});

export {}
