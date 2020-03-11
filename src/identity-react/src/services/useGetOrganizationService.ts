import { useEffect, useState } from 'react';
import { Service } from '../types/Service';
import { Organization } from '../types/Organization';

export interface Organizations {
  results: Organization[];
}

const useOrganizationService = () => {
  const [result, setResult] = useState<Service<Organizations>>({
    status: 'loading'
  });

  useEffect(() => {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json; charset=utf-8');

    fetch(`/organization`, { headers, credentials: 'include', mode: 'no-cors' })
      .then(response => response.json())
      .then(response => setResult({ status: 'loaded', payload: { results: response } }))
      .catch(error => setResult({ status: 'error', error }));
  }, []);

  return result;
};

export default useOrganizationService;
