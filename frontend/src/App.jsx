import { Navigate, Route, Routes } from 'react-router-dom';
import DashboardLayout from './components/layout/DashboardLayout.jsx';
import BusinessProfilePage from './pages/BusinessProfilePage.jsx';
import AddCustomerPage from './pages/AddCustomerPage.jsx';
import CreateInvoicePage from './pages/CreateInvoicePage.jsx';

export default function App() {
  return (
    <DashboardLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/settings/business" replace />} />
        <Route path="/settings/business" element={<BusinessProfilePage />} />
        <Route path="/customers/add" element={<AddCustomerPage />} />
        <Route path="/invoices/create" element={<CreateInvoicePage />} />
      </Routes>
    </DashboardLayout>
  );
}
