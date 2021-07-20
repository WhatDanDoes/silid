context('viewer/Agent linking', function() {

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

  let agent;

  describe('#find-linkable-accounts button', () => {

    describe('no linkable accounts exist', () => {

      beforeEach(() => {
        cy.login(_profile.email, _profile);
        cy.get('#flash-message #close-flash').click();
        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
          agent = results[0];
        });
      });

      it('displays a progress spinner', () => {
        cy.get('#load-linkable-spinner').should('not.exist');
        cy.get('#find-linkable-accounts').click();
        cy.wait(300);
        // Cypress goes too fast for the spinner. This ensures it disappears when done
        //cy.get('#load-linkable-spinner').should('exist');
        cy.get('#load-linkable-spinner').should('not.exist');
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
          agent = results[0];
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
        cy.login('pretendthisisthesameemail@example.com', { ..._profile });
        cy.wait(300);
        cy.login(_profile.email, {..._profile });
//        cy.login(_profile.email, {..._profile, identities: [{
//          connection: 'twitter',
//          user_id: 'abc-123',
//          provider: 'twitter',
//        }] });
        cy.get('#flash-message #close-flash').click();

        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='pretendthisisthesameemail@example.com' LIMIT 1;`).then(([results, metadata]) => {
          linkableAcct = results[0];
        });

        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
          agent = results[0];
        });
      });

      it('displays a progress spinner', () => {
        cy.get('#load-linkable-spinner').should('not.exist');
        cy.get('#find-linkable-accounts').click();
        cy.wait(300);
        // Cypress goes too fast for the spinner. This ensures it disappears when done
        //cy.get('#load-linkable-spinner').should('exist');
        cy.get('#load-linkable-spinner').should('not.exist');
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
            //cy.get('#linkable-accounts tbody').find('tr').should('have.length', 0);
            cy.get('#linkable-accounts').should('not.exist');
            cy.get('#linked-accounts tbody tr td.action').contains('Unlink');
            cy.get('.unlink-accounts').first().click();
            cy.wait(300);
            cy.get('#linkable-accounts tbody tr td.action').contains('Link');
            cy.get('#linkable-accounts tbody').find('tr').should('have.length', 1);
          });
        });
      });
    });
  });
});

export {}
