import { useMemo, useState } from 'react';
import InputField from '../components/ui/InputField.jsx';
import CheckboxField from '../components/ui/CheckboxField.jsx';
import Button from '../components/ui/Button.jsx';
import { createCustomer, cacheCustomer } from '../services/customerApi.js';
import { extractStateCodeFromGSTIN } from '../utils/gstin.js';
import { formatApiError } from '../utils/formatError.js';
import { getTenant } from '../utils/tenant.js';

const initialForm = {
  customerName: '',
  phone: '',
  gstin: '',
  billingAddressLine1: '',
  billingAddressLine2: '',
  city: '',
  state: '',
  stateCode: '',
  pincode: '',
  placeOfSupply: '',
  shippingSameAsBilling: true,
  shippingAddress: {
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    stateCode: '',
    pincode: '',
    placeOfSupply: ''
  }
};

export default function AddCustomerPage() {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const tenant = useMemo(() => getTenant(), []);

  function validate() {
    if (!tenant.businessId || !tenant.userId) {
      setMessage('Please set Business ID and User ID in Tenant Context.');
      return false;
    }
    if (!form.customerName.trim()) {
      setMessage('Customer Name is required.');
      return false;
    }
    if (!form.billingAddressLine1.trim() || !form.city.trim() || !form.state.trim() || !form.pincode.trim()) {
      setMessage('Billing address, city, state and pincode are required.');
      return false;
    }
    if (!form.stateCode.trim() || !/^\d{2}$/.test(form.stateCode.trim())) {
      setMessage('State Code must be a valid 2-digit code.');
      return false;
    }
    return true;
  }

  function onFieldChange(event) {
    const { name, value } = event.target;

    if (name === 'gstin') {
      const stateCode = extractStateCodeFromGSTIN(value);
      setForm((prev) => ({
        ...prev,
        gstin: value,
        stateCode: stateCode || prev.stateCode,
        placeOfSupply: stateCode || prev.placeOfSupply
      }));
      return;
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function onShippingFieldChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      shippingAddress: {
        ...prev.shippingAddress,
        [name]: value
      }
    }));
  }

  async function onSubmit(event) {
    event.preventDefault();
    setMessage('');
    if (!validate()) return;

    setLoading(true);
    try {
      const payload = {
        ...form,
        gstin: form.gstin.trim().toUpperCase(),
        customerName: form.customerName.trim(),
        shippingSameAsBilling: Boolean(form.shippingSameAsBilling),
        shippingAddress: form.shippingSameAsBilling
          ? {
              addressLine1: form.billingAddressLine1,
              addressLine2: form.billingAddressLine2,
              city: form.city,
              state: form.state,
              stateCode: form.stateCode,
              pincode: form.pincode,
              placeOfSupply: form.placeOfSupply
            }
          : form.shippingAddress
      };

      const customer = await createCustomer(payload);
      if (customer?.id && tenant.businessId) {
        cacheCustomer(tenant.businessId, customer);
      }
      setMessage(`Customer created successfully. Customer ID: ${customer?.id || '-'}`);
      setForm(initialForm);
    } catch (error) {
      setMessage(formatApiError(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="page card">
      <header className="page-header">
        <h2>Add Customer</h2>
        <p>Create buyer master details for invoices.</p>
      </header>

      <form className="form-grid" onSubmit={onSubmit}>
        <InputField label="Customer Name" name="customerName" required value={form.customerName} onChange={onFieldChange} />
        <InputField label="Phone" name="phone" value={form.phone} onChange={onFieldChange} />
        <InputField label="GSTIN" name="gstin" value={form.gstin} onChange={onFieldChange} />
        <InputField label="State Code" name="stateCode" value={form.stateCode} onChange={onFieldChange} />
        <InputField label="Billing Address" name="billingAddressLine1" required value={form.billingAddressLine1} onChange={onFieldChange} className="span-2" />
        <InputField label="Billing Address Line 2" name="billingAddressLine2" value={form.billingAddressLine2} onChange={onFieldChange} className="span-2" />
        <InputField label="City" name="city" required value={form.city} onChange={onFieldChange} />
        <InputField label="State" name="state" required value={form.state} onChange={onFieldChange} />
        <InputField label="Pincode" name="pincode" required value={form.pincode} onChange={onFieldChange} />
        <InputField label="Place Of Supply" name="placeOfSupply" required value={form.placeOfSupply} onChange={onFieldChange} />

        <div className="span-2">
          <CheckboxField
            label="Shipping address same as billing"
            checked={form.shippingSameAsBilling}
            onChange={(event) => {
              const checked = event.target.checked;
              setForm((prev) => ({ ...prev, shippingSameAsBilling: checked }));
            }}
          />
        </div>

        {!form.shippingSameAsBilling ? (
          <>
            <InputField label="Shipping Address" name="addressLine1" value={form.shippingAddress.addressLine1} onChange={onShippingFieldChange} className="span-2" />
            <InputField label="Shipping City" name="city" value={form.shippingAddress.city} onChange={onShippingFieldChange} />
            <InputField label="Shipping State" name="state" value={form.shippingAddress.state} onChange={onShippingFieldChange} />
            <InputField label="Shipping State Code" name="stateCode" value={form.shippingAddress.stateCode} onChange={onShippingFieldChange} />
            <InputField label="Shipping Pincode" name="pincode" value={form.shippingAddress.pincode} onChange={onShippingFieldChange} />
          </>
        ) : null}

        <div className="form-actions span-2">
          <Button type="submit" loading={loading}>Create Customer</Button>
        </div>
      </form>

      {message ? <div className="status">{message}</div> : null}
    </section>
  );
}
