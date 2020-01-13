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

  const headers = new Headers({ 'Authorization': `Bearer ${localStorage.getItem('accessToken')}`}); 
  useEffect(() => {
    //fetch(`${process.env.REACT_APP_API_DOMAIN}agent`, { headers })
    fetch(`/organization`, { headers })
      .then(response => response.json())
      .then(response => setResult({ status: 'loaded', payload: { results: response } }))
      .catch(error => setResult({ status: 'error', error }));
  }, []);

  return result;
};

export default useOrganizationService;
