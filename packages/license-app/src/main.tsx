import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LicenseGenerator } from './ui/LicenseGenerator';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LicenseGenerator />
  </StrictMode>,
);
