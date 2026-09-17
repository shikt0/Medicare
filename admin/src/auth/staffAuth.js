import { createContext, useContext } from 'react'

export const StaffAuthContext = createContext(null)

export function useStaffAuth() {
  const value = useContext(StaffAuthContext)
  if (!value) throw new Error('useStaffAuth must be used inside StaffAuthProvider')
  return value
}
