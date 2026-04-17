import { NavLink } from 'react-router-dom';
import TenantBar from './TenantBar.jsx';

export default function DashboardLayout({ children }) {
  return (
    <div className="app-shell">
      <aside className="sidebar card">
        <div className="brand-block">
          <h1>Metrox TaxInvoo</h1>
          <p>GST-ready billing SaaS</p>
        </div>
        <nav className="menu">
          <NavLink to="/settings/business">Business Profile</NavLink>
          <NavLink to="/customers/add">Add Customer</NavLink>
          <NavLink to="/invoices/create">Create Invoice</NavLink>
        </nav>
      </aside>
      <main className="content-shell">
        <TenantBar />
        {children}
      </main>
    </div>
  );
}
