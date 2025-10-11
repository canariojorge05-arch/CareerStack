import React, { useState } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
  Users,
  FileText,
  Building,
  AlertCircle,
  CheckCircle,
  Trash2,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';
import { ConsultantStatus } from '@shared/schema';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

// Form validation schema
const consultantSchema = yup.object({
  // Consultant Info
  status: yup
    .string()
    .required('Status is required')
    .oneOf(Object.values(ConsultantStatus), 'Invalid status'),
  name: yup
    .string()
    .required('Name is required')
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters'),
  email: yup
    .string()
    .required('Email is required')
    .email('Invalid email format'),
  visaStatus: yup.string().nullable(),
  dateOfBirth: yup.date().nullable(),
  address: yup.string().nullable(),
  phone: yup
    .string()
    .matches(/^[\+]?[1-9][\d]{0,15}$/, 'Phone number must be valid (e.g., +1234567890)')
    .nullable(),
  timezone: yup.string().nullable(),
  degreeName: yup.string().nullable(),
  university: yup.string().nullable(),
  yearOfPassing: yup
    .string()
    .matches(/^\d{4}$/, 'Year must be 4 digits')
    .nullable(),
  ssn: yup
    .string()
    .matches(/^\d{3}-?\d{2}-?\d{4}$/, 'SSN format invalid (e.g., 123-45-6789)')
    .nullable(),
  howDidYouGetVisa: yup.string().nullable(),
  yearCameToUS: yup
    .string()
    .matches(/^\d{4}$/, 'Year must be 4 digits')
    .nullable(),
  countryOfOrigin: yup.string().nullable(),
  whyLookingForNewJob: yup.string().nullable(),
});

const projectSchema = yup.object({
  projectName: yup
    .string()
    .required('Project name is required')
    .min(2, 'Project name must be at least 2 characters'),
  projectDomain: yup.string().nullable(),
  projectCity: yup.string().nullable(),
  projectState: yup.string().nullable(),
  projectStartDate: yup
    .string()
    .matches(/^\d{2}\/\d{4}$/, 'Date must be in MM/YYYY format')
    .required('Start date is required'),
  projectEndDate: yup
    .string()
    .matches(/^\d{2}\/\d{4}$/, 'Date must be in MM/YYYY format')
    .nullable(),
  isCurrentlyWorking: yup.boolean().default(false),
  projectDescription: yup
    .string()
    .required('Project description is required')
    .min(10, 'Description must be at least 10 characters'),
});

type ConsultantFormData = yup.InferType<typeof consultantSchema>;
type ProjectFormData = yup.InferType<typeof projectSchema>;

interface AdvancedConsultantFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (consultant: ConsultantFormData, projects: ProjectFormData[]) => Promise<void>;
  initialData?: any;
  editMode?: boolean;
  isSubmitting?: boolean;
}

export default function AdvancedConsultantForm({
  open,
  onClose,
  onSubmit,
  initialData,
  editMode = false,
  isSubmitting = false,
}: AdvancedConsultantFormProps) {
  const [activeTab, setActiveTab] = useState('consultant');
  const queryClient = useQueryClient();

  const {
    control,
    handleSubmit,
    formState: { errors, isValid, isDirty },
    watch,
    setValue,
    reset,
    trigger,
  } = useForm<ConsultantFormData>({
    resolver: yupResolver(consultantSchema),
    defaultValues: {
      status: ConsultantStatus.ACTIVE,
      ...initialData,
    },
    mode: 'onChange',
  });

  const {
    control: projectsControl,
    handleSubmit: handleProjectsSubmit,
    formState: { errors: projectErrors },
    watch: watchProjects,
    setValue: setProjectValue,
    reset: resetProjects,
  } = useForm({
    defaultValues: {
      projects: initialData?.projects || [
        {
          projectName: '',
          projectDomain: '',
          projectCity: '',
          projectState: '',
          projectStartDate: '',
          projectEndDate: '',
          isCurrentlyWorking: false,
          projectDescription: '',
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: projectsControl,
    name: 'projects',
  });

  // Watch form values for real-time validation feedback
  const watchedValues = watch();
  const watchedProjects = watchProjects('projects');

  const createConsultantMutation = useMutation({
    mutationFn: async (data: { consultant: ConsultantFormData; projects: ProjectFormData[] }) => {
      const endpoint = editMode 
        ? `/api/marketing/consultants/${initialData?.id}`
        : '/api/marketing/consultants';
      const method = editMode ? 'PATCH' : 'POST';
      
      const response = await apiRequest(method, endpoint, data);
      if (!response.ok) {
        throw new Error('Failed to save consultant');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/marketing/consultants'] });
      toast.success(editMode ? 'Consultant updated successfully!' : 'Consultant created successfully!');
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to save consultant');
    },
  });

  const getFieldError = (fieldName: keyof ConsultantFormData) => {
    return errors[fieldName]?.message;
  };

  const getFieldStatus = (fieldName: keyof ConsultantFormData) => {
    if (errors[fieldName]) return 'error';
    if (watchedValues[fieldName] && !errors[fieldName]) return 'success';
    return 'default';
  };

  const handleFormSubmit = async (consultantData: ConsultantFormData) => {
    try {
      // Validate projects
      const projectsData = watchedProjects as ProjectFormData[];
      
      // Filter out empty projects
      const validProjects = projectsData.filter(project => 
        project.projectName && project.projectStartDate && project.projectDescription
      );

      await onSubmit(consultantData, validProjects);
      reset();
    } catch (error: any) {
      // Error handling is done in the parent component
      console.error('Form submission error:', error);
    }
  };

  const addProject = () => {
    append({
      projectName: '',
      projectDomain: '',
      projectCity: '',
      projectState: '',
      projectStartDate: '',
      projectEndDate: '',
      isCurrentlyWorking: false,
      projectDescription: '',
    });
  };

  const removeProject = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    }
  };

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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center space-x-2">
                <Users size={20} />
                <span>{editMode ? 'Edit Consultant' : 'Add New Consultant'}</span>
              </DialogTitle>
              <DialogDescription>
                Fill out the consultant information and project details
              </DialogDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant={isValid ? 'default' : 'secondary'}>
                {isValid ? 'Valid' : 'Incomplete'}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="consultant" className="flex items-center space-x-2">
                <Users size={16} />
                <span>Consultant Info</span>
                {errors.name || errors.email || errors.status ? (
                  <AlertCircle size={12} className="text-red-500" />
                ) : (
                  watchedValues.name && watchedValues.email && (
                    <CheckCircle size={12} className="text-green-500" />
                  )
                )}
              </TabsTrigger>
              <TabsTrigger value="projects" className="flex items-center space-x-2">
                <FileText size={16} />
                <span>Resume/Projects</span>
                <Badge variant="outline" className="text-xs">
                  {fields.length}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="consultant" className="space-y-6">
              <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
                {/* Basic Info */}
                <Card>
                  <CardHeader>
                    <CardTitle>Basic Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="status">Consultant Status *</Label>
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
                                  {Object.entries(ConsultantStatus).map(([key, value]) => (
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
                        <Label htmlFor="name">Consultant Name *</Label>
                        <FieldWrapper
                          error={getFieldError('name')}
                          status={getFieldStatus('name')}
                        >
                          <Controller
                            name="name"
                            control={control}
                            render={({ field }) => (
                              <Input
                                {...field}
                                placeholder="Enter full name"
                                className={errors.name ? 'border-red-500' : ''}
                              />
                            )}
                          />
                        </FieldWrapper>
                      </div>

                      <div>
                        <Label htmlFor="email">Email *</Label>
                        <FieldWrapper
                          error={getFieldError('email')}
                          status={getFieldStatus('email')}
                        >
                          <Controller
                            name="email"
                            control={control}
                            render={({ field }) => (
                              <Input
                                {...field}
                                type="email"
                                placeholder="consultant@example.com"
                                className={errors.email ? 'border-red-500' : ''}
                              />
                            )}
                          />
                        </FieldWrapper>
                      </div>

                      <div>
                        <Label htmlFor="phone">Phone</Label>
                        <FieldWrapper
                          error={getFieldError('phone')}
                          status={getFieldStatus('phone')}
                        >
                          <Controller
                            name="phone"
                            control={control}
                            render={({ field }) => (
                              <Input
                                {...field}
                                value={field.value || ''}
                                placeholder="+1 (555) 123-4567"
                              />
                            )}
                          />
                        </FieldWrapper>
                      </div>

                      <div>
                        <Label htmlFor="visaStatus">Visa Status</Label>
                        <Controller
                          name="visaStatus"
                          control={control}
                          render={({ field }) => (
                            <Textarea
                              {...field}
                              value={field.value || ''}
                              placeholder="H1B, Green Card, Citizen, etc."
                              rows={2}
                            />
                          )}
                        />
                      </div>

                      <div>
                        <Label htmlFor="dateOfBirth">Date of Birth</Label>
                        <Controller
                          name="dateOfBirth"
                          control={control}
                          render={({ field }) => (
                            <Input
                              {...field}
                              type="date"
                              value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''}
                              onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : null)}
                            />
                          )}
                        />
                      </div>

                      <div className="col-span-2">
                        <Label htmlFor="address">Address</Label>
                        <Controller
                          name="address"
                          control={control}
                          render={({ field }) => (
                            <Input
                              {...field}
                              value={field.value || ''}
                              placeholder="Full address"
                            />
                          )}
                        />
                      </div>

                      <div>
                        <Label htmlFor="timezone">Timezone</Label>
                        <Controller
                          name="timezone"
                          control={control}
                          render={({ field }) => (
                            <Textarea
                              {...field}
                              value={field.value || ''}
                              placeholder="EST, PST, CST, etc."
                              rows={2}
                            />
                          )}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Education */}
                <Card>
                  <CardHeader>
                    <CardTitle>Education</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="degreeName">Degree Name</Label>
                        <Controller
                          name="degreeName"
                          control={control}
                          render={({ field }) => (
                            <Input
                              {...field}
                              value={field.value || ''}
                              placeholder="Bachelor of Science, Masters, etc."
                            />
                          )}
                        />
                      </div>

                      <div>
                        <Label htmlFor="university">University</Label>
                        <Controller
                          name="university"
                          control={control}
                          render={({ field }) => (
                            <Input
                              {...field}
                              value={field.value || ''}
                              placeholder="University name"
                            />
                          )}
                        />
                      </div>

                      <div>
                        <Label htmlFor="yearOfPassing">Year of Passing</Label>
                        <FieldWrapper error={getFieldError('yearOfPassing')}>
                          <Controller
                            name="yearOfPassing"
                            control={control}
                            render={({ field }) => (
                              <Input
                                {...field}
                                value={field.value || ''}
                                placeholder="2020"
                                maxLength={4}
                              />
                            )}
                          />
                        </FieldWrapper>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Additional Info */}
                <Card>
                  <CardHeader>
                    <CardTitle>Additional Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <Label htmlFor="ssn">SSN</Label>
                        <FieldWrapper error={getFieldError('ssn')}>
                          <Controller
                            name="ssn"
                            control={control}
                            render={({ field }) => (
                              <Input
                                {...field}
                                value={field.value || ''}
                                placeholder="123-45-6789"
                                type="password"
                              />
                            )}
                          />
                        </FieldWrapper>
                      </div>

                      <div>
                        <Label htmlFor="howDidYouGetVisa">How did you get the visa?</Label>
                        <Controller
                          name="howDidYouGetVisa"
                          control={control}
                          render={({ field }) => (
                            <Textarea
                              {...field}
                              value={field.value || ''}
                              placeholder="Explain how you obtained your visa..."
                              rows={3}
                            />
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="yearCameToUS">In which year you came to US?</Label>
                          <FieldWrapper error={getFieldError('yearCameToUS')}>
                            <Controller
                              name="yearCameToUS"
                              control={control}
                              render={({ field }) => (
                                <Input
                                  {...field}
                                  value={field.value || ''}
                                  placeholder="2020"
                                  maxLength={4}
                                />
                              )}
                            />
                          </FieldWrapper>
                        </div>

                        <div>
                          <Label htmlFor="countryOfOrigin">Basically from which country</Label>
                          <Controller
                            name="countryOfOrigin"
                            control={control}
                            render={({ field }) => (
                              <Input
                                {...field}
                                value={field.value || ''}
                                placeholder="Country name"
                              />
                            )}
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="whyLookingForNewJob">Why are you looking for a new job?</Label>
                        <Controller
                          name="whyLookingForNewJob"
                          control={control}
                          render={({ field }) => (
                            <Textarea
                              {...field}
                              value={field.value || ''}
                              placeholder="Explain the reason for job change..."
                              rows={3}
                            />
                          )}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </form>
            </TabsContent>

            <TabsContent value="projects" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Project Information</CardTitle>
                    <Button type="button" onClick={addProject} size="sm">
                      <Plus size={16} className="mr-2" />
                      Add Project
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {fields.map((field, index) => (
                    <Card key={field.id} className="border border-gray-200">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium">Project #{index + 1}</h4>
                          {fields.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeProject(index)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 size={16} />
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>Project Name *</Label>
                            <Controller
                              name={`projects.${index}.projectName`}
                              control={projectsControl}
                              render={({ field }) => (
                                <Input
                                  {...field}
                                  placeholder="e.g., E-commerce Platform"
                                />
                              )}
                            />
                          </div>

                          <div>
                            <Label>Project Domain</Label>
                            <Controller
                              name={`projects.${index}.projectDomain`}
                              control={projectsControl}
                              render={({ field }) => (
                                <Input
                                  {...field}
                                  placeholder="e.g., Healthcare, Finance, E-commerce"
                                />
                              )}
                            />
                          </div>

                          <div>
                            <Label>Project City</Label>
                            <Controller
                              name={`projects.${index}.projectCity`}
                              control={projectsControl}
                              render={({ field }) => (
                                <Input
                                  {...field}
                                  placeholder="City name"
                                />
                              )}
                            />
                          </div>

                          <div>
                            <Label>Project State</Label>
                            <Controller
                              name={`projects.${index}.projectState`}
                              control={projectsControl}
                              render={({ field }) => (
                                <Input
                                  {...field}
                                  placeholder="State"
                                />
                              )}
                            />
                          </div>

                          <div>
                            <Label>Start Date (MM/YYYY) *</Label>
                            <Controller
                              name={`projects.${index}.projectStartDate`}
                              control={projectsControl}
                              render={({ field }) => (
                                <Input
                                  {...field}
                                  placeholder="01/2023"
                                />
                              )}
                            />
                          </div>

                          <div>
                            <Label>End Date (MM/YYYY)</Label>
                            <div className="space-y-2">
                              <Controller
                                name={`projects.${index}.projectEndDate`}
                                control={projectsControl}
                                render={({ field }) => (
                                  <Input
                                    {...field}
                                    placeholder="12/2023"
                                    disabled={watchedProjects[index]?.isCurrentlyWorking}
                                  />
                                )}
                              />
                              <div className="flex items-center space-x-2">
                                <Controller
                                  name={`projects.${index}.isCurrentlyWorking`}
                                  control={projectsControl}
                                  render={({ field }) => (
                                    <Checkbox
                                      checked={field.value}
                                      onCheckedChange={(checked) => {
                                        field.onChange(checked);
                                        if (checked) {
                                          setProjectValue(`projects.${index}.projectEndDate`, '');
                                        }
                                      }}
                                    />
                                  )}
                                />
                                <Label className="text-sm">I am currently working here</Label>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div>
                          <Label>Project Description *</Label>
                          <Controller
                            name={`projects.${index}.projectDescription`}
                            control={projectsControl}
                            render={({ field }) => (
                              <Textarea
                                {...field}
                                placeholder="Describe the project, your role, technologies used, and achievements..."
                                rows={4}
                              />
                            )}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="flex-shrink-0 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                reset();
                resetProjects();
              }}
            >
              Reset Form
            </Button>
          </div>

          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit(handleFormSubmit)}
              disabled={isSubmitting || !isValid}
            >
              {isSubmitting
                ? 'Saving...'
                : editMode
                ? 'Update Consultant'
                : 'Add Consultant'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}