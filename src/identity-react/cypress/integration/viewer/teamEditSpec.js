context('Team edit', function() {

  before(function() {
    cy.fixture('google-profile-response').as('profile');
    cy.fixture('permissions').as('scope');
  });

  afterEach(() => {
    // Cypress thinks it can handle asynchronicity better than it can.
    // This makes sure sensitive tests complete before the DB is cleaned
    cy.wait(200);
    cy.task('query', 'TRUNCATE TABLE "Agents" CASCADE;');
    cy.task('query', 'TRUNCATE TABLE "Invitations" CASCADE;');
  });

  let _profile;
  beforeEach(function() {
    _profile = {...this.profile};
  });

  describe('Editing', () => {

    let agent, organization, team;
    beforeEach(function() {
      cy.login(_profile.email, _profile);

      cy.get('button span span').contains('add_box').click();
      cy.get('input[placeholder="Name"]').type('The A-Team');
      cy.get('button[title="Save"]').click();
      cy.wait(300);
      cy.contains('The A-Team').click();

      cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
        agent = results[0];

      });
    });

    describe('Editable', () => {
      describe('#team-name-field', () => {
        it('reveals Save and Cancel buttons on change', () => {
          cy.get('button#delete-team').should('exist');
          cy.get('button#save-team').should('not.exist');
          cy.get('button#cancel-team-changes').should('not.exist');

          cy.get('#team-name-field').type('!!!');
          cy.get('#team-name-field').should('have.value', 'The A-Team!!!');

          cy.get('button#delete-team').should('not.exist');
          cy.get('button#save-team').should('exist');
          cy.get('button#cancel-team-changes').should('exist');
        });

        describe('#cancel-team-update button', () => {
          beforeEach(() => {
            cy.get('#team-name-field').clear();
            cy.get('#team-name-field').type('The K-Team');
          });

          it('resets the changes to the editable fields', () => {
            cy.get('#team-name-field').should('have.value', 'The K-Team');
            cy.get('button#cancel-team-changes').click();
            cy.get('#team-name-field').should('have.value', 'The A-Team');
          });

          it('hides the Cancel and Save buttons', () => {
            cy.get('button#delete-team').should('not.exist');
            cy.get('button#save-team').should('exist');
            cy.get('button#cancel-team-changes').should('exist');

            cy.get('button#cancel-team-changes').click();

            cy.get('button#delete-team').should('exist');
            cy.get('button#save-team').should('not.exist');
            cy.get('button#cancel-team-changes').should('not.exist');
          });

          it('does not change the record in the team leader\'s user_metadata', () => {
            cy.task('query', `SELECT * FROM "Agents";`).then(([results, metadata]) => {
              expect(results.length).to.eq(1);
              expect(results[0].socialProfile.user_metadata.teams.length).to.eq(1);
              expect(results[0].socialProfile.user_metadata.teams[0].name).to.eq('The A-Team');
              cy.get('button#cancel-team-changes').click();
              cy.task('query', `SELECT * FROM "Agents";`).then(([results, metadata]) => {
                expect(results[0].socialProfile.user_metadata.teams.length).to.eq(1);
                expect(results[0].socialProfile.user_metadata.teams[0].name).to.eq('The A-Team');
              });
            });
          });
        });

        describe('#save-team button', () => {

          describe('is unsuccessful in making changes', () => {

            describe('with invalid field', () => {
              it('empty name field', () => {
                cy.get('#team-name-field').clear();
                cy.get('#team-name-field').should('have.value', '');
                cy.get('button#save-team').click();
                cy.wait(300);
                cy.get('#flash-message').contains('Team name can\'t be blank');
              });

              it('blank name field', () => {
                cy.get('#team-name-field').clear();
                cy.get('#team-name-field').type('     ');
                cy.get('#team-name-field').should('have.value', '     ');
                cy.get('button#save-team').click();
                cy.wait(300);
                cy.get('#flash-message').contains('Team name can\'t be blank');
              });

              it('does not change the record in the team leader\'s user_metadata', () => {
                cy.task('query', `SELECT * FROM "Agents";`).then(([results, metadata]) => {
                  expect(results.length).to.eq(1);
                  expect(results[0].socialProfile.user_metadata.teams.length).to.eq(1);
                  expect(results[0].socialProfile.user_metadata.teams[0].name).to.eq('The A-Team');

                  cy.get('#team-name-field').clear();
                  cy.get('button#save-team').click();

                  cy.task('query', `SELECT * FROM "Agents";`).then(([results, metadata]) => {
                    expect(results[0].socialProfile.user_metadata.teams.length).to.eq(1);
                    expect(results[0].socialProfile.user_metadata.teams[0].name).to.eq('The A-Team');
                  });
                });
              });

              describe('duplicate team name', () => {
                beforeEach(() => {
                  cy.visit('/#/agent');
                  cy.wait(300);
                  cy.get('table tbody tr td').contains('The A-Team');

                  cy.get('button span span').contains('add_box').click();
                  cy.get('input[placeholder="Name"]').type('The K-Team');
                  cy.get('button[title="Save"]').click();
                  cy.wait(300);

                  cy.contains('The K-Team').click();
                  cy.wait(300);
                });

                it('displays friendly error message', () => {
                  cy.get('#team-name-field').clear();
                  cy.get('#team-name-field').type('The A-Team');
                  cy.get('button#save-team').click();
                  cy.wait(300);
                  cy.get('#flash-message').contains('That team is already registered');
                  cy.get('#flash-message #close-flash').click();

                  // Make sure flash state resets
                  cy.get('button#save-team').click();
                  cy.wait(300);
                  cy.get('#flash-message').contains('That team is already registered');
                });

                it('does not change the record in the team leader\'s user_metadata', () => {
                  cy.task('query', `SELECT * FROM "Agents";`).then(([results, metadata]) => {
                    expect(results[0].socialProfile.user_metadata.teams.length).to.eq(2);
                    expect(results[0].socialProfile.user_metadata.teams[0].name).to.eq('The A-Team');
                    expect(results[0].socialProfile.user_metadata.teams[1].name).to.eq('The K-Team');

                    cy.get('#team-name-field').clear();
                    cy.get('#team-name-field').type('The A-Team');
                    cy.get('button#save-team').click();

                    cy.task('query', `SELECT * FROM "Agents";`).then(([results, metadata]) => {
                      expect(results[0].socialProfile.user_metadata.teams.length).to.eq(2);
                      expect(results[0].socialProfile.user_metadata.teams[0].name).to.eq('The A-Team');
                      expect(results[0].socialProfile.user_metadata.teams[1].name).to.eq('The K-Team');
                    });
                  });
                });
              });
            });
          });

          describe('successfully makes changes', () => {
            beforeEach(() => {
              cy.get('#team-name-field').clear();
              cy.get('#team-name-field').type('The K-Team');
            });

            it('lands in the proper place', () => {
              cy.get('button#save-team').click();
              cy.wait(300);
              cy.url().should('contain', `/#/team/${agent.socialProfile.user_metadata.teams[0].id}`);
            });

            it('persists the changes to the editable fields', () => {
              cy.get('#team-name-field').should('have.value', 'The K-Team');
              cy.get('button#save-team').click();
              cy.wait(300);
              cy.get('#team-name-field').should('have.value', 'The K-Team');
            });

            it('hides the Cancel and Save buttons', () => {
              cy.get('button#delete-team').should('not.exist');
              cy.get('button#save-team').should('exist');
              cy.get('button#cancel-team-changes').should('exist');

              cy.get('button#save-team').click();

              cy.get('button#delete-team').should('exist');
              cy.get('button#save-team').should('not.exist');
              cy.get('button#cancel-team-changes').should('not.exist');
            });

            it('changes the record in the team leader\'s user_metadata', () => {
              cy.task('query', `SELECT * FROM "Agents";`).then(([results, metadata]) => {
                expect(results.length).to.eq(1);
                expect(results[0].socialProfile.user_metadata.teams.length).to.eq(1);
                expect(results[0].socialProfile.user_metadata.teams[0].name).to.eq('The A-Team');
                cy.get('button#save-team').click();
                cy.task('query', `SELECT * FROM "Agents";`).then(([results, metadata]) => {
                  expect(results[0].socialProfile.user_metadata.teams.length).to.eq(1);
                  expect(results[0].socialProfile.user_metadata.teams[0].name).to.eq('The K-Team');
                });
              });
            });

            it('displays a friendly message', () => {
              cy.get('#team-name-field').should('have.value', 'The K-Team');
              cy.get('button#save-team').click();
              cy.wait(300);
              cy.get('#flash-message').contains('Team updated');
            });

            it('persists updated team data between browser refreshes', function() {
              cy.get('#team-name-field').should('have.value', 'The K-Team');
              cy.get('button#save-team').click();
              cy.wait(300);
              cy.get('#team-name-field').should('have.value', 'The K-Team');
              cy.reload();
              cy.wait(300);
              cy.contains('The K-Team').click();
              cy.wait(300);
              cy.get('#team-name-field').should('have.value', 'The K-Team');
            });
          });
        });
      });

      describe('member agents', () => {

        let memberAgent;
        describe('has accepted invitation', () => {
          beforeEach(function() {
            // Team leader logged in, adds user
            cy.get('#members-table button span span').contains('add_box').click();
            cy.get('#members-table [placeholder="Email"]').type('someotherguy@example.com');
            cy.get('#members-table button[title="Save"]').click();
            cy.wait(300);

            // Invited member logs in...
            cy.login('someotherguy@example.com', {..._profile, name: 'Some Other Guy'});

            cy.task('query', `SELECT * FROM "Agents" WHERE "email"='someotherguy@example.com' LIMIT 1;`).then(([results, metadata]) => {
              memberAgent = results[0];

              // ... accepts the invitation
              cy.get('#rsvps-table table tbody tr td button span').contains('check').click();

              // Refresh agent model to get `socialProfile`
              cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
                agent = results[0];

                // Team leader logs in again...
                cy.login(agent.email, _profile);

                // ... and views the team
                cy.contains('The A-Team').click();
                cy.wait(300);

                // Change team name
                cy.get('#team-name-field').clear();
                cy.get('#team-name-field').type('The K-Team');
                cy.get('button#save-team').click();
                cy.wait(300);
              });
            });
          });

          it('updates team name', function() {
            // Invited member logs in...
            cy.login(memberAgent.email, {..._profile, name: memberAgent.name});

            cy.get('#rsvps-table').should('not.exist');
            cy.get('#teams-table table tbody').find('tr').its('length').should('eq', 1);
            cy.get('#teams-table table tbody tr td').contains('The K-Team');
          });
        });

        describe('invited agent is unknown', () => {
          describe('has not accepted the invitation', () => {
            beforeEach(function() {
              // Team leader adds user
              cy.get('#members-table button span span').contains('add_box').click();
              cy.get('#members-table [placeholder="Email"]').type('someotherguy@example.com');
              cy.get('#members-table button[title="Save"]').click();

              // ... changes team name
              cy.get('#team-name-field').clear();
              cy.get('#team-name-field').type('The K-Team');
              cy.get('button#save-team').click();
              cy.wait(300);

              // Invited member logs in...
              cy.login('someotherguy@example.com', {..._profile, name: 'Some Other Guy'});
            });

            it('updates pending rsvp', function() {
              cy.get('#teams-table').contains('No records to display');
              cy.get('#rsvps-table table tbody').find('tr').its('length').should('eq', 1);
              cy.get('#rsvps-table table tbody tr td').contains('The K-Team');
            });
          });
        });

        describe('invited agent is known', () => {

          beforeEach(function() {
            // Invited member logs in, and in does so, creates an account...
            cy.login('someotherguy@example.com', {..._profile, name: 'Some Other Guy'});

            // Team leader logs in and...
            cy.login(_profile.email, _profile);

            // ... views the team
            cy.contains('The A-Team').click();
            cy.wait(300);

            // ... adds user
            cy.get('#members-table button span span').contains('add_box').click();
            cy.get('#members-table [placeholder="Email"]').type('someotherguy@example.com');
            cy.get('#members-table button[title="Save"]').click();
            cy.wait(300);

            // Change team name
            cy.get('#team-name-field').clear();
            cy.get('#team-name-field').type('The K-Team');
            cy.get('button#save-team').click();
            cy.wait(300);

            // Invited member logs back in
            cy.login('someotherguy@example.com', {..._profile, name: 'Some Other Guy'});
          });

          describe('has not accepted the invitation', () => {
            it('updates pending rsvp', function() {
              cy.get('#teams-table').contains('No records to display');
              cy.get('#rsvps-table table tbody').find('tr').its('length').should('eq', 1);
              cy.get('#rsvps-table table tbody tr td').contains('The K-Team');
            });
          });
        });
      });
    });
  });
});

export {}
