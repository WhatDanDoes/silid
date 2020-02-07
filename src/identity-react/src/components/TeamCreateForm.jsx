/**
 * 2020-1-9
 *
 * Stolen from here (cf., `./hooks/useForm.js`:
 *
 * https://github.com/llauderesv/react-form-validation
 */
import React from 'react';
import useForm from './hooks/useForm';
import { createStyles, makeStyles } from '@material-ui/core/styles';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import usePostTeamService from '../services/usePostTeamService';

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
    card: {
      marginLeft: '25%',
      marginTop: '4%',
      maxWidth: 720,
    },
  }),
);


function TeamCreateForm(props) {
  const classes = useStyles();
  let { publishTeam } = usePostTeamService();

  // Define your state schema
  const stateSchema = {
    name: { value: '', error: '' },
    organizationId: { value: props.orgId, error: '' },
  };

  // Create your own validationStateSchema
  // stateSchema property should be the same in validationStateSchema
  // in-order a validation to works in your input.
  const stateValidatorSchema = {
    name: {
      required: true,
      validator: {
        func: value => !/^\s*$/.test(value),
        error: 'name can\'t be blank',
      },
    },
    organizationId: {
      required: true
    },
  };

  function onSubmitForm(state) {
    publishTeam(state).then((results) => {
      props.done(results);
    }).catch(err => {
      console.log(err);
    });
  }

  const { values, errors, handleOnChange, handleOnSubmit, disable } = useForm(
    stateSchema,
    stateValidatorSchema,
    onSubmitForm
  );

  const { name } = values;
    
  return (
    <form id="add-team-form" onSubmit={handleOnSubmit}>
      <input type="hidden" name="organizationId" value={props.orgId} />
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
        value={name}
        onChange={handleOnChange}
        required
        placeholder="Enter new team name"
        autoFocus
      />
      {errors.name && (
        <p className="error">{errors.name}</p>
      )}
      <Button id="add-team-button" type="submit" variant="contained" color="primary" disabled={disable}>
        Add
      </Button>
    </form>
  );
}

export default TeamCreateForm;
