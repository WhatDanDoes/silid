import React, { useState, useEffect } from 'react';
import TextField from '@material-ui/core/TextField';
import { createStyles, makeStyles, Theme } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import { useAuthState } from '../auth/Auth';
import { useAdminState } from '../auth/Admin';

import Button from '@material-ui/core/Button';
import useGetAgentService from '../services/useGetAgentService';

import usePutAgentService from '../services/usePutAgentService';

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      padding: theme.spacing(3, 2),
    },
    button: {
      margin: theme.spacing(1),
    },
    container: {
      display: 'flex',
      flexWrap: 'wrap',
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
    media: {
      height: 140,
    },
    error: {
      color: 'rgba(232, 10, 10, 0.87)',
    },
    loaded: {
      color: 'rgba(19, 162, 64, 0.87)',
    },
  })
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
    <div className="agent">
      <Card className={classes.card}>
        <CardContent>
          <Typography variant="h5" component="h3">
            Profile
          </Typography>
          <Typography variant="body2" color="textSecondary" component="p">
            {service.status === 'loading' && <div>Loading...</div>}
            {service.status === 'loaded' && service.payload ?
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
                    variant="contained" color="secondary"
                    onClick={() => {
                      setFormData({ ...formData, ...prevState });
                      setPrevState({});
                    }}>
                      Cancel
                  </Button> : ''
                }
                { formData.email === agent.email || admin.isEnabled ?
                <Button type="submit" variant="contained" color="primary"
                        disabled={!Object.keys(prevState).length}>
                  Save
                </Button> : ''}
              </form> : ''}
            {service.status === 'error' && (
              <div>{service.error.message}</div>
            )}
          </Typography>
        </CardContent>
      </Card>
    </div>
  )    
};

export default Agent;
