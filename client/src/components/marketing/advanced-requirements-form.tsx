import React, { useState, useMemo, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus,
  X,
  Save,
  FileText,
  Building,
  Users,
  AlertCircle,
  CheckCircle,
  Copy,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { RequirementStatus } from '@shared/schema';

// Form validation schema
const requirementSchema = yup.object({
  jobTitle: yup
    .string()
    .required('Job title is required')
    .min(3, 'Job title must be at least 3 characters')
    .max(100, 'Job title must not exceed 100 characters'),

  status: yup
    .string()
    .required('Status is required')
    .oneOf(Object.values(RequirementStatus), 'Invalid status'),

  consultantId: yup.string().nullable(),

  appliedFor: yup
    .string()
    .required('Applied for field is required')
    .min(2, 'Applied for must be at least 2 characters'),

  rate: yup
    .string()
    .matches(/^[\d$,.\s-]+$/, 'Rate must be a valid format (e.g., $100/hr, $80k-90k)')
    .nullable(),

  primaryTechStack: yup
    .string()
    .required('Primary tech stack is required')
    .min(2, 'Tech stack must be at least 2 characters'),

  clientCompany: yup
    .string()
    .required('Client company is required')
    .min(2, 'Company name must be at least 2 characters'),

  impName: yup.string().nullable(),

  clientWebsite: yup.string().url('Client website must be a valid URL').nullable(),

  impWebsite: yup.string().url('IMP website must be a valid URL').nullable(),

  vendorCompany: yup.string().nullable(),

  vendorWebsite: yup.string().url('Vendor website must be a valid URL').nullable(),

  vendorPersonName: yup.string().nullable(),

  vendorPhone: yup
    .string()
    .matches(/^[\+]?[1-9][\d]{0,15}(\s*(ext|x|extension)\.?\s*\d{1,6})?$/i, 'Phone number must be valid (e.g., +1234567890 ext. 123)')
    .nullable(),

  vendorEmail: yup.string().email('Vendor email must be valid').nullable(),

  completeJobDescription: yup
    .string()
    .required('Job description is required')
    .min(50, 'Job description must be at least 50 characters'),

  nextStep: yup.string().nullable(),

  remote: yup.string().nullable(),

  duration: yup.string().nullable(),
});

type RequirementFormData = yup.InferType<typeof requirementSchema>;

interface AdvancedRequirementsFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (requirements: RequirementFormData[]) => Promise<void>;
  consultants?: Array<{id: string; name: string; email: string; status: string}>;
  initialData?: Partial<RequirementFormData>;
  editMode?: boolean;
  isSubmitting?: boolean;
}

// FieldWrapper component moved outside to prevent re-creation on every render
const FieldWrapper = ({
  children,
  error,
  status = 'default',
}: {
  children: React.ReactNode;
  error?: string;
  status?: 'default' | 'success' | 'error';
}) => (
  <div className="relative">
    {children}
    {status === 'success' && (
      <CheckCircle className="absolute right-3 top-3 h-4 w-4 text-green-500" />
    )}
    {status === 'error' && (
      <AlertCircle className="absolute right-3 top-3 h-4 w-4 text-red-500" />
    )}
    {error && (
      <p className="text-sm text-red-500 mt-1 flex items-center">
        <AlertCircle className="h-3 w-3 mr-1" />
        {error}
      </p>
    )}
  </div>
);

export default function AdvancedRequirementsForm({
  open,
  onClose,
  onSubmit,
  consultants = [],
  initialData,
  editMode = false,
  isSubmitting = false,
}: AdvancedRequirementsFormProps) {
  const [activeTab, setActiveTab] = useState('requirement');
  const [showPreview, setShowPreview] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isValid, isDirty },
    watch,
    setValue,
    reset,
    trigger,
  } = useForm<RequirementFormData>({
    resolver: yupResolver(requirementSchema),
    defaultValues: {
      status: RequirementStatus.NEW,
      appliedFor: 'Rahul',
      ...initialData,
    },
    mode: 'onBlur',
  });
  // Removed useFieldArray as multipleRequirements is not part of the schema


  // Note: Removed watch() calls to prevent re-renders on every keystroke that cause focus loss

  // Auto-generate applied for options
  const appliedForOptions = ['Rahul', 'Sarah Johnson', 'Mike Chen', 'Lisa Rodriguez'];

  const getFieldError = (fieldName: keyof RequirementFormData) => {
    return errors[fieldName]?.message;
  };

  const getFieldStatus = (fieldName: keyof RequirementFormData) => {
    if (errors[fieldName]) return 'error';
    return 'default';
  };

  const handleFormSubmit = async (data: RequirementFormData) => {
    try {
      await onSubmit([data]);
      // Don't reset here - let the parent component handle dialog closing
    } catch (error: any) {
      // Error handling is done in the parent component
      console.error('Form submission error:', error);
    }
  };

  const handleValidateSection = async (section: string) => {
    const fieldsMap = {
      requirement: ['jobTitle', 'status', 'consultantId', 'appliedFor', 'primaryTechStack'],
      client: ['clientCompany', 'impName', 'clientWebsite', 'impWebsite'],
      vendor: ['vendorCompany', 'vendorWebsite', 'vendorPersonName', 'vendorPhone', 'vendorEmail'],
      job: ['completeJobDescription', 'nextStep', 'remote', 'duration'],
    };

    const fields = fieldsMap[section as keyof typeof fieldsMap] || [];
    await trigger(fields as any);

    const hasErrors = fields.some((field) => errors[field as keyof RequirementFormData]);
    return !hasErrors;
  };

  const copyTemplate = () => {
    const formValues = watch();
    setValue(
      'completeJobDescription',
      `
Job Title: ${formValues.jobTitle || '[Job Title]'}
Company: ${formValues.clientCompany || '[Company Name]'}
Tech Stack: ${formValues.primaryTechStack || '[Tech Stack]'}

Job Requirements:
• [Requirement 1]
• [Requirement 2]
• [Requirement 3]

Responsibilities:
• [Responsibility 1]
• [Responsibility 2]
• [Responsibility 3]

Qualifications:
• [Qualification 1]
• [Qualification 2]
• [Qualification 3]

Additional Information:
• Rate: ${formValues.rate || '[Rate]'}
• Duration: ${formValues.duration || '[Duration]'}
• Remote: ${formValues.remote || '[Remote Policy]'}
    `.trim()
    );
    toast.success('Template copied to job description');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center space-x-2">
                <FileText size={20} />
                <span>{editMode ? 'Edit Requirement' : 'Create New Requirement'}</span>
              </DialogTitle>
              <DialogDescription>
                Fill out the form sections to create a comprehensive job requirement
              </DialogDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant={isValid ? 'default' : 'secondary'}>
                {isValid ? 'Valid' : 'Incomplete'}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="flex-1 overflow-y-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="requirement" className="flex items-center space-x-2">
                <Users size={16} />
                <span>Requirement</span>
                {errors.jobTitle || errors.status || errors.primaryTechStack ? (
                  <AlertCircle size={12} className="text-red-500" />
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="client" className="flex items-center space-x-2">
                <Building size={16} />
                <span>Client & IMP</span>
                {errors.clientCompany ? (
                  <AlertCircle size={12} className="text-red-500" />
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="vendor" className="flex items-center space-x-2">
                <Building size={16} />
                <span>Vendor Info</span>
                {errors.vendorEmail || errors.vendorPhone || errors.vendorWebsite ? (
                  <AlertCircle size={12} className="text-red-500" />
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="job" className="flex items-center space-x-2">
                <FileText size={16} />
                <span>Job Details</span>
                {errors.completeJobDescription ? (
                  <AlertCircle size={12} className="text-red-500" />
                ) : null}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="requirement" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Requirement & Communication</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="jobTitle">Job Title *</Label>
                      <FieldWrapper
                        error={getFieldError('jobTitle')}
                        status={getFieldStatus('jobTitle')}
                      >
                        <Controller
                          name="jobTitle"
                          control={control}
                          render={({ field }) => (
                            <Input
                              {...field}
                              placeholder="e.g., Senior React Developer"
                              className={errors.jobTitle ? 'border-red-500' : ''}
                            />
                          )}
                        />
                      </FieldWrapper>
                    </div>

                    <div>
                      <Label htmlFor="status">Status *</Label>
                      <FieldWrapper error={getFieldError('status')}>
                        <Controller
                          name="status"
                          control={control}
                          render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(RequirementStatus).map(([key, value]) => (
                                  <SelectItem key={key} value={value}>
                                    {value}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </FieldWrapper>
                    </div>

                    <div>
                      <Label htmlFor="consultantId">Assigned Consultant</Label>
                      <FieldWrapper error={getFieldError('consultantId' as keyof RequirementFormData)}>
                        <Controller
                          name={"consultantId" as const}
                          control={control}
                          render={({ field }) => (
                            <Select 
                              onValueChange={(value) => field.onChange(value === 'unassigned' ? null : value)} 
                              value={field.value ?? 'unassigned'}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select consultant" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unassigned">No consultant assigned</SelectItem>
                                {consultants.filter(c => c.status === 'Active').map((consultant) => (
                                  <SelectItem key={consultant.id} value={consultant.id}>
                                    {consultant.name} ({consultant.email})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </FieldWrapper>
                    </div>

                    <div>
                      <Label htmlFor="appliedFor">Applied For *</Label>
                      <FieldWrapper error={getFieldError('appliedFor')}>
                        <Controller
                          name="appliedFor"
                          control={control}
                          render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {appliedForOptions.map((option) => (
                                  <SelectItem key={option} value={option}>
                                    {option}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </FieldWrapper>
                    </div>

                    <div>
                      <Label htmlFor="rate">Rate</Label>
                      <FieldWrapper error={getFieldError('rate')} status={getFieldStatus('rate')}>
                        <Controller
                          name="rate"
                          control={control}
                          render={({ field }) => (
                            <Input
                              {...field}
                              value={field.value || ''}
                              placeholder="e.g., $100/hr, $80k-90k"
                            />
                          )}
                        />
                      </FieldWrapper>
                    </div>

                    <div>
                      <Label htmlFor="primaryTechStack">Primary Tech Stack *</Label>
                      <FieldWrapper
                        error={getFieldError('primaryTechStack')}
                        status={getFieldStatus('primaryTechStack')}
                      >
                        <Controller
                          name="primaryTechStack"
                          control={control}
                          render={({ field }) => (
                            <Input
                              {...field}
                              placeholder="e.g., React, TypeScript, Node.js"
                              className={errors.primaryTechStack ? 'border-red-500' : ''}
                            />
                          )}
                        />
                      </FieldWrapper>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="remote">Remote Policy</Label>
                      <Controller
                        name="remote"
                        control={control}
                        render={({ field }) => (
                          <Input
                            {...field}
                            value={field.value || ''}
                            placeholder="e.g., Remote, Hybrid, On-site"
                          />
                        )}
                      />
                    </div>

                    <div>
                      <Label htmlFor="duration">Duration</Label>
                      <Controller
                        name="duration"
                        control={control}
                        render={({ field }) => (
                          <Input
                            {...field}
                            value={field.value || ''}
                            placeholder="e.g., 6 months, Permanent"
                          />
                        )}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="nextStep">Next Step</Label>
                    <Controller
                      name="nextStep"
                      control={control}
                      render={({ field }) => (
                        <Textarea
                          {...field}
                          value={field.value ?? ''}
                          placeholder="Describe the next steps for this requirement..."
                          rows={3}
                        />
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="client" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Client & IMP Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="clientCompany">Client Company *</Label>
                      <FieldWrapper
                        error={getFieldError('clientCompany')}
                        status={getFieldStatus('clientCompany')}
                      >
                        <Controller
                          name="clientCompany"
                          control={control}
                          render={({ field }) => (
                            <Input
                              {...field}
                              placeholder="Company Name"
                              className={errors.clientCompany ? 'border-red-500' : ''}
                            />
                          )}
                        />
                      </FieldWrapper>
                    </div>

                    <div>
                      <Label htmlFor="impName">IMP Name</Label>
                      <Controller
                        name="impName"
                        control={control}
                        render={({ field }) => (
                          <Input
                            {...field}
                            value={field.value || ''}
                            placeholder="Implementation Partner Name"
                          />
                        )}
                      />
                    </div>

                    <div>
                      <Label htmlFor="clientWebsite">Client Website</Label>
                      <FieldWrapper
                        error={getFieldError('clientWebsite')}
                        status={getFieldStatus('clientWebsite')}
                      >
                        <Controller
                          name="clientWebsite"
                          control={control}
                          render={({ field }) => (
                            <Input
                              {...field}
                              value={field.value || ''}
                              placeholder="https://client-company.com"
                            />
                          )}
                        />
                      </FieldWrapper>
                    </div>

                    <div>
                      <Label htmlFor="impWebsite">IMP Website</Label>
                      <FieldWrapper
                        error={getFieldError('impWebsite')}
                        status={getFieldStatus('impWebsite')}
                      >
                        <Controller
                          name="impWebsite"
                          control={control}
                          render={({ field }) => (
                            <Input
                              {...field}
                              value={field.value || ''}
                              placeholder="https://imp-company.com"
                            />
                          )}
                        />
                      </FieldWrapper>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="vendor" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Vendor Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="vendorCompany">Vendor Company</Label>
                      <Controller
                        name="vendorCompany"
                        control={control}
                        render={({ field }) => (
                          <Input
                            {...field}
                            value={field.value || ''}
                            placeholder="Vendor Company Name"
                          />
                        )}
                      />
                    </div>

                    <div>
                      <Label htmlFor="vendorWebsite">Vendor Website</Label>
                      <FieldWrapper
                        error={getFieldError('vendorWebsite')}
                        status={getFieldStatus('vendorWebsite')}
                      >
                        <Controller
                          name="vendorWebsite"
                          control={control}
                          render={({ field }) => (
                            <Input
                              {...field}
                              value={field.value || ''}
                              placeholder="https://vendor-company.com"
                            />
                          )}
                        />
                      </FieldWrapper>
                    </div>

                    <div>
                      <Label htmlFor="vendorPersonName">Vendor Contact Person</Label>
                      <Controller
                        name="vendorPersonName"
                        control={control}
                        render={({ field }) => (
                          <Input
                            {...field}
                            value={field.value || ''}
                            placeholder="Contact Person Name"
                          />
                        )}
                      />
                    </div>

                    <div>
                      <Label htmlFor="vendorPhone">Vendor Phone</Label>
                      <FieldWrapper
                        error={getFieldError('vendorPhone')}
                        status={getFieldStatus('vendorPhone')}
                      >
                        <Controller
                          name="vendorPhone"
                          control={control}
                          render={({ field }) => (
                            <Input
                              {...field}
                              value={field.value || ''}
                              placeholder="+1234567890 or +1234567890 ext. 123"
                            />
                          )}
                        />
                      </FieldWrapper>
                    </div>

                    <div className="col-span-2">
                      <Label htmlFor="vendorEmail">Vendor Email</Label>
                      <FieldWrapper
                        error={getFieldError('vendorEmail')}
                        status={getFieldStatus('vendorEmail')}
                      >
                        <Controller
                          name="vendorEmail"
                          control={control}
                          render={({ field }) => (
                            <Input
                              {...field}
                              value={field.value || ''}
                              placeholder="contact@vendor-company.com"
                              type="email"
                            />
                          )}
                        />
                      </FieldWrapper>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="job" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Job Requirement Details</CardTitle>
                    <Button type="button" variant="outline" size="sm" onClick={copyTemplate}>
                      <Copy size={16} className="mr-2" />
                      Use Template
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="completeJobDescription">Complete Job Description *</Label>
                    <FieldWrapper
                      error={getFieldError('completeJobDescription')}
                      status={getFieldStatus('completeJobDescription')}
                    >
                      <Controller
                        name="completeJobDescription"
                        control={control}
                        render={({ field }) => (
                          <Textarea
                            {...field}
                            value={field.value ?? ''}
                            placeholder="Enter the complete job description including requirements, responsibilities, and qualifications..."
                            rows={10}
                            className={`resize-none ${
                              errors.completeJobDescription ? 'border-red-500' : ''
                            }`}
                          />
                        )}
                      />
                    </FieldWrapper>
                    <p className="text-sm text-gray-500 mt-1">
                      Minimum 50 characters required
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </form>

        <DialogFooter className="flex-shrink-0 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
            >
              Preview
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => reset()}>
              Reset Form
            </Button>
          </div>

          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !isValid}>
              {isSubmitting
                ? 'Creating...'
                : editMode
                ? 'Update Requirement'
                : 'Create Requirement'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
