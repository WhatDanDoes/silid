context('viewer/Agent edit', function() {

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

  describe('authenticated', () => {
    let memberAgent;

    describe('viewing member agent\'s profile', () => {
      beforeEach(() => {
        // A convenient way to create a new agent
        cy.login('someotherguy@example.com', _profile);
        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someotherguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
          memberAgent = results[0];

          cy.login('someguy@example.com', _profile);
          cy.visit(`/#/agent/${memberAgent.socialProfile.user_id}`);
          cy.wait(300);
        });
      });

      it('does not allow editing agent\'s info', () => {
        cy.get('h3').contains('Profile');
        cy.get('#profile-table table tbody tr th').contains('Name:');
        cy.get('#profile-table table tbody tr td input#agent-name-field').should('have.value', memberAgent.socialProfile.name);
        cy.get('#profile-table table tbody tr td input#agent-name-field').should('be.disabled');

        // Not really relevant for root-level agent profile edits, but included here anyway
        cy.get('#profile-table table tbody tr th').contains('SIL Locale:');
        cy.get('#profile-table table tbody tr td #sil-local-dropdown').should('be.disabled');
      });
    });

    describe('viewing your own profile', () => {

      let agent;

      describe('email verified', () => {

        beforeEach(() => {
          cy.login('someguy@example.com', _profile);
          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
            agent = results[0];
            cy.visit(`/#/agent/${agent.socialProfile.user_id}`);
            cy.wait(500);
          });
        });

        it('displays agent\'s info', () => {
          cy.get('h3').contains('Profile');
          cy.get('#profile-table table tbody tr th').contains('Name:');
          cy.get('#profile-table table tbody tr td input#agent-name-field').should('have.value', agent.socialProfile.name);
          cy.get('#profile-table table tbody tr td input#agent-name-field').should('not.be.disabled');

          // Not really relevant for root-level agent profile edits, but included here anyway
          cy.get('#profile-table table tbody tr th').contains('SIL Locale:');
          cy.get('#profile-table table tbody tr td #sil-local-dropdown').should('not.be.disabled');
        });

        describe('#agent-name-field', () => {
          it('reveals Save and Cancel buttons on change', () => {
            cy.get('button#save-agent').should('not.exist');
            cy.get('button#cancel-agent-changes').should('not.exist');

            cy.get('#agent-name-field').type('!!!');
            cy.get('#agent-name-field').should('have.value', 'Some Guy!!!');

            cy.get('button#save-agent').should('exist');
            cy.get('button#cancel-agent-changes').should('exist');
          });

          describe('#cancel-agent-changes button', () => {
            beforeEach(() => {
              cy.get('#agent-name-field').clear();
              cy.get('#agent-name-field').type('Some Groovy Cat');
            });

            it('resets the changes to the editable fields', () => {
              cy.get('#agent-name-field').should('have.value', 'Some Groovy Cat');
              cy.get('button#cancel-agent-changes').click();
              cy.get('#agent-name-field').should('have.value', 'Some Guy');
            });

            it('hides the Cancel and Save buttons', () => {
              cy.get('button#save-agent').should('exist');
              cy.get('button#cancel-agent-changes').should('exist');

              cy.get('button#cancel-agent-changes').click();

              cy.get('button#save-agent').should('not.exist');
              cy.get('button#cancel-agent-changes').should('not.exist');
            });

            it('does not change the agent\'s record', () => {
              cy.task('query', `SELECT * FROM "Agents";`).then(([results, metadata]) => {
                expect(results.length).to.eq(1);
                expect(results[0].socialProfile.name).to.eq('Some Guy');
                cy.get('button#cancel-agent-changes').click();
                cy.task('query', `SELECT * FROM "Agents";`).then(([results, metadata]) => {
                  expect(results[0].socialProfile.name).to.eq('Some Guy');
                });
              });
            });
          });

          describe('#save-agent button', () => {

            describe('is unsuccessful in making changes', () => {

              describe('with invalid field', () => {
                it('empty name field', () => {
                  cy.get('#agent-name-field').clear();
                  cy.get('#agent-name-field').should('have.value', '');
                  cy.get('button#save-agent').click();
                  cy.wait(300);
                  cy.get('#flash-message').contains('Missing profile data');
                });

                it('blank name field', () => {
                  cy.get('#agent-name-field').clear();
                  cy.get('#agent-name-field').type('     ');
                  cy.get('#agent-name-field').should('have.value', '     ');
                  cy.get('button#save-agent').click();
                  cy.wait(300);
                  cy.get('#flash-message').contains('Missing profile data');
                });

                it('does not change the agent\'s record', () => {
                  cy.task('query', `SELECT * FROM "Agents";`).then(([results, metadata]) => {
                    expect(results.length).to.eq(1);
                    expect(results[0].socialProfile.name).to.eq('Some Guy');

                    cy.get('#agent-name-field').clear();
                    cy.get('button#save-agent').click();

                    cy.task('query', `SELECT * FROM "Agents";`).then(([results, metadata]) => {
                      expect(results[0].socialProfile.name).to.eq('Some Guy');
                    });
                  });
                });
              });
            });

            describe('successfully makes changes', () => {
              beforeEach(() => {
                cy.get('#agent-name-field').clear();
                cy.get('#agent-name-field').type('Some Groovy Cat');
              });

              it('lands in the proper place', () => {
                cy.get('button#save-agent').click();
                cy.wait(300);
                cy.url().should('contain', `/#/agent/${agent.socialProfile.user_id}`);
              });

              it('persists the changes to the editable fields', () => {
                cy.get('#agent-name-field').should('have.value', 'Some Groovy Cat');
                cy.get('button#save-agent').click();
                cy.wait(300);
                cy.get('#agent-name-field').should('have.value', 'Some Groovy Cat');
              });

              it('hides the Cancel and Save buttons', () => {
                cy.get('button#save-agent').should('exist');
                cy.get('button#cancel-agent-changes').should('exist');

                cy.get('button#save-agent').click();

                cy.get('button#save-agent').should('not.exist');
                cy.get('button#cancel-agent-changes').should('not.exist');
              });

              it('changes the agent\'s record', () => {
                cy.task('query', `SELECT * FROM "Agents";`).then(([results, metadata]) => {
                  expect(results.length).to.eq(1);
                  expect(results[0].socialProfile.name).to.eq('Some Guy');
                  cy.get('button#save-agent').click();
                  cy.task('query', `SELECT * FROM "Agents";`).then(([results, metadata]) => {
                    expect(results[0].socialProfile.name).to.eq('Some Groovy Cat');
                  });
                });
              });

              it('displays a friendly message', () => {
                cy.get('#agent-name-field').should('have.value', 'Some Groovy Cat');
                cy.get('button#save-agent').click();
                cy.wait(300);
                cy.get('#flash-message').contains('Agent updated');
              });

              it('persists updated root data between browser refreshes', () => {
                cy.get('#agent-name-field').should('have.value', 'Some Groovy Cat');
                cy.get('button#save-agent').click();
                cy.wait(300);
                cy.get('#agent-name-field').should('have.value', 'Some Groovy Cat');
                cy.reload();
                cy.wait(300);
                cy.get('#agent-name-field').should('have.value', 'Some Groovy Cat');
              });
            });
          });
        });
      });

      describe('email not verified', () => {
        beforeEach(() => {
          cy.login('someguy@example.com', {..._profile, email_verified: false });
          cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
            agent = results[0];
            cy.visit(`/#/agent/${agent.socialProfile.user_id}`);
            cy.wait(500);
          });
        });

        it('displays agent\'s info', () => {
          cy.get('h3').contains('Profile');
          cy.get('#profile-table table tbody tr th').contains('Name:');
          cy.get('#profile-table table tbody tr td input#agent-name-field').should('have.value', agent.socialProfile.name);
          cy.get('#profile-table table tbody tr td input#agent-name-field').should('be.disabled');

          // Not really relevant for root-level agent profile edits, but included here anyway
          cy.get('#profile-table table tbody tr th').contains('SIL Locale:');
          cy.get('#profile-table table tbody tr td #sil-local-dropdown').should('not.be.disabled');
        });
      });
    });
  });
});

export {}
