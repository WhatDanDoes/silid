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
    viewCache: false,
  });

  function toggle() {
    setState({...state, enabled: !state.enabled});
  };

  function toggleCache() {
    setState({...state, viewCache: !state.viewCache});
  };


  return (
    <AdminContext.Provider value={{ ...state, toggleMode: toggle, toggleCacheMode: toggleCache}}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdminState() {
  const state = React.useContext(AdminContext)
  const {agent} = useAuthState();

  const isEnabled = state.enabled && agent.isSuper;
  const viewingCached = state.viewCache && isEnabled;

  return {
    ...state,
    isEnabled,
    viewingCached,
  }
}

