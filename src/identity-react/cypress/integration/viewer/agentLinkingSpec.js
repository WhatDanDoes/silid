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
        cy.login('someguy@pretendthisisthesameemail.com', { ..._profile });
        cy.wait(300);
        cy.login(_profile.email, {..._profile });
        cy.get('#flash-message #close-flash').click();

        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someguy@pretendthisisthesameemail.com' LIMIT 1;`).then(([results, metadata]) => {
          linkableAcct = results[0];
        });

        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
          agent = results[0];
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

    /**
     * These tests arose because the Paratext provider comes in this form:
     *
     *`oauth2|paratext-audiomanager|WfCxeyQQiZQfPbNAP`
     *
     * This means the determining the provider and user_id is not a simple
     * matter of calling `split('|')` on the string.
     */
    describe('custom OAuth provider', () => {

      describe('account is custom Oauth and is linked to another custom OAuth provider', () => {

        beforeEach(() => {
          cy.login(_profile.email, {
            ..._profile,
            sub: "oauth2|paratext-audiomanager|abc-123",
            identities: [
              {
                connection: 'paratext-audiomanager',
                user_id: 'paratext-audiomanager|abc-123',
                provider: 'oauth2',
                isSocial: true,
              },
              {
                connection: 'paratext-scriptureforge',
                user_id: 'paratext-scriptureforge|xyz-890',
                provider: 'oauth2',
                isSocial: true,
              },
            ]
          });
          cy.get('#flash-message #close-flash').click();
          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
            agent = results[0];
          });
        });

        it('displays linked account info in the linkable-accounts table', () => {
          cy.get('#linked-accounts').should('exist');
          cy.get('#linked-accounts tbody').find('tr').should('have.length', 1);

          cy.get('#linked-accounts tbody tr td.connection').contains('paratext-scriptureforge');
          cy.get('#linked-accounts tbody tr td.is-social').contains('true');
          cy.get('#linked-accounts tbody tr td.provider').contains('oauth2');
          cy.get('#linked-accounts tbody tr td.user-id').contains('paratext-scriptureforge|xyz-890');
          cy.get('#linked-accounts tbody tr td.action').contains('Unlink');
        });
      });

      describe('account is already linked to another custom OAuth provider', () => {

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
                connection: 'paratext-audiomanager',
                user_id: 'paratext-audiomanager|abc-123',
                provider: 'oauth2',
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

          cy.get('#linked-accounts tbody tr td.connection').contains('paratext-audiomanager');
          cy.get('#linked-accounts tbody tr td.is-social').contains('true');
          cy.get('#linked-accounts tbody tr td.provider').contains('oauth2');
          cy.get('#linked-accounts tbody tr td.user-id').contains('paratext-audiomanager|abc-123');
          cy.get('#linked-accounts tbody tr td.action').contains('Unlink');
        });
      });

      describe('linkable custom Oauth account exists', () => {

        let linkableAcct, anotherLinkableAcct;
        beforeEach(() => {
          // First linkable account
          cy.login('someguy@pretendthisisthesameemail.com', {
            ..._profile,
            sub: "oauth2|paratext-audiomanager|abc-123",
          });
          cy.wait(300);

          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someguy@pretendthisisthesameemail.com' LIMIT 1;`).then(([results, metadata]) => {
            linkableAcct = results[0];
          });

          // Second linkable account
          cy.login('someguy@pretendthisisalsothesameemail.com', {
            ..._profile,
            sub: "oauth2|paratext-scriptureforge|xyz-890",
          });
          cy.wait(300);

          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someguy@pretendthisisalsothesameemail.com' LIMIT 1;`).then(([results, metadata]) => {
            anotherLinkableAcct = results[0];
          });

          cy.login(_profile.email, {
            ..._profile,
            sub: "oauth2|paratext-paratext|lmn-567",
          });
          cy.get('#flash-message #close-flash').click();
          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
            agent = results[0];
          });
        });

        it('displays custom provider data (like Paratext)', () => {
          cy.get('#find-linkable-accounts').click();
          cy.wait(300);

          cy.get('#linkable-accounts tbody').find('tr').should('have.length', 2);

          cy.get('#linkable-accounts tbody tr td.connection').contains(linkableAcct.socialProfile.identities[0].connection);
          cy.get('#linkable-accounts tbody tr td.is-social').contains(`${linkableAcct.socialProfile.identities[0].isSocial}`);
          cy.get('#linkable-accounts tbody tr td.provider').contains(linkableAcct.socialProfile.identities[0].provider);
          cy.get('#linkable-accounts tbody tr td.user-id').contains(linkableAcct.socialProfile.identities[0].user_id);
          cy.get('#linkable-accounts tbody tr td.action').contains('Link');

          cy.get('#linkable-accounts tbody tr td.connection').contains(anotherLinkableAcct.socialProfile.identities[0].connection);
          cy.get('#linkable-accounts tbody tr td.is-social').contains(`${anotherLinkableAcct.socialProfile.identities[0].isSocial}`);
          cy.get('#linkable-accounts tbody tr td.provider').contains(anotherLinkableAcct.socialProfile.identities[0].provider);
          cy.get('#linkable-accounts tbody tr td.user-id').contains(anotherLinkableAcct.socialProfile.identities[0].user_id);
          cy.get('#linkable-accounts tbody tr td.action').contains('Link');
        });

        describe('linking', () => {
          beforeEach(() => {
            cy.get('#find-linkable-accounts').click();
          })

          it('removes the account from the linkable-accounts table', () => {
            cy.get('#linkable-accounts tbody').find('tr').should('have.length', 2);
            cy.get('.link-accounts').first().click();
            cy.wait(300);
            cy.get('#linkable-accounts tbody').find('tr').should('have.length', 1);

            cy.get('#linkable-accounts tbody tr td.connection').contains(anotherLinkableAcct.socialProfile.identities[0].connection);
            cy.get('#linkable-accounts tbody tr td.is-social').contains(`${anotherLinkableAcct.socialProfile.identities[0].isSocial}`);
            cy.get('#linkable-accounts tbody tr td.provider').contains(anotherLinkableAcct.socialProfile.identities[0].provider);
            cy.get('#linkable-accounts tbody tr td.user-id').contains(anotherLinkableAcct.socialProfile.identities[0].user_id);
            cy.get('#linkable-accounts tbody tr td.action').contains('Link');
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
        });
      });
    });
  });
});

export {}
