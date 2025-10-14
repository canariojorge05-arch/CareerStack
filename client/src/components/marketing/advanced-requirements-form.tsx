import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EnhancedField } from '@/components/ui/enhanced-field';
import { BackupRecoveryDialog } from '@/components/ui/backup-recovery-dialog';
import { useFormPersistence } from '@/hooks/useFormPersistence';
import { useKeyboardShortcuts, getFormNavigationShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useFocusTrap, useAriaAnnouncer } from '@/hooks/useAccessibility';
import { useFormBackup } from '@/hooks/useFormBackup';
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
  History,
} from 'lucide-react';
import { toast } from 'sonner';
import { RequirementStatus } from '@shared/schema';

// Form interfaces
interface RequirementFormData {
  jobTitle: string;
  status: string;
  consultantId: string | null;  // Remove optional to match expected type
  appliedFor: string;
  rate: string;
  primaryTechStack: string;
  clientCompany: string;
  impName: string;        // Remove optional to match expected type
  clientWebsite: string;  // Remove optional to match expected type
  impWebsite: string;     // Remove optional to match expected type
  vendorCompany: string;  // Remove optional to match expected type
  vendorWebsite: string;  // Remove optional to match expected type
  vendorPersonName: string; // Remove optional to match expected type
  vendorPhone: string;    // Remove optional to match expected type
  vendorEmail: string;    // Remove optional to match expected type
  completeJobDescription: string;
  nextStep: string;      // Remove optional to match expected type
  remote: string;        // Remove optional to match expected type
  duration: string;      // Remove optional to match expected type
}

// Default form values
const defaultValues: RequirementFormData = {
  jobTitle: '',
  status: RequirementStatus.NEW,
  consultantId: null,
  appliedFor: '',
  rate: '',
  primaryTechStack: '',
  clientCompany: '',
  impName: '',
  clientWebsite: '',
  impWebsite: '',
  vendorCompany: '',
  vendorWebsite: '',
  vendorPersonName: '',
  vendorPhone: '',
  vendorEmail: '',
  completeJobDescription: '',
  nextStep: '',
  remote: '',
  duration: ''
};

export interface Consultant {
  id: string;
  name: string;
  email: string;
  status: string;
  displayId?: string;
}

export interface AdvancedRequirementsFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (requirements: RequirementFormData[]) => Promise<void>;
  consultants?: Consultant[];
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
    {status === 'error' && <AlertCircle className="absolute right-3 top-3 h-4 w-4 text-red-500" />}
    {error && (
      <p className="text-sm text-red-500 mt-1 flex items-center">
        <AlertCircle className="h-3 w-3 mr-1" />
        {error}
      </p>
    )}
  </div>
);

// Constants moved outside to prevent re-creation on every render
const appliedForOptions = ['Rahul', 'Sarah Johnson', 'Mike Chen', 'Lisa Rodriguez'];

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
  const [showBackupDialog, setShowBackupDialog] = useState(false);

  // Form setup - must be first
  const {
    control,
    handleSubmit,
    formState: { errors, isValid, isDirty },
    watch,
    setValue,
    reset,
    trigger,
  } = useForm({
    shouldUnregister: false, // Preserve field values when unmounting
    mode: 'onChange',
    defaultValues: {
      status: RequirementStatus.NEW,
      appliedFor: 'Rahul',
      jobTitle: '',
      consultantId: null,
      rate: '',
      primaryTechStack: '',
      clientCompany: '',
      impName: '',
      clientWebsite: '',
      impWebsite: '',
      vendorCompany: '',
      vendorWebsite: '',
      vendorPersonName: '',
      vendorPhone: '',
      vendorEmail: '',
      completeJobDescription: '',
      nextStep: '',
      remote: '',
      duration: '',
      ...initialData,
    },
  });

  // Accessibility features
  const dialogRef = useRef<HTMLDivElement>(null);
  const focusTrapRef = useFocusTrap({
    enabled: open,
    onEscape: onClose,
  });
  const { announce } = useAriaAnnouncer();

  // Setup keyboard shortcuts
  const keyboardShortcuts = getFormNavigationShortcuts(setActiveTab);
  const handleKeyDown = useKeyboardShortcuts(keyboardShortcuts);

  // Performance optimizations (removed unused optimizations)
  // Form persistence and backup
  const { clearSavedData } = useFormPersistence('requirements', watch, reset, isDirty);
  const { createBackup, getBackups, recoverBackup, recoverLastBackup, clearBackups } =
    useFormBackup('requirements', watch, reset, { autoBackupInterval: 2 * 60 * 1000 }); // 2 minutes

  // Announce form state changes
  useEffect(() => {
    if (!isValid && Object.keys(errors).length > 0) {
      announce(`Form has ${Object.keys(errors).length} validation errors`, 'polite');
    }
  }, [isValid, errors, announce]);

  // Debug and monitoring
  useEffect(() => {
    const formState = { isValid, errors: Object.keys(errors) };
    console.log('Form validation state:', formState);

    // Create backup on significant changes
    if (isDirty) {
      createBackup(watch());
    }
  }, [isValid, errors, isDirty, watch, createBackup]);

  // Focus management
  useEffect(() => {
    if (open && dialogRef.current) {
      dialogRef.current.focus();
    }
  }, [open]);

  // Form persistence

  // Effect to populate form with initialData when in edit mode
  useEffect(() => {
    if (editMode && initialData && open) {
      console.log('🔄 Populating form with edit data:', initialData);

      // Reset form with the initial data
      reset({
        status: RequirementStatus.NEW,
        appliedFor: 'Rahul',
        jobTitle: '',
        consultantId: null,
        rate: '',
        primaryTechStack: '',
        clientCompany: '',
        impName: '',
        clientWebsite: '',
        impWebsite: '',
        vendorCompany: '',
        vendorWebsite: '',
        vendorPersonName: '',
        vendorPhone: '',
        vendorEmail: '',
        completeJobDescription: '',
        nextStep: '',
        remote: '',
        duration: '',
        ...initialData,
      });
    } else if (!editMode && open) {
      // Reset to empty form for create mode
      console.log('🆕 Resetting form for create mode');
      reset({
        status: RequirementStatus.NEW,
        appliedFor: 'Rahul',
        jobTitle: '',
        consultantId: null,
        rate: '',
        primaryTechStack: '',
        clientCompany: '',
        impName: '',
        clientWebsite: '',
        impWebsite: '',
        vendorCompany: '',
        vendorWebsite: '',
        vendorPersonName: '',
        vendorPhone: '',
        vendorEmail: '',
        completeJobDescription: '',
        nextStep: '',
        remote: '',
        duration: '',
      });
    }
  }, [editMode, initialData, open, reset]);

  // Note: Removed watch() calls to prevent re-renders on every keystroke that cause focus loss

  const getFieldError = (fieldName: keyof RequirementFormData) => {
    const error = errors[fieldName];
    if (!error) return undefined;
    return typeof error.message === 'string' ? error.message : undefined;
  };

  const getFieldStatus = (fieldName: keyof RequirementFormData) => {
    if (errors[fieldName]) return 'error';
    return 'default';
  };

  const handleFormSubmit = async (data: RequirementFormData) => {
    console.log('Form submitting with data:', data);
    try {
      await onSubmit([data]);
      clearSavedData();
      clearBackups();
      announce('Form submitted successfully', 'assertive');
      toast.success('Form submitted successfully');
    } catch (error) {
      console.error('Form submission error:', error);
      toast.error('Failed to submit form');
      announce('Error submitting form. Your progress has been saved.', 'assertive');
      // Create emergency backup on error
      createBackup(data);
    }
    try {
      await onSubmit([data]);
      console.log('Form submission successful');
      // Don't reset here - let the parent component handle dialog closing
    } catch (error: any) {
      // Error handling is done in the parent component
      console.error('Form submission error:', error);
      toast.error(`Submission failed: ${error.message}`);
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
    const templateContent = `
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
    `.trim();

    setValue('completeJobDescription', templateContent);
    toast.success('Template copied to job description');
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <div ref={dialogRef} onKeyDown={handleKeyDown} tabIndex={-1}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="flex items-center space-x-2">
                    <FileText size={20} />
                    <span>{editMode ? 'Edit Requirement' : 'Create New Requirement'}</span>
                  </DialogTitle>
                  <DialogDescription>
                    {editMode
                      ? 'Update the requirement details below'
                      : 'Fill out the form sections to create a comprehensive job requirement'}
                  </DialogDescription>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Keyboard shortcuts: Ctrl+1-4 to switch tabs, Esc to close
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant={isValid ? 'default' : 'secondary'}>
                    {isValid ? 'Valid' : 'Incomplete'}
                  </Badge>
                  <div className="text-xs text-slate-500">
                    Step {['requirement', 'client', 'vendor', 'job'].indexOf(activeTab) + 1} of 4
                  </div>
                </div>
              </div>
              {/* Progress Bar */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                  <span>Progress</span>
                  <span>
                    {Math.round(
                      ((['requirement', 'client', 'vendor', 'job'].indexOf(activeTab) + 1) / 4) *
                        100
                    )}
                    %
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-in-out"
                    style={{
                      width: `${
                        ((['requirement', 'client', 'vendor', 'job'].indexOf(activeTab) + 1) / 4) *
                        100
                      }%`,
                    }}
                  ></div>
                </div>
              </div>
            </DialogHeader>

            <form
              id="requirement-form"
              onSubmit={handleSubmit(handleFormSubmit)}
              className="flex-1 overflow-y-auto"
            >
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
                          <Controller
                            name="jobTitle"
                            control={control}
                            render={({ field }) => (
                              <EnhancedField
                                {...field}
                                id="jobTitle"
                                label="Job Title *"
                                placeholder="e.g., Senior React Developer"
                                error={getFieldError('jobTitle')}
                                tooltip="Enter the full title of the position"
                                copyable
                              />
                            )}
                          />
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
                          <FieldWrapper
                            error={getFieldError('consultantId' as keyof RequirementFormData)}
                          >
                            <Controller
                              name={'consultantId' as const}
                              control={control}
                              render={({ field }) => (
                                <Select
                                  onValueChange={(value) =>
                                    field.onChange(value === 'unassigned' ? null : value)
                                  }
                                  value={field.value ?? 'unassigned'}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select consultant" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="unassigned">
                                      No consultant assigned
                                    </SelectItem>
                                    {consultants
                                      .filter((c) => c.status === 'Active')
                                      .map((consultant) => (
                                        <SelectItem key={consultant.id} value={consultant.id}>
                                          {consultant.displayId ? `${consultant.displayId} - ` : ''}
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
                          <FieldWrapper
                            error={getFieldError('rate')}
                            status={getFieldStatus('rate')}
                          >
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
                          <Controller
                            name="vendorPhone"
                            control={control}
                            render={({ field }) => (
                              <EnhancedField
                                {...field}
                                id="vendorPhone"
                                label="Vendor Phone"
                                placeholder="Any phone format accepted"
                                error={getFieldError('vendorPhone')}
                                tooltip="Enter the vendor's contact phone number in any format"
                                // Removed phone mask to allow flexible input
                                onChange={(e) => {
                                  // Clean up the input but keep it flexible
                                  const value = e.target.value
                                    .replace(/[^\d\s+()-.,ext]/gi, '') // Allow digits, spaces, +()-., and 'ext'
                                    .trim();
                                  field.onChange(value);
                                }}
                              />
                            )}
                          />
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
                        <p className="text-sm text-gray-500 mt-1">Minimum 50 characters required</p>
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
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  {showPreview ? 'Hide Preview' : 'Show Preview'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBackupDialog(true)}
                  className="flex items-center space-x-1"
                >
                  <History className="w-4 h-4" />
                  <span>Backups</span>
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => reset()}>
                  Reset Form
                </Button>
              </div>

              <div className="flex items-center space-x-2">
                {/* Navigation buttons */}
                {activeTab !== 'requirement' && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const tabs = ['requirement', 'client', 'vendor', 'job'];
                      const currentIndex = tabs.indexOf(activeTab);
                      if (currentIndex > 0) setActiveTab(tabs[currentIndex - 1]);
                    }}
                  >
                    Previous
                  </Button>
                )}
                {activeTab !== 'job' && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const tabs = ['requirement', 'client', 'vendor', 'job'];
                      const currentIndex = tabs.indexOf(activeTab);
                      if (currentIndex < tabs.length - 1) setActiveTab(tabs[currentIndex + 1]);
                    }}
                  >
                    Next
                  </Button>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" form="requirement-form" disabled={isSubmitting || !isValid}>
                  {isSubmitting
                    ? 'Creating...'
                    : editMode
                    ? 'Update Requirement'
                    : 'Create Requirement'}
                </Button>
                {!isValid && Object.keys(errors).length > 0 && (
                  <div className="text-xs text-red-500 mt-1">
                    Missing: {Object.keys(errors).join(', ')}
                  </div>
                )}
              </div>
            </DialogFooter>
          </DialogContent>
        </div>
      </Dialog>

      <BackupRecoveryDialog
        open={showBackupDialog}
        onClose={() => setShowBackupDialog(false)}
        backups={getBackups()}
        onRecover={(timestamp) => {
          recoverBackup(timestamp);
          setShowBackupDialog(false);
          announce('Form restored from backup', 'assertive');
          toast.success('Form restored from backup');
        }}
        onClearAll={() => {
          clearBackups();
          setShowBackupDialog(false);
          announce('All backups cleared', 'assertive');
          toast.success('All backups cleared');
        }}
      />
    </>
  );
}
