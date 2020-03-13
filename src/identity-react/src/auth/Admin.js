/**
 * 2020-1-24
 *
 * Shamelessly stolen from https://kentcdodds.com/blog/authentication-in-react-applications
 */
import React from 'react';
import { useAuthState } from './Auth';

export const AdminContext = React.createContext();

export function AdminProvider({children}) {

  const [state, setState] = React.useState({
    enabled: false,
//    error: null,
//    agent: null,
  });

//  React.useEffect(() => {
//    const headers = new Headers();
//    fetch('/agent', {method: 'GET', headers: headers}).then(response => {
//      return response.text();
//    }).then(profile => {
//      setState({status: 'success', error: null, agent: profile ? JSON.parse(profile) : {} });
//    }).catch(error => {
//      setState({status: 'error', error, agent: null});
//    });
//  }, []);
//
  function toggle() {
    setState({enabled: !state.enabled});// 'pending', err: null, agent: null});
//    window.location.href = '/logout';
  };

  return (
    <AdminContext.Provider value={{ ...state, toggleMode: toggle}}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdminState() {
  const state = React.useContext(AdminContext)
  const {agent} = useAuthState();

  const isEnabled = state.enabled && agent.isSuper;
//  const isPending = state.status === 'pending';
//  const isError = state.status === 'error';
//  const isSuccess = state.status === 'success';
//  const isAuthenticated = state.agent && isSuccess;
  return {
    ...state,
    isEnabled,
//    isPending,
//    isError,
//    isSuccess,
//    isAuthenticated,
  }
}

