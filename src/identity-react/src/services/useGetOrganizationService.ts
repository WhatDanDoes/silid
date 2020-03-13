import { useEffect, useState } from 'react';
import { Service } from '../types/Service';
import { Organization } from '../types/Organization';
import { useAdminState } from '../auth/Admin';

export interface Organizations {
  results: Organization[];
}

const useOrganizationService = () => {
  const admin = useAdminState();

  const [result, setResult] = useState<Service<Organizations>>({
    status: 'loading'
  });

  useEffect(() => {
    const headers = new Headers();
    headers.append('Content-Type', 'application/json; charset=utf-8');

    let url = '/organization';
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

export default useOrganizationService;
