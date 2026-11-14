// Shared between the browser and the server
export type Brand = {
  id: string; // data_id
  brandId: string;
  name: string;
  formId: string;
  form: string;
  strengthId: string;
  strength: string;
  genericId: string;
  generic: string;
  companyId: string;
  company: string;
  npsCode: string;
  isActive: boolean;
  isSystem: boolean; // is_sys_data = "Y"
  createdBy: number | null;
  createdAt: string;
  lastModified: string;
};

export type BrandView = "all" | "system" | "doctor" | "inactive";

export type BrandListResponse = {
  items: Brand[];
  total: number;
  page: number;
  pageSize: number;
  loadedAt: string;
};

export type Option = { id: string; name: string };

export type BrandOptions = {
  generics: Option[];
  companies: Option[];
  forms: Option[];
  strengths: Option[];
};
