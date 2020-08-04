import React, { useState, useEffect } from 'react';
import { createStyles, makeStyles } from '@material-ui/core/styles';
import Chip from '@material-ui/core/Chip';
import Typography from '@material-ui/core/Typography';
import Link from '@material-ui/core/Link';
import { green, red } from '@material-ui/core/colors';
import Icon from '@material-ui/core/Icon';
import Button from '@material-ui/core/Button';

import { useAdminState } from '../auth/Admin';
import { useAuthState } from '../auth/Auth';
import ReactJson from 'react-json-view';
import Flash from '../components/Flash';

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
import MaterialTable, { MTableEditField } from 'material-table';

import useGetAgentService from '../services/useGetAgentService';
import usePostTeamService from '../services/usePostTeamService';
import useGetTeamInviteActionService from '../services/useGetTeamInviteActionService';
import usePostOrganizationService from '../services/usePostOrganizationService';

/**
 * For SIL Locale selection
 *
 * 2020-7-27 - Swiped from https://material-ui.com/components/autocomplete/#asynchronous-requests
 */
import TextField from '@material-ui/core/TextField';
import Autocomplete from '@material-ui/lab/Autocomplete';
import CircularProgress from '@material-ui/core/CircularProgress'
import { useLanguageProviderState, LPFormattedMessage as FormattedMessage } from '../components/LanguageProvider';

const useStyles = makeStyles(theme =>
  createStyles({
    root: {
      flexGrow: 1,
    },
    button: {
      margin: theme.spacing(0.5),
    },
    header: {
      marginTop: '1em',
      marginBottom: '1em',
    },
    grid: {
      width: '90%',
    },
    textField: {
      marginLeft: theme.spacing(1),
      marginRight: theme.spacing(1),
      width: '100%',
    },
    json: {
      wordWrap: 'break-word',
      wordBreak: 'break-all',
    },
    chipList: {
      display: 'flex',
      flexWrap: 'wrap',
      listStyle: 'none',
      padding: theme.spacing(0.5),
      margin: 0,
    },
    chip: {
      margin: theme.spacing(0.5),
    },
    [theme.breakpoints.down('sm')]: {
      json: {
        maxWidth: '90%'
      },
    },
    [theme.breakpoints.up('md')]: {
      grid: {
        maxWidth: '50%',
      },
      json: {
        maxWidth: '75%'
      },
    },
  })
);

const Agent = (props) => {

  const [profileData, setProfileData] = useState({});
  const [flashProps, setFlashProps] = useState({});
  const [isWaiting, setIsWaiting] = useState(false);
  const [unassignedRoles, setUnassignedRoles] = useState([]);

  const admin = useAdminState();
  const {agent} = useAuthState();

  const classes = useStyles();
  const service = useGetAgentService(props.match.params.id, admin.viewingCached);
  const { publishTeam } = usePostTeamService();
  const { publishOrganization } = usePostOrganizationService();
  const { respondToTeamInvitation } = useGetTeamInviteActionService();


  useEffect(() => {
    if (service.status === 'loaded') {
      if (service.payload.message) {
        setFlashProps({ message: service.payload.message, variant: 'warning' });
      }
      else {
        setProfileData(service.payload);
      }
    }
  }, [service]);

  /**
   * For SIL Locale selection
   *
   * 2020-7-27 - Swiped from https://material-ui.com/components/autocomplete/#asynchronous-requests
   */
  const [localeIsOpen, setLocaleIsOpen] = React.useState(false);
  const [localeOptions, setLocaleOptions] = React.useState([]);
  const [isSettingLocale, setIsSettingLocale] = React.useState(false);
  const loadingLocale = localeIsOpen && localeOptions.length === 0;
  const { messages, setLangCode } = useLanguageProviderState();

  React.useEffect(() => {
    let active = true;

    if (!loadingLocale) {
      return undefined;
    }

    (async () => {
      const response = await fetch('/locale');
      const languages = await response.json();

      if (active) {
        setLocaleOptions(languages);
      }
    })();

    return () => {
      active = false;
    };
  }, [loadingLocale]);

  /**
   * Create a new team
   */
  const createTeam = (newData) => {
    return new Promise((resolve, reject) => {
      newData.name = newData.name.trim();
      if (!newData.name.length) {
        setFlashProps({ message: 'Team name can\'t be blank', variant: 'error' });
        reject();
      }
      else {
        setIsWaiting(true);
        publishTeam(newData).then(profile => {;
          if (profile.statusCode) {
            setFlashProps({ message: profile.message, variant: 'error' });
          }
          else if (profile.errors) {
            setFlashProps({ errors: profile.errors, variant: 'error' });
          }
          else {
            setProfileData(profile);
          }
          resolve();
        }).catch(reject)
        .finally(() => {
          setIsWaiting(false);
        });
      }
    })
  };

  /**
   * Create a new organization
   */
  const createOrganization = (newData) => {
    return new Promise((resolve, reject) => {
      newData.name = newData.name.trim();
      if (!newData.name.length) {
        setFlashProps({ message: 'Organization name can\'t be blank', variant: 'error' });
        reject();
      }
      else {
        setIsWaiting(true);
        publishOrganization(newData).then(profile => {;
          if (profile.statusCode) {
            setFlashProps({ message: profile.message, variant: 'error' });
          }
          else if (profile.errors) {
            setFlashProps({ errors: profile.errors, variant: 'error' });
          }
          else {
            setProfileData(profile);
          }
          resolve();
        }).catch(reject)
        .finally(() => {
          setIsWaiting(false);
        });
      }
    });
  };


  return (
    <div className={classes.root}>
      <Grid container direction="column" justify="center" alignItems="center">
        <Grid item>
          <Typography variant="body2" color="textSecondary" component="p">
            {service.status === 'loading' && <span>Loading...</span>}
          </Typography>
        </Grid>
        <Grid item>
          <Typography className={classes.header} variant="h5" component="h3">
            <FormattedMessage id='profile-table.header' />
          </Typography>
        </Grid>
        {service.status === 'loaded' && service.payload ?
          <>
            <Grid item className={classes.grid}>
              <TableContainer id="profile-table" component={Paper}>
                <Table className={classes.table} aria-label="Agent profile info">
                  <TableBody>
                    <TableRow>
                      <TableCell align="right" component="th" scope="row"><FormattedMessage id='profile-table.name' />:</TableCell>
                      <TableCell align="left">{profileData.name}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell align="right" component="th" scope="row"><FormattedMessage id='profile-table.email' />:</TableCell>
                      <TableCell align="left">{profileData.email}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell align="right" component="th" scope="row"><FormattedMessage id='profile-table.providerLocale' />:</TableCell>
                      <TableCell align="left">{profileData.locale}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell align="right" component="th" scope="row"><FormattedMessage id='profile-table.silLocale' />:</TableCell>
                      <TableCell align="left">
                        <Autocomplete
                          id="sil-local-dropdown"
                          style={{ width: 300 }}
                          open={localeIsOpen}
                          onOpen={() => {
                            setLocaleIsOpen(true);
                          }}
                          onClose={async(event, value) => {
                            setLocaleIsOpen(false);
                          }}
                          onChange={async (event, value) => {

                            if (value && value.iso6393) {
                              return new Promise((resolve, reject) => {
                                setIsSettingLocale(true);
                                const headers = new Headers();
                                headers.append('Access-Control-Allow-Credentials', 'true');
                                headers.append('Content-Type', 'application/json; charset=utf-8');
                                fetch(`/locale/${value.iso6393}`,
                                  {
                                    method: 'PUT',
                                    headers,
                                  }
                                )
                                .then(response => response.json())
                                .then(async(response) => {
                                  if (response.message) {
                                    setFlashProps({ message: response.message, variant: 'error' });
                                  }
                                  else {
                                    setProfileData(response);
                                    setFlashProps({ message: 'Preferred SIL language updated', variant: 'success' });
                                    setLocaleOptions(localeOptions);
                                    setLangCode(response.user_metadata.silLocale.iso6393);
                                  }

                                  resolve();
                                })
                                .catch(error => {
                                  setFlashProps({ message: error.message, variant: 'error' });
                                  reject(error);
                                }).finally(() => {
                                  setIsSettingLocale(false);
                                });
                              });
                            }
                          }}
                          getOptionSelected={(option, value) => option.name === value.name}
                          getOptionLabel={(option) => `${option.name}`}
                          options={localeOptions}
                          loading={loadingLocale}
                          disabled={profileData.email !== agent.email || !profileData.email_verified}
                          value={profileData.user_metadata && profileData.user_metadata.silLocale ? profileData.user_metadata.silLocale : { name: 'English', iso6393: 'eng' }}
                          autoHighlight
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label={messages['profile-table.silLocale.label']}
                              variant="outlined"
                              InputProps={{
                                ...params.InputProps,
                                endAdornment: (
                                  <React.Fragment>
                                    {loadingLocale || isSettingLocale ? <CircularProgress id="set-locale-spinner" color="inherit" size={20} /> : null}
                                    {params.InputProps.endAdornment}
                                  </React.Fragment>
                                ),
                              }}
                            />
                          )}
                        />
                      </TableCell>
                    </TableRow>
                    {profileData.roles && (
                      <TableRow>
                        <TableCell align="right" component="th" scope="row"><FormattedMessage id='profile-table.roles' />:</TableCell>
                        <TableCell id="assigned-roles" align="left" component="td" className={classes.chipList}>
                          {profileData.roles.map(data => {
                            return (
                              <Chip
                                key={data.id}
                                label={data.name}
                                className={classes.chip}
                                onDelete={admin.isEnabled && data.name !== 'viewer' ?
                                  () => {
                                    const headers = new Headers();
                                    headers.append('Content-Type', 'application/json; charset=utf-8');
                                    fetch(`/role/${data.id}/agent/${profileData.user_id}`,
                                      {
                                        method: 'DELETE',
                                        headers,
                                      }
                                    )
                                    .then(response => response.json())
                                    .then(response => {
                                      if (response.message) {
                                        setFlashProps({ message: response.message, variant: 'warning' });
                                      }
                                      else {
                                        setProfileData(response);
                                        setUnassignedRoles([]);
                                      }
                                    })
                                    .catch(error => {
                                      setFlashProps({ message: error.message, variant: 'error' });
                                    });
                                  }
                                : undefined}
                              />
                            );
                          })}
                          {admin.isEnabled && !unassignedRoles.length && (
                            <Chip
                              key="assign-role"
                              id="assign-role"
                              style={{ backgroundColor: '#ffffff' }}
                              className={classes.chip}
                              label={<Icon style={{ color: green[500] }}>add_circle</Icon>}
                              onClick={() => {
                                setIsWaiting(true);
                                const headers = new Headers();
                                headers.append('Content-Type', 'application/json; charset=utf-8');
                                fetch('/role',
                                  {
                                    method: 'GET',
                                    headers,
                                  }
                                )
                                .then(response => response.json())
                                .then(response => {
                                  if (response.message) {
                                    setFlashProps({ message: response.message, variant: 'warning' });
                                  }
                                  else {
                                    const roles = response.filter(role => {
                                      for (let r of profileData.roles) {
                                        if (r.id === role.id) {
                                          return false;
                                        }
                                      }
                                      return true;
                                    });
                                    setUnassignedRoles(roles);
                                  }
                                })
                                .catch(error => {
                                  setFlashProps({ message: error.message, variant: 'error' });
                                }).finally(() => {
                                  setIsWaiting(false);
                                });
                              }}
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                    {unassignedRoles.length ?
                      <TableRow>
                        <TableCell align="right" component="th" scope="row">Available roles:</TableCell>
                        <TableCell id="unassigned-roles" align="left" component="td" className={classes.chipList}>
                          {unassignedRoles.map(data => {
                            return (
                              <Chip
                                key={data.id}
                                label={data.name}
                                className={classes.chip}
                                onClick={() => {
                                  setIsWaiting(true);
                                  const headers = new Headers();
                                  headers.append('Content-Type', 'application/json; charset=utf-8');
                                  fetch(`/role/${data.id}/agent/${profileData.user_id}`,
                                    {
                                      method: 'PUT',
                                      headers,
                                    }
                                  )
                                  .then(response => response.json())
                                  .then(response => {
                                    if (response.message) {
                                      setFlashProps({ message: response.message, variant: 'warning' });
                                    }
                                    else {
                                      setProfileData(response);
                                      const roleIndex = unassignedRoles.findIndex(role => role.id === data.id);
                                      const remainingRoles = [...unassignedRoles];
                                      remainingRoles.splice(roleIndex, 1);
                                      setUnassignedRoles(remainingRoles);
                                    }
                                  })
                                  .catch(error => {
                                    setFlashProps({ message: error.message, variant: 'error' });
                                  })
                                  .finally(() => {
                                    setIsWaiting(false);
                                  });
                                }}
                              />
                            );
                          })}
                          <li key="close-unassigned-roles">
                            <Chip
                              id="close-unassigned-roles"
                              style={{ backgroundColor: '#ffffff' }}
                              className={classes.chip}
                              label={<Icon style={{ color: red[500] }}>close</Icon>}
                              onClick={() => {
                                setUnassignedRoles([]);
                              }}
                            />
                          </li>
                        </TableCell>
                      </TableRow>
                    : undefined}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
            {!profileData.email_verified ?
              <Grid item className={classes.grid}>
                <TableContainer>
                  <Table className={classes.table} aria-label="Resend Verification Email">
                    <TableBody>
                      <TableRow>
                        <TableCell align="center">
                          {profileData.email === agent.email ?
                            <Button
                              id="resend-verification-email-button"
                              variant="contained"
                              color="secondary"
                              onClick={() => {
                                const headers = new Headers();
                                headers.append('Content-Type', 'application/json; charset=utf-8');
                                fetch('/agent/verify',
                                  {
                                    method: 'POST',
                                    body: JSON.stringify({ id: profileData.user_id }),
                                    headers,
                                  }
                                )
                                .then(response => response.json())
                                .then(response => {
                                  if (response.message) {
                                    setFlashProps({ message: response.message, variant: 'success' });
                                  }
                                  else {
                                    setFlashProps({ message: 'Could not verify email was sent', variant: 'warning' });
                                  }
                                })
                                .catch(error => {
                                  setFlashProps({ message: error.message, variant: 'error' });
                                });
                              }}
                            >
                              Resend Verification Email
                            </Button>
                          :
                            <div id='verification-status' style={{ color: 'red' }}>
                              This is an unverified account
                            </div>
                          }
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
            : ''}
            {profileData.user_metadata &&
             profileData.user_metadata.rsvps &&
             profileData.user_metadata.rsvps.length ?
              <>
                <Grid id="rsvps-table" item className={classes.grid}>
                  <MaterialTable
                    title='RSVPs'
                    isLoading={isWaiting}
                    columns={[
                      { title: 'Name', field: 'data.name', editable: 'never' },
                      { title: 'Type', field: 'type', editable: 'never' },
                    ]}
                    data={profileData.user_metadata ? profileData.user_metadata.rsvps : []}
                    options={{ search: false, paging: false }}
                    localization={{ body: { editRow: { deleteText: 'Are you sure you want to ignore this invitation?' } } }}
                    editable={profileData.email_verified ? {
                      onRowDelete: (oldData) => new Promise((resolve, reject) => {
                        respondToTeamInvitation(oldData.uuid, 'reject').then(results => {
                          if (results.error) {
                            setFlashProps({ message: results.message, variant: 'error' });
                            return reject(results);
                          }
                          setFlashProps({ message: 'Invitation ignored', variant: 'warning' });
                          setProfileData(results);
                          resolve();
                        }).catch(err => {
                          reject(err);
                        });
                      }),
                    } : undefined}
                    actions={profileData.email_verified ? [
                      {
                        icon: 'check',
                        tooltip: 'Accept invitation',
                        onClick: (event, rowData) =>
                          new Promise((resolve, reject) => {
                            setIsWaiting(true);
                            respondToTeamInvitation(rowData.uuid, 'accept').then(results => {
                              if (results.error) {
                                setFlashProps({ message: results.message, variant: 'error' });
                                return reject(results);
                              }
                              setFlashProps({ message: 'Welcome to the team', variant: 'success' });
                              setProfileData(results);
                              resolve();
                            }).catch(err => {
                              reject(err);
                            }).finally(() => {
                              setIsWaiting(false);
                            });
                          })
                      }
                    ]: []}
                  />
                </Grid>
                <br />
              </>
            : '' }
            {profileData.roles && profileData.roles.find(r => r.name === 'organizer') ?
              <Grid id="organizations-table" item className={classes.grid}>
                <MaterialTable
                  title='Organizations'
                  isLoading={isWaiting}
                  columns={[
                    {
                      title: 'Name',
                      field: 'name',
                      render: rowData => <Link href={`#organization/${rowData.id}`}>{rowData.name}</Link>,
                      editComponent: (props) => {
                        return (
                          <MTableEditField
                            autoFocus={true}
                            type="text"
                            maxLength="128"
                            placeholder="Name"
                            columnDef={props.columnDef}
                            value={props.value ? props.value : ''}
                            onChange={value => props.onChange(value) }
                            onKeyDown={evt => {
                                if (evt.key === 'Enter') {
                                  createOrganization({ name: evt.target.value });
                                  props.onChange('');
                                  return;
                                }
                              }
                            }
                          />
                        );
                      }
                    },
                    { title: 'Organizer', field: 'organizer', editable: 'never' }
                  ]}
                  data={profileData.user_metadata ? profileData.user_metadata.organizations : []}
                  options={{ search: false, paging: false }}
                  editable={ profileData.email === agent.email ? { onRowAdd: createOrganization }: undefined}
                />
              </Grid>
            : '' }
            <Grid id="teams-table" item className={classes.grid}>
              <MaterialTable
                title={messages['teams-table.header']}
                isLoading={isWaiting}
                columns={[
                  {
                    title: messages['teams-table.name'],
                    field: 'name',
                    render: rowData => {return profileData.email_verified ? <Link href={`#team/${rowData.id}`}>{rowData.name}</Link> : rowData.name},
                    editComponent: (props) => {
                      return (
                        <MTableEditField
                          autoFocus={true}
                          type="text"
                          maxLength="128"
                          placeholder="Name"
                          columnDef={props.columnDef}
                          value={props.value ? props.value : ''}
                          onChange={value => props.onChange(value) }
                          onKeyDown={evt => {
                              if (evt.key === 'Enter') {
                                createTeam({ name: evt.target.value });
                                props.onChange('');
                                return;
                              }
                            }
                          }
                        />
                      );
                    }
                  },
                  { title: messages['teams-table.leader'], field: 'leader', editable: 'never' }
                ]}
                data={profileData.user_metadata ? profileData.user_metadata.teams : []}
                options={{ search: false, paging: false }}
                editable={ (profileData.email === agent.email && profileData.email_verified) ? { onRowAdd: createTeam }: undefined}
                    //title: {messages['teams-table.header']},
                localization={{
                  header: {
                    name: messages['teams-table.name'],
                    leader: messages['teams-table.leader']
                  },
                  body: {
                    emptyDataSourceMessage: messages['teams-table.empty'],
                  }
                }}
              />
            </Grid>
            <Grid item>
              <Typography className={classes.header} variant="h5" component="h3">
                <FormattedMessage id='social-data.header' />
              </Typography>
            </Grid>
            <Grid item className={classes.json}>
              <ReactJson
                id='social-data'
                src={profileData}
                name={null}
                collapsed={true}
                collapseStringsAfterLength={80}
                displayDataTypes={false}
                displayObjectSize={false}
                shouldCollapse={(field) => field.name[0] === '_' }
              />
            </Grid>
          </>
        : ''}
      </Grid>
      { props.location.state ? <Flash message={props.location.state} variant="success" /> : '' }
      { flashProps.message ? <Flash message={flashProps.message} variant={flashProps.variant} onClose={() => setFlashProps({})} /> : '' }
      { flashProps.errors ? flashProps.errors.map((error, index) => <Flash message={error.message}
                                                                           variant={flashProps.variant}
                                                                           onClose={() => setFlashProps({})}
                                                                           key={`flash-${index}`} />) : '' }
    </div>
  )
};

export default Agent;

