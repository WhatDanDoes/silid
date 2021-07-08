import { useState } from 'react';

const usePostOrganizationService = () => {
  const [service, setService] = useState({
    status: 'init',
  });

  const publishOrganization = (organization: PostOrganization) => {
    setService({ status: 'loading' });

    const headers = new Headers();
    headers.append('Content-Type', 'application/json; charset=utf-8');

    return new Promise((resolve, reject) => {
      fetch('/organization',
        {
          method: 'POST',
          body: JSON.stringify(organization),
          headers,
        }
      )
        .then(response => response.json())
        .then(response => {
          setService({ status: 'loaded', payload: response });
          resolve(response);
        })
        .catch(error => {
          setService({ status: 'error', error });
          reject(error);
        });
    });
  };

  return {
    service,
    publishOrganization,
  };
};

export default usePostOrganizationService;
