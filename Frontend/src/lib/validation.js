export function patientDetailsError(form) {
  if (!String(form.patientName || '').trim() || !String(form.mobile || '').trim()) {
    return 'Enter the patient name and mobile number.'
  }
  if (!isValidPhone(form.mobile)) return 'Enter a valid mobile number, including the country code if needed.'
  if (form.age !== '' && form.age !== undefined) {
    const age = Number(form.age)
    if (!Number.isInteger(age) || age < 0 || age > 120) return 'Enter an age between 0 and 120 in whole years.'
  }
  return ''
}

export function isValidPhone(value) {
  const phone = String(value || '').trim()
  return /^\+?[\d\s().-]+$/.test(phone) && /^\d{7,15}$/.test(phone.replace(/\D/g, ''))
}
