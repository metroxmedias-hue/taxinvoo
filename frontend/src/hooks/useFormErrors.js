import { useState } from 'react';

export function useFormErrors(initial = {}) {
  const [errors, setErrors] = useState(initial);

  function setFieldError(field, message) {
    setErrors((prev) => ({ ...prev, [field]: message }));
  }

  function clearErrors() {
    setErrors({});
  }

  return { errors, setErrors, setFieldError, clearErrors };
}
