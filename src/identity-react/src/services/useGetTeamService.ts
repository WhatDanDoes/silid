import { useEffect, useState } from 'react';
import { Service } from '../types/Service';
import { Team } from '../types/Team';
import { useAdminState } from '../auth/Admin';

export interface Teams {
  results: Team[];
}

const useTeamService = () => {
  const admin = useAdminState();

  const [result, setResult] = useState<Service<Teams>>({
    status: 'loading'
  });

  useEffect(() => {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json; charset=utf-8');

    let url = '/team';
    if (admin.isEnabled) {
      url += '/admin';
    }

    fetch(url, { headers, credentials: 'include', mode: 'no-cors' })
      .then(response => response.json())
      .then(response => setResult({ status: 'loaded', payload: { results: response } }))
      .catch(error => setResult({ status: 'error', error }));
  }, [admin.isEnabled]);

  return result;
};

export default useTeamService;
