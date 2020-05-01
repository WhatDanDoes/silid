context('Team edit', function() {

  before(function() {
    cy.fixture('google-profile-response').as('profile');
    cy.fixture('permissions').as('scope');
  });

  afterEach(() => {
    cy.task('query', 'TRUNCATE TABLE "Agents" CASCADE;');
  });

  let _profile;
  beforeEach(function() {
    _profile = {...this.profile};
  });

  describe('Editing', () => {

    let agent, organization, team;
    beforeEach(function() {
      cy.login(_profile.email, _profile, [this.scope.read.agents,
                                          this.scope.create.organizations,
                                          this.scope.read.organizations,
                                          this.scope.create.teams,
                                          this.scope.read.teams,
                                          this.scope.update.teams]);

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

            describe('with insufficient privilege', () => {
              beforeEach(function() {
                cy.login(_profile.email, agent.socialProfile, [this.scope.read.agents, this.scope.read.teams]);
                cy.task('query', `SELECT * FROM "Agents" WHERE "email"='${_profile.email}' LIMIT 1;`).then(([results, metadata]) => {
                  agent = results[0];

                  cy.contains('The A-Team').click();
                  cy.wait(300);
                  cy.get('#team-name-field').clear();
                  cy.get('#team-name-field').type('The K-Team');
                  cy.get('button#save-team').click();
                  cy.wait(300);
                });
              });

              it('lands in the proper place', () => {
                cy.url().should('contain', `/#/team/${agent.socialProfile.user_metadata.teams[0].id}`);
              });

              it('displays a friendly error message', () => {
                cy.get('#flash-message').contains('Insufficient scope');

                // Do it again to ensure flash message is reset
                cy.get('#flash-message #close-flash').click();
                cy.wait(100);
                cy.get('button#save-team').click();
                cy.get('#flash-message').contains('Insufficient scope');
              });

              it('does not change the record in the team leader\'s user_metadata', () => {
                cy.task('query', `SELECT * FROM "Agents";`).then(([results, metadata]) => {
                  expect(results[0].socialProfile.user_metadata.teams.length).to.eq(1);
                  expect(results[0].socialProfile.user_metadata.teams[0].name).to.eq('The A-Team');
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
    });
  });
});

export {}
