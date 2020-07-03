context('organizer/Organization creation', function() {

  before(function() {
    cy.fixture('google-profile-response').as('profile');
    cy.fixture('permissions').as('scope');
  });

  let _profile;
  let organization, agent;
  beforeEach(function() {
    _profile = {...this.profile};

    cy.login(_profile.email, _profile);

    cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
      agent = results[0];

      // The '123' role ID matches that defined in the RBAC mock server
      cy.request('POST', `https://localhost:3002/api/v2/users/${agent.socialProfile.user_id}/roles`, { roles: ['123'] });
    });
  });

  context('authenticated', () => {
    beforeEach(function() {
      cy.login(_profile.email, _profile, [this.scope.create.organizations]);

      cy.get('#flash-message #close-flash').click();
    });

    afterEach(() => {
      cy.task('query', 'TRUNCATE TABLE "Agents" CASCADE;');
    });

    it('lands in the right spot', () => {
      cy.url().should('contain', `/#/agent`);
    });

    describe('interface', () => {
      it('displays Organization interface elements', () => {
        cy.get('#organizations-table button span span').contains('add_box');
      });

      describe('add-organization button', () => {
        it('reveals the input form', () => {
          cy.get('#organizations-table table tbody tr td div button[title="Save"]').should('not.exist');
          cy.get('#organizations-table table tbody tr td div button[title="Cancel"]').should('not.exist');
          cy.get('#organizations-table table tbody tr td div div input[placeholder="Name"]').should('not.exist');
          cy.get('#organizations-table table tbody tr td div div input[placeholder="Leader"]').should('not.exist');
          cy.get('#organizations-table button span span').contains('add_box').click();
          cy.get('#organizations-table table tbody tr td div button[title="Save"]').should('exist');
          cy.get('#organizations-table table tbody tr td div button[title="Cancel"]').should('exist');
          cy.get('#organizations-table table tbody tr td div div input[placeholder="Name"]').should('exist');
          cy.get('#organizations-table table tbody tr td div div input[placeholder="Leader"]').should('not.exist');
        });

        it('gives focus to the organization name input field', () => {
          cy.get('#organizations-table button span span').contains('add_box').click();
          cy.focused().should('have.attr', 'placeholder').and('eq', 'Name');
        });

        describe('add-organization-form', () => {
          beforeEach(() => {
            cy.get('#organizations-table button span span').contains('add_box').click();
          });

          it('renders the input form correctly', () => {
            cy.get('#organizations-table table tbody tr td div button[title="Save"]').should('exist');
            cy.get('#organizations-table table tbody tr td div button[title="Cancel"]').should('exist');
            cy.get('#organizations-table table tbody tr td div div input[placeholder="Name"]').should('exist');
            cy.get('#organizations-table table tbody tr td div div input[placeholder="Leader"]').should('not.exist');
          });

          describe('cancel-changes button', () => {
            it('hides the add-organization-form', function() {
              cy.get('#organizations-table table tbody tr td div button[title="Save"]').should('exist');
              cy.get('#organizations-table table tbody tr td div button[title="Cancel"]').should('exist');
              cy.get('#organizations-table table tbody tr td div div input[placeholder="Name"]').should('exist');
              cy.get('#organizations-table table tbody tr td div div input[placeholder="Leader"]').should('not.exist');

              cy.get('#organizations-table table tbody tr td div button[title="Cancel"]').click();

              cy.get('#organizations-table table tbody tr td div button[title="Save"]').should('not.exist');
              cy.get('#organizations-table table tbody tr td div button[title="Cancel"]').should('not.exist');
              cy.get('#organizations-table table tbody tr td div div input[placeholder="Name"]').should('not.exist');
              cy.get('#organizations-table table tbody tr td div div input[placeholder="Leader"]').should('not.exist');

            });

            it('clears the name input field', function() {
              cy.get('#organizations-table table tbody tr td div div input[placeholder="Name"]').type('The Justice League');
              cy.get('#organizations-table table tbody tr td div button[title="Cancel"]').click();
              cy.get('button span span').contains('add_box').click();
              cy.get('#organizations-table table tbody tr td div div input[placeholder="Name"]').should('be.empty');
            });
          });

          describe('add-organization-button', () => {
            context('invalid form', () => {
              describe('name field', () => {
                it('does not allow a blank field', function() {
                  cy.get('#organizations-table table tbody tr td div div input[placeholder="Name"]').clear();
                  cy.get('#organizations-table table tbody tr td div div input[placeholder="Name"]').type('            ');
                  cy.get('#organizations-table table tbody tr td div div input[placeholder="Name"]').should('have.value', '            ');
                  cy.get('#organizations-table table tbody tr td div button[title="Save"]').click();
                  cy.contains('Organization name can\'t be blank');
                });

                it('does not allow an empty field', function() {
                  cy.get('#organizations-table table tbody tr td div div input[placeholder="Name"]').type('Some new organization');
                  cy.get('#organizations-table table tbody tr td div div input[placeholder="Name"]').clear();
                  cy.get('#organizations-table table tbody tr td div div input[placeholder="Name"]').should('have.value', '');
                  cy.get('#organizations-table table tbody tr td div button[title="Save"]').click();
                  cy.contains('Organization name can\'t be blank');
                });

                it('does not allow a duplicate organization no matter how many times you try', function() {
                  cy.get('#organizations-table table tbody tr td div div input[placeholder="Name"]').type('Copycat Organization');
                  cy.get('#organizations-table table tbody tr td div button[title="Save"]').click();
                  cy.wait(300);
                  cy.get('#organizations-table table tbody tr td').contains('Copycat Organization');

                  cy.get('#organizations-table button span span').contains('add_box').click();
                  cy.get('#organizations-table table tbody tr td div div input[placeholder="Name"]').type('Copycat Organization');
                  cy.get('#organizations-table table tbody tr td div button[title="Save"]').click();
                  cy.wait(300);
                  cy.get('#flash-message').contains('That organization is already registered');

                  // Try a second time to ensure the flash message resets
                  cy.get('#flash-message #close-flash').click();
                  cy.get('#organizations-table button span span').contains('add_box').click();
                  cy.get('#organizations-table table tbody tr td div div input[placeholder="Name"]').type('Copycat Organization');
                  cy.get('#organizations-table table tbody tr td div button[title="Save"]').click();
                  cy.wait(300);
                  cy.contains('That organization is already registered');
                });
              });
            });

            context('valid form', () => {
              it('updates the record on the interface', function() {
                cy.get('#organizations-table table tbody tr td div div input[placeholder="Name"]').type('The Mike Tyson Mystery Team');
                cy.get('#organizations-table table tbody tr td div button[title="Save"]').click();
                cy.wait(300);
                cy.get('#organizations-table table tbody tr td').contains('The Mike Tyson Mystery Team');
                cy.get('#organizations-table table tbody tr td').contains(_profile.email);
              });

              it('persists new organization data between browser refreshes', function() {
                cy.get('#organizations-table table tbody tr td div div input[placeholder="Name"]').type('The Mike Tyson Mystery Team');
                cy.get('#organizations-table table tbody tr td div button[title="Save"]').click();
                cy.wait(300);
                cy.get('#organizations-table table tbody tr td').contains('The Mike Tyson Mystery Team');
                cy.get('#organizations-table table tbody tr td').contains(_profile.email);

                cy.reload();
                cy.wait(300);

                cy.get('#organizations-table table tbody tr td').contains('The Mike Tyson Mystery Team');
                cy.get('#organizations-table table tbody tr td').contains(_profile.email);
              });

              it('allows adding multiple organizations', function() {
                // 2, because the `add_box` has been clicked and it is a table row.
                // Also, the 'No records to display' message is in a table row
                cy.get('#organizations-table table tbody:nth-child(2)').find('tr').its('length').should('eq', 2);

                cy.get('#organizations-table table tbody tr td div div input[placeholder="Name"]').type('The Mike Tyson Mystery Team');
                cy.get('#organizations-table table tbody tr td div button[title="Save"]').click();
                cy.wait(300);
                cy.get('#organizations-table table tbody tr td').contains('The Mike Tyson Mystery Team');
                cy.get('#organizations-table table tbody tr td').contains(_profile.email);

                // 1, because the message is replaced by a organization and the add-organization-form is hidden
                cy.get('#organizations-table table tbody:nth-child(2)').find('tr').its('length').should('eq', 1);

                cy.get('#organizations-table button span span').contains('add_box').click();
                cy.get('#organizations-table table tbody tr td div div input[placeholder="Name"]').type('Mystery Incorporated');
                cy.get('#organizations-table table tbody tr td div button[title="Save"]').click();
                cy.wait(300);
                cy.get('#organizations-table table tbody tr td').contains('Mystery Incorporated');
                cy.get('#organizations-table table tbody tr td').contains(_profile.email);

                cy.get('#organizations-table table tbody:nth-child(2)').find('tr').its('length').should('eq', 2);
              });

              it('allows adding multiple organizations whilst navigating', function() {
                // 2, because the `add_box` has been clicked and it is a table row.
                // Also, the 'No records to display' message is in a table row
                cy.get('#organizations-table table tbody:nth-child(2)').find('tr').its('length').should('eq', 2);

                cy.get('#organizations-table table tbody tr td div div input[placeholder="Name"]').type('The Mike Tyson Mystery Team');
                cy.get('#organizations-table table tbody tr td div button[title="Save"]').click();
                cy.wait(300);
                cy.get('#organizations-table table tbody tr td').contains('The Mike Tyson Mystery Team');
                cy.get('#organizations-table table tbody tr td').contains(_profile.email);

                // 1, because the message is replaced by a organization and the add-organization-form is hidden
                cy.get('#organizations-table table tbody:nth-child(2)').find('tr').its('length').should('eq', 1);

                // Navigate to the newly created organization
                cy.contains('The Mike Tyson Mystery Team').click();
                cy.wait(300);
                cy.go('back');
                cy.wait(300);

                cy.get('#organizations-table button span span').contains('add_box').click();
                cy.get('#organizations-table table tbody tr td div div input[placeholder="Name"]').type('Mystery Incorporated');
                cy.get('#organizations-table table tbody tr td div button[title="Save"]').click();
                cy.wait(300);
                cy.get('#organizations-table table tbody tr td').contains('Mystery Incorporated');
                cy.get('#organizations-table table tbody tr td').contains(_profile.email);

                cy.get('#organizations-table table tbody:nth-child(2)').find('tr').its('length').should('eq', 2);
              });

              it('displays progress spinner', () => {
                cy.on('window:confirm', (str) => {
                  return true;
                });
                cy.get('div[role="progressbar"] svg circle').should('not.exist');

                cy.get('#organizations-table table tbody tr td div div input[placeholder="Name"]').type('The Mike Tyson Mystery Team');
                cy.get('#organizations-table table tbody tr td div button[title="Save"]').click();

                // 2020-5-26
                // Cypress goes too fast for this. Cypress also cannot intercept
                // native `fetch` calls to allow stubbing and delaying the route.
                // Shamefully, this is currently manually tested, though I suspect
                // I will use this opportunity to learn Jest
                // Despite its name, this test really ensures the spinner disappears
                // after all is said and done
                //cy.get('div[role="progressbar"] svg circle').should('exist');
                cy.wait(100);
                cy.get('div[role="progressbar"] svg circle').should('not.exist');
              });

              describe('executes organization creation with Enter key', () => {
                it('updates the record on the interface', function() {
                  cy.get('#organizations-table table tbody tr td div div input[placeholder="Name"]').type('The Mike Tyson Mystery Team{enter}');
                  cy.wait(300);
                  cy.get('#organizations-table table tbody tr td').contains('The Mike Tyson Mystery Team');
                  cy.get('#organizations-table table tbody tr td').contains(_profile.email);
                });

                it('clears input field', () => {
                  cy.get('#organizations-table table tbody tr td div div input[placeholder="Name"]').type('Mystery Incorporated{enter}');
                  cy.wait(300);
                  cy.get('#organizations-table table tbody tr td div div input[placeholder="Name"]').should('have.value', '');
                });
              });
            });
          });
        });
      });
    });
  });
});

export {}
