import React, { useState, useEffect } from 'react';
import { Redirect } from 'react-router-dom';
import { createStyles, makeStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';


import Grid from '@material-ui/core/Grid';

/**
 * For profile data display
 */
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableRow from '@material-ui/core/TableRow';
import Paper from '@material-ui/core/Paper';
import MaterialTable from 'material-table';

import Link from '@material-ui/core/Link';

import Button from '@material-ui/core/Button';
import Flash from '../components/Flash';
import { useAuthState } from '../auth/Auth';
import { useAdminState } from '../auth/Admin';

import useGetOrganizationInfoService from '../services/useGetOrganizationInfoService';
import usePutOrganizationService from '../services/usePutOrganizationService';
import useDeleteOrganizationService from '../services/useDeleteOrganizationService';

import { useLanguageProviderState, LPFormattedMessage as FormattedMessage } from '../components/LanguageProvider';

const useStyles = makeStyles((theme) =>
  createStyles({
    margin: {
      margin: theme.spacing(1),
    },
    textField: {
      marginLeft: theme.spacing(1),
      marginRight: theme.spacing(1),
      width: '100%',
    },
    [theme.breakpoints.down('sm')]: {
      card: {
        marginTop: '4%',
        maxWidth: 720,
      },
    },
    [theme.breakpoints.up('md')]: {
      card: {
        marginLeft: '25%',
        marginTop: '4%',
        maxWidth: 720,
      },
    },
  }),
);

const OrganizationInfo = (props) => {
  const classes = useStyles();

  const {agent} = useAuthState();
  const admin = useAdminState();

  const [prevInputState, setPrevInputState] = useState({});

  const [toAgent, setToAgent] = useState(null);
  const [flashProps, setFlashProps] = useState({});
  const [isWaiting, setIsWaiting] = useState(false);

  const [orgInfo, setOrgInfo] = useState({});

  const service = useGetOrganizationInfoService(props.match.params.id);
  let { publishOrganization } = usePutOrganizationService();
  let { deleteOrganization } = useDeleteOrganizationService();

  const { getFormattedMessage } = useLanguageProviderState();

  useEffect(() => {
    if (service.status === 'loaded') {
      setOrgInfo(service.payload);
    }
  }, [service]);

  /**
   * Update this organization
   */
  const handleUpdate = (evt) => {
    // Front-end validation
    if (!orgInfo.name.trim()) {
      return setFlashProps({ message: 'Organization name can\'t be blank', variant: 'error' });
    }

    publishOrganization({...orgInfo}).then(results => {
      if (results.statusCode) {
        setFlashProps({ message: results.message, variant: 'error' });
      }
      else if (results.errors) {
        setFlashProps({...results, variant: 'error' });
      }
      else {
        setPrevInputState({});
        setOrgInfo(results);
        setFlashProps({ message: 'Organization updated', variant: 'success' });
      }
    }).catch(err => {
      console.log(JSON.stringify(err));
    });
  }

  /**
   * Remove this organization
   */
  const handleDelete = (evt) => {
    if (orgInfo.teams.length) {
      return window.alert('Remove all member teams before deleting the organization');
    }
    if (window.confirm('Are you sure you want to delete this organization?')) {
      deleteOrganization(orgInfo.id).then(results => {
        setToAgent(results.organizerId);
      });
    }
  }

  /**
   * Redirect to `/agent` when this team is deleted
   */
  if (toAgent) {
    if (orgInfo.organizer === agent.email) {
      return <Redirect to={{ pathname: `/agent`, state: 'Organization deleted' }} />
    }
    return <Redirect to={{ pathname: `/agent/${toAgent}`, state: 'Organization deleted' }} />
  }

  return (
    <div className={classes.root}>
      <Grid container direction="column" justify="center" alignItems="center">
        <Grid item>
          <Typography variant="body2" color="textSecondary" component="p">
            {service.status === 'loading' && <span>Loading...</span>}
          </Typography>
        </Grid>
        {service.status === 'loaded' && service.payload ?
          <>
            <Grid item>
              <Typography className={classes.header} variant="h5" component="h3">
                <FormattedMessage id='Organization' />
              </Typography>
            </Grid>
            <Grid item className={classes.grid}>
              <TableContainer component={Paper}>
                <Table id="org-profile-info" className={classes.table} aria-label="Team profile info">
                  <TableBody>
                    <TableRow>
                      <TableCell align="right" component="th" scope="row">
                        <FormattedMessage id='Name' />:
                      </TableCell>
                      <TableCell align="left">
                        <input id="org-name-field" value={orgInfo.name || ''} disabled={agent.email !== orgInfo.organizer && !admin.isEnabled}
                          onChange={e => {
                              if (!prevInputState.name) {
                                setPrevInputState({ name: orgInfo.name });
                              }
                              setOrgInfo({ ...orgInfo, name: e.target.value });
                            }
                          } />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell align="right" component="th" scope="row">
                        <FormattedMessage id='Email' />:
                      </TableCell>
                      <TableCell align="left">{orgInfo.organizer}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
            {orgInfo.organizer === agent.email || admin.isEnabled ?
              <Grid item className={classes.grid}>
                <TableContainer>
                  <Table className={classes.table} aria-label="Team delete">
                    <TableBody>
                      <TableRow>
                        { Object.keys(prevInputState).length ?
                          <>
                            <TableCell align="right">
                              <Button id="cancel-org-changes" variant="contained" color="secondary"
                                      onClick={e => {
                                        setOrgInfo({ ...orgInfo, ...prevInputState });
                                        setPrevInputState({});
                                      }
                              }>
                                Cancel
                              </Button>
                            </TableCell>
                            <TableCell align="left">
                              <Button id="save-org" variant="contained" color="primary" onClick={handleUpdate}>
                                Save
                              </Button>
                            </TableCell>
                          </>
                        :
                          <TableCell align="left">
                            <Button id="delete-org" variant="contained" color="secondary" onClick={handleDelete}>
                              <FormattedMessage id='Delete' />
                            </Button>
                          </TableCell>
                        }
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
            : ''}

            <Grid id="member-teams-table" item className={classes.grid}>
              <MaterialTable
                title={getFormattedMessage('Teams')}
                isLoading={isWaiting}
                columns={[
                  {
                    title: getFormattedMessage('Name'),
                    field: 'name',
                    editable: 'never',
                    render: (rowData) => {
                      return rowData ? <Link href={`#team/${rowData.id}`}>{rowData.name}</Link> : null;
                    }
                  },
                  {
                    title: getFormattedMessage('Leader'),
                    field: 'leader',
                    editable: 'never',
                  }
                ]}
                data={orgInfo.teams ? orgInfo.teams : []}
                options={{ search: false, paging: false }}
                actions={
                  [
                    rowData => ({
                      icon: 'delete_outline',
                      isFreeAction: false,
                      tooltip: getFormattedMessage('Delete'),
                      hidden: orgInfo.organizer !== agent.email && !admin.isEnabled,
                      onClick:() => {
                        new Promise((resolve, reject) => {
                          if (window.confirm(getFormattedMessage('Remove team from organization?'))) {
                            setIsWaiting(true);

                            const headers = new Headers();
                            headers.append('Content-Type', 'application/json; charset=utf-8');
                            fetch(`/organization/${orgInfo.id}/team/${rowData.id}${admin.isEnabled ? '/admin' : ''}`,
                              {
                                method: 'DELETE',
                                headers,
                              }
                            )
                            .then(response => response.json())
                            .then(response => {
                              console.log(JSON.stringify(response));
                              if (response.id === rowData.id) {
                                orgInfo.teams.splice(orgInfo.teams.findIndex(m => m.user_id === rowData.user_id), 1);
                                setOrgInfo({ ...orgInfo });
                                setFlashProps({ message: `${rowData.name} have been removed from ${orgInfo.name}`, variant: 'success' });
                                resolve();
                              }
                              else {
                                setFlashProps({ message: getFormattedMessage('Deletion cannot be confirmed'), variant: 'warning' });
                                reject(response);
                              }
                            }).catch(error => {
                              reject(error);
                            }).finally(() => {
                              setIsWaiting(false);
                            });
                          }
                          else {
                            setIsWaiting(false);
                            reject();
                          }
                        })
                      }
                    })
                  ]}
              />
            </Grid>
          </>

        : ''}
        {service.status === 'error' && (
          <Typography id="error-message" variant="h5" component="h3">
            {service.error}
          </Typography>
        )}
      </Grid>

      { flashProps.message ? <Flash message={getFormattedMessage(flashProps.message)} onClose={() => setFlashProps({})} variant={flashProps.variant} /> : '' }
      { flashProps.errors ? flashProps.errors.map(error => <Flash message={getFormattedMessage(error.message)}
                                                                  onClose={() => setFlashProps({})}
                                                                  variant={flashProps.variant}
                                                                  key={`error-${error.message}`} />) : '' }
    </div>
  );
};

export default OrganizationInfo;

