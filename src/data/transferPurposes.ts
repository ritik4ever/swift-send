export interface TransferPurpose {
  code: string;
  label: string;
  description: string;
  category: 'personal' | 'business' | 'education' | 'health' | 'charity' | 'investment' | 'other';
}

export const TRANSFER_PURPOSES: TransferPurpose[] = [
  {
    code: 'family_support',
    label: 'Family Support',
    description: 'Send money to family members for daily needs',
    category: 'personal',
  },
  {
    code: 'remittance',
    label: 'Remittance',
    description: 'Cross-border money transfer to home country',
    category: 'personal',
  },
  {
    code: 'gift',
    label: 'Gift',
    description: 'Send a monetary gift to someone',
    category: 'personal',
  },
  {
    code: 'payment',
    label: 'Payment',
    description: 'Payment for goods or services received',
    category: 'business',
  },
  {
    code: 'salary',
    label: 'Salary',
    description: 'Salary or wage payment',
    category: 'business',
  },
  {
    code: 'invoice',
    label: 'Invoice',
    description: 'Invoice settlement',
    category: 'business',
  },
  {
    code: 'tuition',
    label: 'Tuition',
    description: 'Education fees or tuition payment',
    category: 'education',
  },
  {
    code: 'medical',
    label: 'Medical',
    description: 'Medical expenses or health insurance',
    category: 'health',
  },
  {
    code: 'charity',
    label: 'Charity',
    description: 'Donation or charitable contribution',
    category: 'charity',
  },
  {
    code: 'savings',
    label: 'Savings',
    description: 'Personal savings or investment',
    category: 'investment',
  },
  {
    code: 'emergency',
    label: 'Emergency',
    description: 'Emergency financial assistance',
    category: 'personal',
  },
  {
    code: 'other',
    label: 'Other',
    description: 'Other purposes not listed',
    category: 'other',
  },
];

export function getPurposeByCode(code: string): TransferPurpose | undefined {
  return TRANSFER_PURPOSES.find((p) => p.code === code);
}

export function getPurposesByCategory(category: TransferPurpose['category']): TransferPurpose[] {
  return TRANSFER_PURPOSES.filter((p) => p.category === category);
}
