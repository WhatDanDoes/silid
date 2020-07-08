context('viewer/Organization show', function() {

  before(function() {
    cy.fixture('google-profile-response').as('profile');
  });

  let _profile;
  beforeEach(function() {
    _profile = {...this.profile};
  });

  afterEach(() => {
    cy.task('query', 'TRUNCATE TABLE "Agents" CASCADE;');
  });

  describe('authenticated', () => {

    let organizationId, teamId, leader, organizer;
    beforeEach(() => {
      organizationId = 'some-organization-uuid-v4';
      teamId = 'some-team-uuid-v4';

      cy.login('commissioner@example.com', {..._profile, name: 'Nick Sakiewicz', user_metadata: {
                                               organizations: [
                                                 {
                                                   id: organizationId,
                                                   name: 'The National Lacrosse League',
                                                   organizer: 'commissioner@example.com',
                                                 }
                                               ]
                                             } });

      cy.task('query', `SELECT * FROM "Agents" WHERE "email"='commissioner@example.com' LIMIT 1;`).then(([results, metadata]) => {
        organizer = results[0];

        // The '123' role ID matches that defined in the RBAC mock server
        cy.request('POST', `https://localhost:3002/api/v2/users/${organizer.socialProfile.user_id}/roles`, { roles: ['123'] });

        // Team leader
        cy.login('coach@example.com', {..._profile, name: 'Curt Malawsky',
                                        user_metadata: {
                                          teams: [
                                            {
                                              id: teamId,
                                              name: 'The Calgary Roughnecks',
                                              leader: 'coach@example.com',
                                              organizationId: organizationId,
                                            }
                                          ]
                                        }
                                      });
  
        cy.task('query', `SELECT * FROM "Agents" WHERE "email"='coach@example.com' LIMIT 1;`).then(([results, metadata]) => {
          leader = results[0];
        });
      });
    });

    it('doesn\'t barf if organization doesn\'t exist', () => {
      cy.visit('/#/organization/333');
      cy.get('#error-message').contains('No such organization');
    });

    context('visit by leader of member team', () => {

      beforeEach(() => {
        // Membership established in first `beforeEach`
        cy.login(leader.email, {..._profile, name: leader.name});
        cy.contains('The Calgary Roughnecks').click();
        cy.wait(300);
        cy.get('#team-profile-info tbody tr td').contains('The National Lacrosse League').click();
      });

      it('lands in the right spot', () => {
        cy.url().should('contain', `/#/organization/${organizationId}`);
      });

      it('displays appropriate Organization interface elements', () => {
        cy.get('h3').contains('Organization');
        cy.get('#org-profile-info tbody tr td input#org-name-field').should('have.value', organizer.socialProfile.user_metadata.organizations[0].name);
        cy.get('#org-profile-info tbody tr td').contains(organizer.email);
        cy.get('button#delete-team').should('not.exist');
        cy.get('button#save-team').should('not.exist');
        cy.get('button#cancel-team-changes').should('not.exist');
      });

      it('displays member teams in a table', () => {
        cy.get('#member-teams-table h6').contains('Teams');
        cy.get('#member-teams-table table tbody tr td').contains('No records to display').should('not.exist');
        // No add-team button
        cy.get('#member-teams-table button span span').should('not.exist');

        cy.get('#member-teams-table table thead tr th').contains('Name');
        cy.get('#member-teams-table table thead tr th').contains('Leader');

        cy.get('#member-teams-table table tbody tr:nth-of-type(1) button[title=Delete]').should('not.exist');
        cy.get('#member-teams-table table tbody tr:nth-of-type(1) td a')
          .should('contain', leader.socialProfile.user_metadata.teams[0].name)
          .and('have.attr', 'href')
          .and('equal', `#team/${leader.socialProfile.user_metadata.teams[0].id}`);
        cy.get('#member-teams-table table tbody tr:nth-of-type(1) td').contains(leader.email);
      });
    });

    context('visit by member of member team', () => {

      beforeEach(() => {
        // Team player
        cy.login('player@example.com', {..._profile, name: 'Tracey Kelusky',
                                        user_metadata: {
                                          teams: [
                                            {
                                              id: teamId,
                                              name: 'The Calgary Roughnecks',
                                              leader: 'coach@example.com',
                                              organizationId: organizationId,
                                            }
                                          ]
                                        }
                                      });

        cy.contains('The Calgary Roughnecks').click();
        cy.wait(300);
        cy.get('#team-profile-info tbody tr td').contains('The National Lacrosse League').click();
        cy.wait(300);
      });

      it('lands in the right spot', () => {
        cy.url().should('contain', `/#/organization/${organizationId}`);
      });

      it('displays appropriate Organization interface elements', () => {
        cy.get('h3').contains('Organization');
        cy.get('#org-profile-info tbody tr td input#org-name-field').should('have.value', organizer.socialProfile.user_metadata.organizations[0].name);
        cy.get('#org-profile-info tbody tr td').contains(organizer.email);
        cy.get('button#delete-team').should('not.exist');
        cy.get('button#save-team').should('not.exist');
        cy.get('button#cancel-team-changes').should('not.exist');
      });

      it('displays member teams in a table', () => {
        cy.get('#member-teams-table h6').contains('Teams');
        cy.get('#member-teams-table table tbody tr td').contains('No records to display').should('not.exist');
        // No add-team button
        cy.get('#member-teams-table button span span').should('not.exist');

        cy.get('#member-teams-table table thead tr th').contains('Name');
        cy.get('#member-teams-table table thead tr th').contains('Leader');

        cy.get('#member-teams-table table tbody tr:nth-of-type(1) button[title=Delete]').should('not.exist');
        cy.get('#member-teams-table table tbody tr:nth-of-type(1) td a')
          .should('contain', leader.socialProfile.user_metadata.teams[0].name)
          .and('have.attr', 'href')
          .and('equal', `#team/${leader.socialProfile.user_metadata.teams[0].id}`);
        cy.get('#member-teams-table table tbody tr:nth-of-type(1) td').contains(leader.email);
      });
    });
  });
});

export {}
