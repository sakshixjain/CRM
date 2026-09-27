export type Lead = {
  id?: number;
  name: string;
  email: string;
  contact_no: string;
  address: string;
  state: string;
  city: string;
  pincode: string;
  country: string;
  source_id: number;
  description: string;
  is_active: boolean;
  createdAt?: string;
};