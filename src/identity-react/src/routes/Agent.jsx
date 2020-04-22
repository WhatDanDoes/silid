import React, { useState, useEffect } from 'react';
import { createStyles, makeStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
//import { useAuthState } from '../auth/Auth';
import { useAdminState } from '../auth/Admin';
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

/**
 * For profile data display
 */
import MaterialTable from 'material-table';

import useGetAgentService from '../services/useGetAgentService';

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

  const admin = useAdminState();

  const classes = useStyles();
  const service = useGetAgentService(props.match.params.id, admin.viewingCached);

  useEffect(() => {
    if (service.status === 'loaded') {
      setProfileData(service.payload);
    }
  }, [service]);

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
            Profile
          </Typography>
        </Grid>
        {service.status === 'loaded' && service.payload ?
          <>
            <Grid item className={classes.grid}>
              <TableContainer component={Paper}>
                <Table className={classes.table} aria-label="Agent profile info">
                  <TableBody>
                    <TableRow>
                      <TableCell align="right" component="th" scope="row">Display Name:</TableCell>
                      <TableCell align="left">{profileData.displayName}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell align="right" component="th" scope="row">Email:</TableCell>
                      <TableCell align="left">{profileData._json ? profileData._json.email : ''}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell align="right" component="th" scope="row">Locale:</TableCell>
                      <TableCell align="left">{profileData.locale}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
            <Grid item className={classes.grid}>
              <MaterialTable
                title='Teams'
                columns={[{ title: 'Name', field: 'name'}, { title: 'Leader', field: 'leader'}]}
                data={profileData.user_metadata ? profileData.user_metadata.teams : []}
                options={{ search: false }}
                editable={{
                  onRowAdd: (newData) => {

                  },
                  onRowUpdate: (newData, oldData) => {

                  },
                  onRowDelete: (oldData) => {

                  }
                }}
              />
            </Grid>
            <Grid item>
              <Typography className={classes.header} variant="h5" component="h3">
                Social Data
              </Typography>
            </Grid>
            <Grid item className={classes.json}>
              <ReactJson
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
    </div>
  )
};

export default Agent;

