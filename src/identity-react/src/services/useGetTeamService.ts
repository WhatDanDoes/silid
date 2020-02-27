import { useEffect, useState } from 'react';
import { Service } from '../types/Service';
import { Team } from '../types/Team';

export interface Teams {
  results: Team[];
}

const useTeamService = () => {
  const [result, setResult] = useState<Service<Teams>>({
    status: 'loading'
  });

  useEffect(() => {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json; charset=utf-8');

    fetch(`/team`, { headers, credentials: 'include', mode: 'no-cors' })
      .then(response => response.json())
      .then(response => setResult({ status: 'loaded', payload: { results: response } }))
      .catch(error => setResult({ status: 'error', error }));
  }, []);

  return result;
};

export default useTeamService;
