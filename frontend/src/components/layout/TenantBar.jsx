import { useState } from 'react';
import { getTenant, setTenant } from '../../utils/tenant.js';
import Button from '../ui/Button.jsx';

export default function TenantBar() {
  const [tenant, setTenantState] = useState(getTenant());

  function handleChange(event) {
    const { name, value } = event.target;
    setTenantState((prev) => ({ ...prev, [name]: value }));
  }

  function saveTenant() {
    const next = setTenant(tenant);
    setTenantState(next);
  }

  return (
    <div className="tenant-bar card">
      <div className="tenant-fields">
        <label>
          <span>Business ID</span>
          <input
            type="text"
            name="businessId"
            value={tenant.businessId}
            onChange={handleChange}
            placeholder="biz_123"
          />
        </label>
        <label>
          <span>User ID</span>
          <input
            type="text"
            name="userId"
            value={tenant.userId}
            onChange={handleChange}
            placeholder="uid_abc"
          />
        </label>
      </div>
      <Button type="button" onClick={saveTenant}>Save Tenant Context</Button>
    </div>
  );
}
