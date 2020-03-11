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
import usePostOrganizationService from '../services/usePostOrganizationService';

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


function OrgCreateForm(props) {
  const classes = useStyles();
  let { publishOrganization } = usePostOrganizationService();

  // Define your state schema
  const stateSchema = {
    name: { value: '', error: '' },
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
  };

  function onSubmitForm(state) {
    publishOrganization(state).then((results) => {
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
    <form id="add-organization-form" onSubmit={handleOnSubmit}>
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
        placeholder="Enter new organization name"
        autoFocus
      />
      {errors.name && (
        <p className="error">{errors.name}</p>
      )}
      <Button id="add-organization-button" type="submit" variant="contained" color="primary" disabled={disable}>
        Add
      </Button>
    </form>

  );
}

export default OrgCreateForm;
