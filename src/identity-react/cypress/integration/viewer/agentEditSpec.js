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

        cy.get('#profile-table table tbody tr th').contains('Phone:');
        cy.get('#profile-table table tbody tr td input#phone-number-field').should('have.attr', 'placeholder', 'Set your phone number');
        cy.get('#profile-table table tbody tr td input#phone-number-field').should('be.disabled');

        cy.get('#profile-table table tbody tr th').contains('Timezone:');
        cy.get('#profile-table table tbody tr td label[for="timezone-dropdown"]').contains('Set your timezone');
        cy.get('#profile-table table tbody tr td #timezone-dropdown').should('be.disabled');

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

          cy.get('#profile-table table tbody tr th').contains('Phone:');
          cy.get('#profile-table table tbody tr td input#phone-number-field').should('have.attr', 'placeholder', 'Set your phone number');
          cy.get('#profile-table table tbody tr td input#phone-number-field').should('not.be.disabled');

          cy.get('#profile-table table tbody tr th').contains('Timezone:');
          cy.get('#profile-table table tbody tr td label[for="timezone-dropdown"]').contains('Set your timezone');
          cy.get('#profile-table table tbody tr td #timezone-dropdown').should('not.be.disabled');

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

              it('displays progress spinner', () => {
                cy.get('div[role="progressbar"] svg circle').should('not.exist');

                cy.get('button#save-agent').click();
                // 2020-5-26
                // Cypress goes too fast for this. Cypress also cannot intercept
                // native `fetch` calls to allow stubbing and delaying the route.
                // Shamefully, this is currently manually tested, though I suspect
                // I will use this opportunity to learn Jest
                // Despite its name, this test really ensures the spinner disappears
                // after all is said and done
                //cy.get('button#save-agent').should('be.disabled');
                //cy.get('button#cancel-agent-changes').should('be.disabled');
                //cy.get('div[role="progressbar"] svg circle').should('exist');
                cy.wait(100);
                cy.get('div[role="progressbar"] svg circle').should('not.exist');
                cy.get('button#save-agent').should('not.exist');
                cy.get('button#cancel-agent-changes').should('not.exist');
              });
            });
          });
        });

        describe('#phone-number-field', () => {
          it('reveals Save and Cancel buttons on change', () => {
            cy.get('button#save-agent').should('not.exist');
            cy.get('button#cancel-agent-changes').should('not.exist');

            cy.get('#phone-number-field').type('4032661234');
            cy.get('#phone-number-field').should('have.value', '+1 (403) 266-1234');

            cy.get('button#save-agent').should('exist');
            cy.get('button#cancel-agent-changes').should('exist');
          });

          describe('#cancel-agent-changes button', () => {
            beforeEach(() => {
              cy.get('#phone-number-field').clear();
              cy.get('#phone-number-field').type('14032661234');
            });

            it('resets the changes to the editable fields', () => {
              cy.get('#phone-number-field').should('have.value', '+1 (403) 266-1234');
              cy.get('button#cancel-agent-changes').click();
              cy.get('#phone-number-field').should('have.value', '+');
              //cy.get('#profile-table table tbody tr td input#phone-number-field').should('have.attr', 'placeholder', 'Set your phone number');
            });

            it('does not change the agent\'s record', () => {
              cy.task('query', `SELECT * FROM "Agents";`).then(([results, metadata]) => {
                expect(results.length).to.eq(1);
                expect(results[0].socialProfile.phone_number).to.be.undefined;
                cy.get('button#cancel-agent-changes').click();
                cy.task('query', `SELECT * FROM "Agents";`).then(([results, metadata]) => {
                  expect(results[0].socialProfile.phone_number).to.be.undefined;
                });
              });
            });
          });

          describe('#save-agent button', () => {

            describe('is unsuccessful in making changes', () => {

              describe('with invalid field', () => {
                it('empty phone_number field', () => {
                  cy.get('#phone-number-field').clear();
                  cy.get('#phone-number-field').should('have.value', '+');
                  cy.get('button#save-agent').click();
                  cy.wait(300);
                  cy.get('#flash-message').contains('Missing profile data');
                });

                it('blank name field', () => {
                  cy.get('#phone-number-field').clear();
                  cy.get('#phone-number-field').type('     ');
                  cy.get('#phone-number-field').should('have.value', '+');
                  cy.get('button#save-agent').click();
                  cy.wait(300);
                  cy.get('#flash-message').contains('Missing profile data');
                });

                it('does not change the agent\'s record', () => {
                  cy.task('query', `SELECT * FROM "Agents";`).then(([results, metadata]) => {
                    expect(results.length).to.eq(1);
                    expect(results[0].socialProfile.phone_number).to.be.undefined;

                    cy.get('#agent-name-field').clear();
                    cy.get('button#save-agent').click();

                    cy.task('query', `SELECT * FROM "Agents";`).then(([results, metadata]) => {
                      expect(results[0].socialProfile.phone_number).to.be.undefined;
                    });
                  });
                });
              });
            });

            describe('successfully makes changes', () => {
              beforeEach(() => {
                cy.get('#phone-number-field').clear();
                cy.get('#phone-number-field').type('14032661234');
              });

              it('lands in the proper place', () => {
                cy.get('button#save-agent').click();
                cy.wait(300);
                cy.url().should('contain', `/#/agent/${agent.socialProfile.user_id}`);
              });

              it('persists the changes to the editable fields', () => {
                cy.get('#phone-number-field').should('have.value', '+1 (403) 266-1234');
                cy.get('button#save-agent').click();
                cy.wait(300);
                cy.get('#phone-number-field').should('have.value', '+1 (403) 266-1234');
              });

              it('changes the agent\'s record', () => {
                cy.task('query', `SELECT * FROM "Agents";`).then(([results, metadata]) => {
                  expect(results.length).to.eq(1);
                  expect(results[0].socialProfile.phone_number).to.be.undefined;
                  cy.get('button#save-agent').click();
                  cy.task('query', `SELECT * FROM "Agents";`).then(([results, metadata]) => {
                    expect(results[0].socialProfile.phone_number).to.eq('+1 (403) 266-1234');
                  });
                });
              });

              it('displays a friendly message', () => {
                cy.get('#phone-number-field').should('have.value', '+1 (403) 266-1234');
                cy.get('button#save-agent').click();
                cy.wait(300);
                cy.get('#flash-message').contains('Agent updated');
              });

              it('persists updated root data between browser refreshes', () => {
                cy.get('#phone-number-field').should('have.value', '+1 (403) 266-1234');
                cy.get('button#save-agent').click();
                cy.wait(300);
                cy.get('#phone-number-field').should('have.value', '+1 (403) 266-1234');
                cy.reload();
                cy.wait(300);
                cy.get('#phone-number-field').should('have.value', '+1 (403) 266-1234');
              });

              it('displays progress spinner', () => {
                cy.get('div[role="progressbar"] svg circle').should('not.exist');

                cy.get('button#save-agent').click();
                // 2020-5-26
                // Cypress goes too fast for this. Cypress also cannot intercept
                // native `fetch` calls to allow stubbing and delaying the route.
                // Shamefully, this is currently manually tested, though I suspect
                // I will use this opportunity to learn Jest
                // Despite its name, this test really ensures the spinner disappears
                // after all is said and done
                //cy.get('button#save-agent').should('be.disabled');
                //cy.get('button#cancel-agent-changes').should('be.disabled');
                //cy.get('div[role="progressbar"] svg circle').should('exist');
                cy.wait(100);
                cy.get('div[role="progressbar"] svg circle').should('not.exist');
                cy.get('button#save-agent').should('not.exist');
                cy.get('button#cancel-agent-changes').should('not.exist');
              });
            });
          });
        });

        describe('all field update', () => {
          describe('successfully makes changes', () => {
            beforeEach(() => {
              cy.get('#agent-name-field').clear();
              cy.get('#agent-name-field').type('Some Groovy Cat');

              cy.get('#phone-number-field').clear();
              cy.get('#phone-number-field').type('14032661234');
            });

            it('lands in the proper place', () => {
              cy.get('button#save-agent').click();
              cy.wait(300);
              cy.url().should('contain', `/#/agent/${agent.socialProfile.user_id}`);
            });

            it('persists the changes to the editable fields', () => {
              cy.get('#agent-name-field').should('have.value', 'Some Groovy Cat');
              cy.get('#phone-number-field').should('have.value', '+1 (403) 266-1234');
              cy.get('button#save-agent').click();
              cy.wait(300);
              cy.get('#agent-name-field').should('have.value', 'Some Groovy Cat');
              cy.get('#phone-number-field').should('have.value', '+1 (403) 266-1234');
            });

            it('changes the agent\'s record', () => {
              cy.task('query', `SELECT * FROM "Agents";`).then(([results, metadata]) => {
                expect(results.length).to.eq(1);
                expect(results[0].socialProfile.name).to.eq('Some Guy');;
                expect(results[0].socialProfile.phone_number).to.be.undefined;
                cy.get('button#save-agent').click();
                cy.task('query', `SELECT * FROM "Agents";`).then(([results, metadata]) => {
                  expect(results[0].socialProfile.name).to.eq('Some Groovy Cat');
                  expect(results[0].socialProfile.phone_number).to.eq('+1 (403) 266-1234');
                });
              });
            });

            it('displays a friendly message', () => {
              cy.get('#agent-name-field').should('have.value', 'Some Groovy Cat');
              cy.get('#phone-number-field').should('have.value', '+1 (403) 266-1234');
              cy.get('button#save-agent').click();
              cy.wait(300);
              cy.get('#flash-message').contains('Agent updated');
            });

            it('persists updated root data between browser refreshes', () => {
              cy.get('#agent-name-field').should('have.value', 'Some Groovy Cat');
              cy.get('#phone-number-field').should('have.value', '+1 (403) 266-1234');
              cy.get('button#save-agent').click();
              cy.wait(300);
              cy.get('#agent-name-field').should('have.value', 'Some Groovy Cat');
              cy.get('#phone-number-field').should('have.value', '+1 (403) 266-1234');
              cy.reload();
              cy.wait(300);
              cy.get('#agent-name-field').should('have.value', 'Some Groovy Cat');
              cy.get('#phone-number-field').should('have.value', '+1 (403) 266-1234');
            });

            it('displays progress spinner', () => {
              cy.get('div[role="progressbar"] svg circle').should('not.exist');

              cy.get('button#save-agent').click();
              // 2020-5-26
              // Cypress goes too fast for this. Cypress also cannot intercept
              // native `fetch` calls to allow stubbing and delaying the route.
              // Shamefully, this is currently manually tested, though I suspect
              // I will use this opportunity to learn Jest
              // Despite its name, this test really ensures the spinner disappears
              // after all is said and done
              //cy.get('button#save-agent').should('be.disabled');
              //cy.get('button#cancel-agent-changes').should('be.disabled');
              //cy.get('div[role="progressbar"] svg circle').should('exist');
              cy.wait(100);
              cy.get('div[role="progressbar"] svg circle').should('not.exist');
              cy.get('button#save-agent').should('not.exist');
              cy.get('button#cancel-agent-changes').should('not.exist');
            });
          });
        });

        describe('#timezone-dropdown', () => {
          it('populates the dropdown with all the timezones in the world', () => {
            cy.get('div[role="presentation"] ul li').should('not.exist');
            cy.get('#profile-table table tbody tr td #timezone-dropdown + div button:last-of-type').click();
            cy.wait(300);
            cy.get('div[role="presentation"] ul li').its('length').should('eq', 544);
          });

          it('displays a spinner when a new timezone is set', () => {
            cy.get('#profile-table table tbody tr td #timezone-dropdown + div button:last-of-type').click();
            cy.wait(300);
            cy.get('#set-timezone-spinner').should('not.exist');
            cy.get('#profile-table table tbody tr td #timezone-dropdown').type('america/ed{downarrow}{enter}');
            // Cypress goes too fast for the spinner. This ensures it disappears when done
            //cy.get('#set-timezone-spinner').should('exist');
            cy.wait(300);
            cy.get('#set-timezone-spinner').should('not.exist');
          });

          it('persists the change', () => {
            cy.get('#profile-table table tbody tr td label[for="timezone-dropdown"]').contains('Set your timezone');
            cy.get('#profile-table table tbody tr td #timezone-dropdown').type('america/ed{downarrow}{enter}');
            cy.wait(300);
            cy.get('#profile-table table tbody tr td input#timezone-dropdown').should('have.attr', 'value').and('equal', 'America/Edmonton');
            cy.reload();
            cy.wait(300);
            cy.get('#profile-table table tbody tr td input#timezone-dropdown').should('have.attr', 'value').and('equal', 'America/Edmonton');
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

          cy.get('#profile-table table tbody tr th').contains('Timezone:');
          cy.get('#profile-table table tbody tr td label[for="timezone-dropdown"]').contains('Set your timezone');
          cy.get('#profile-table table tbody tr td input#timezone-dropdown').should('be.disabled');

          // Not really relevant for root-level agent profile edits, but included here anyway
          cy.get('#profile-table table tbody tr th').contains('SIL Locale:');
          cy.get('#profile-table table tbody tr td #sil-local-dropdown').should('not.be.disabled');
        });
      });
    });
  });
});

export {}
