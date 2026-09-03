// Design Ref: screen-spec §4.1 (SUP-09).
import { requireSupplierSession } from '@/lib/supplier/session'
import { BasicInfoForm } from './BasicInfoForm'

export default async function SupplierBasicInfoPage() {
  const { partner } = await requireSupplierSession()
  return <BasicInfoForm partner={partner} />
}
