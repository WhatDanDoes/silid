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

  const headers = new Headers();
  headers.append('Access-Control-Allow-Credentials', 'true');
  headers.append('Content-Type', 'application/json; charset=utf-8');

  useEffect(() => {
    fetch(`/organization`, { headers })
      .then(response => response.json())
      .then(response => setResult({ status: 'loaded', payload: { results: response } }))
      .catch(error => setResult({ status: 'error', error }));
  }, []);

  return result;
};

export default useOrganizationService;
