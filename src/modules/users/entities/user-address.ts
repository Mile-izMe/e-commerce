export interface UserAddress {
  id: string;
  userId: string;
  label: string | null;
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  ward: string | null;
  district: string | null;
  city: string;
  province: string | null;
  postalCode: string | null;
  countryCode: string;
}
