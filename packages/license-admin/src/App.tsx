import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LicenseGenerator } from './pages/LicenseGenerator';

const client = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

export const App = () => (
  <QueryClientProvider client={client}>
    <LicenseGenerator />
  </QueryClientProvider>
);
