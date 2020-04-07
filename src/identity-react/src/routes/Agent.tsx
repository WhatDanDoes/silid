import React, { useState, useEffect } from 'react';
import TextField from '@material-ui/core/TextField';
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import { useAuthState } from '../auth/Auth';
import { useAdminState } from '../auth/Admin';
import ReactJson from 'react-json-view';
import Button from '@material-ui/core/Button';
import Flash from '../components/Flash';


import Grid from '@material-ui/core/Grid';

import useGetAgentService from '../services/useGetAgentService';
import usePutAgentService from '../services/usePutAgentService';

const useStyles = makeStyles((theme: Theme) =>
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
  } as any)
);

export interface FormData {
  [key:string]: any,
  name?: string,
  email?: string,
  id?: number
}

export interface PrevState {
  [key:string]: any
}

const Agent = (props: any) => {

  const [formData, setFormData] = useState<FormData>({});
  const [prevState, setPrevState] = useState<PrevState>({});
  const {agent} = useAuthState();
  const admin = useAdminState();

  const classes = useStyles();
  const service = useGetAgentService(props.match.params.id);

  let { publishAgent } = usePutAgentService();

  useEffect(() => {
    if (service.status === 'loaded') {
      setFormData(service.payload);
    }
  }, [service]);

  const handleSubmit = (evt:React.FormEvent<EventTarget>) => {
    evt.preventDefault();
    publishAgent(formData).then(results => {
      setPrevState({});
    }).catch(err => {
      console.log(err);
    });
  }

  const onChange = (evt:React.ChangeEvent<HTMLInputElement>) => {
    if (!prevState[evt.target.name]) {
      const s = { ...prevState};
      s[evt.target.name] = formData[evt.target.name];
      setPrevState(s);
    }
    const f = { ...formData };
    f[evt.target.name] = evt.target.value;
    setFormData(f);
  }

  const customMessage = (evt:React.ChangeEvent<HTMLInputElement>) => {
    evt.target.setCustomValidity(`${evt.target.name} required`);
  }

  return (
    <div className={classes.root}>
      <Grid container direction="column" justify="center" alignItems="center">
        <Grid item>
          <Typography variant="body2" color="textSecondary" component="p">
            {service.status === 'loading' && <div>Loading...</div>}
          </Typography>
        </Grid> <Grid item> <Typography className={classes.header} variant="h5" component="h3">
            Profile
          </Typography>
        </Grid>
        {service.status === 'loaded' && service.payload ?
          <>
            <Grid item className={classes.grid}>
              <form onSubmit={handleSubmit}>
                <TextField
                  id="email-input"
                  label="Email"
                  type="email"
                  className={classes.textField}
                  InputLabelProps={{
                    shrink: true,
                  }}
                  margin="normal"
                  name="email"
                  disabled
                  value={formData.email}
                />
                <br></br>
                <TextField
                  id="name-input"
                  label="Name"
                  type="text"
                  className={classes.textField}
                  InputLabelProps={{
                    shrink: true,
                  }}
                  margin="normal"
                  name="name"
                  required
                  disabled={formData.email !== agent.email && !admin.isEnabled}
                  value={formData.name}
                  onChange={onChange}
                  onInvalid={customMessage}
                />
                { Object.keys(prevState).length ?
                  <Button id="cancel-changes"
                    className={classes.button}
                    variant="contained" color="secondary"
                    onClick={() => {
                      setFormData({ ...formData, ...prevState });
                      setPrevState({});
                    }}>
                      Cancel
                  </Button> : ''
                }
                { formData.email === agent.email || admin.isEnabled ?
                <Button className={classes.button}
                        type="submit" variant="contained" color="primary"
                        disabled={!Object.keys(prevState).length}>
                  Save
                </Button> : ''}
              </form>
            </Grid>
            <Grid item>
              <Typography className={classes.header} variant="h5" component="h3">
                Social Data
              </Typography>
            </Grid>
            <Grid item className={classes.json}>
              <ReactJson
                src={formData}
                collapsed={false}
                collapseStringsAfterLength={80}
                displayDataTypes={false}
                displayObjectSize={false}
                shouldCollapse={(field: any) => field.name[0] === '_' }
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
