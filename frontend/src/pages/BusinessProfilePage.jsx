import { useEffect, useMemo, useState } from 'react';
import InputField from '../components/ui/InputField.jsx';
import Button from '../components/ui/Button.jsx';
import { useFormErrors } from '../hooks/useFormErrors.js';
import { createBusiness, getBusinessById, updateBusiness } from '../services/businessApi.js';
import { formatApiError } from '../utils/formatError.js';
import { getTenant, setTenant } from '../utils/tenant.js';

const initialForm = {
  businessName: '',
  ownerName: '',
  gstin: '',
  pan: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  stateCode: '',
  pincode: '',
  country: 'India',
  phone: '',
  email: '',
  logoUrl: ''
};

export default function BusinessProfilePage() {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState('create');
  const { errors, setErrors, clearErrors } = useFormErrors();

  const tenant = useMemo(() => getTenant(), []);

  useEffect(() => {
    const businessId = tenant.businessId;
    if (!businessId) return;

    let active = true;
    setFetching(true);
    getBusinessById(businessId)
      .then((data) => {
        if (!active || !data) return;
        setForm((prev) => ({ ...prev, ...data }));
        setMode('update');
      })
      .catch(() => {
        if (!active) return;
        setMode('create');
      })
      .finally(() => {
        if (active) setFetching(false);
      });

    return () => {
      active = false;
    };
  }, [tenant.businessId]);

  function onFieldChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function validate() {
    const next = {};
    if (!form.businessName.trim()) next.businessName = 'Business Name is required.';
    if (!form.ownerName.trim()) next.ownerName = 'Owner Name is required.';
    if (!form.addressLine1.trim()) next.addressLine1 = 'Address Line 1 is required.';
    if (!form.city.trim()) next.city = 'City is required.';
    if (!form.state.trim()) next.state = 'State is required.';
    if (!/^\d{2}$/.test(form.stateCode.trim())) next.stateCode = 'State Code must be 2 digits.';
    if (!form.pincode.trim()) next.pincode = 'Pincode is required.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(event) {
    event.preventDefault();
    clearErrors();
    setMessage('');

    if (!validate()) return;

    setLoading(true);
    try {
      const payload = {
        ...form,
        businessName: form.businessName.trim(),
        ownerName: form.ownerName.trim(),
        gstin: form.gstin.trim().toUpperCase(),
        pan: form.pan.trim().toUpperCase(),
        stateCode: form.stateCode.trim(),
        pincode: form.pincode.trim()
      };

      let saved;
      if (mode === 'update' && tenant.businessId) {
        saved = await updateBusiness(tenant.businessId, payload);
        setMessage('Business profile updated successfully.');
      } else {
        saved = await createBusiness(payload);
        if (saved?.id) {
          const nextTenant = setTenant({ ...tenant, businessId: saved.id });
          setMode('update');
          setMessage(`Business created successfully. Business ID: ${nextTenant.businessId}`);
        }
      }

      if (saved) {
        setForm((prev) => ({ ...prev, ...saved }));
      }
    } catch (error) {
      setMessage(formatApiError(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="page card">
      <header className="page-header">
        <h2>Business Profile</h2>
        <p>Configure seller details used for GST invoices.</p>
      </header>

      {fetching ? <div className="status">Loading business profile...</div> : null}

      <form className="form-grid" onSubmit={onSubmit}>
        <InputField label="Business Name" name="businessName" required value={form.businessName} onChange={onFieldChange} error={errors.businessName} />
        <InputField label="Owner Name" name="ownerName" required value={form.ownerName} onChange={onFieldChange} error={errors.ownerName} />
        <InputField label="GSTIN" name="gstin" value={form.gstin} onChange={onFieldChange} />
        <InputField label="PAN" name="pan" value={form.pan} onChange={onFieldChange} />
        <InputField label="Address Line 1" name="addressLine1" required value={form.addressLine1} onChange={onFieldChange} error={errors.addressLine1} className="span-2" />
        <InputField label="Address Line 2" name="addressLine2" value={form.addressLine2} onChange={onFieldChange} className="span-2" />
        <InputField label="City" name="city" required value={form.city} onChange={onFieldChange} error={errors.city} />
        <InputField label="State" name="state" required value={form.state} onChange={onFieldChange} error={errors.state} />
        <InputField label="State Code" name="stateCode" required value={form.stateCode} onChange={onFieldChange} error={errors.stateCode} />
        <InputField label="Pincode" name="pincode" required value={form.pincode} onChange={onFieldChange} error={errors.pincode} />
        <InputField label="Country" name="country" value={form.country} onChange={onFieldChange} />
        <InputField label="Phone" name="phone" value={form.phone} onChange={onFieldChange} />
        <InputField label="Email" name="email" value={form.email} onChange={onFieldChange} />
        <InputField label="Logo URL" name="logoUrl" value={form.logoUrl} onChange={onFieldChange} />

        <div className="form-actions span-2">
          <Button type="submit" loading={loading}>{mode === 'update' ? 'Update Business' : 'Create Business'}</Button>
        </div>
      </form>

      {message ? <div className="status">{message}</div> : null}
    </section>
  );
}
