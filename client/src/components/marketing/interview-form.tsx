import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
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
  Calendar,
  Clock,
  User,
  Building,
  Video,
  Phone,
  AlertCircle,
  CheckCircle,
  Save,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { InterviewStatus } from '@shared/schema';

// Form interface
interface InterviewFormData {
  requirementId?: string;
  interviewDate?: string;
  interviewTime?: string;
  timezone: string;
  interviewType?: string;
  status: string;
  consultantId?: string;
  vendorCompany?: string;
  interviewWith?: string;
  result?: string;
  round?: string;
  mode?: string;
  meetingType?: string;
  duration?: string;
  subjectLine?: string;
  interviewer?: string;
  interviewLink?: string;
  interviewFocus?: string;
  specialNote?: string;
  jobDescription?: string;
  feedbackNotes?: string;
}

interface InterviewFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (interviewData: InterviewFormData) => Promise<void>;
  initialData?: Partial<InterviewFormData>;
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

export default function InterviewForm({
  open,
  onClose,
  onSubmit,
  initialData,
  editMode = false,
  isSubmitting = false,
}: InterviewFormProps) {
  const [activeTab, setActiveTab] = useState('basic');

  // Fetch requirements for selection
  const { data: requirements = [] } = useQuery({
    queryKey: ['/api/marketing/requirements'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', '/api/marketing/requirements');
        if (!response.ok) return [];
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch {
        return [] as any[];
      }
    },
    retry: false,
  });

  // Fetch consultants for assignment
  const { data: consultants = [] } = useQuery({
    queryKey: ['/api/marketing/consultants'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', '/api/marketing/consultants?status=Active');
        if (!response.ok) return [];
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch {
        return [] as any[];
      }
    },
    retry: false,
  });

  const {
    control,
    handleSubmit,
    formState: { errors, isValid, isDirty },
    watch,
    setValue,
    reset,
    trigger,
  } = useForm({
    defaultValues: {
      status: InterviewStatus.CONFIRMED,
      timezone: 'EST',
      interviewWith: 'Client',
      round: '1',
      mode: 'Video',
      duration: '1 hour',
      ...initialData,
    },
    mode: 'onBlur',
  });

  // Note: Removed watch() calls to prevent re-renders on every keystroke that cause focus loss

  const getFieldError = (fieldName: string) => undefined;
  const getFieldStatus = (fieldName: string) => 'default' as const;

  const handleFormSubmit = async (data: InterviewFormData) => {
    try {
      await onSubmit(data);
      reset();
    } catch (error: any) {
      // Error handling is done in the parent component
      console.error('Form submission error:', error);
    }
  };

  // Auto-generate subject line based on form data
  const generateSubjectLine = () => {
    const formValues = watch();
    const requirement = requirements.find((r: any) => r.id === formValues.requirementId);
    if (requirement) {
      const subjectLine = `Interview - ${requirement.jobTitle} - Round ${formValues.round} - ${
        formValues.interviewDate
          ? new Date(formValues.interviewDate).toLocaleDateString()
          : '[Date]'
      }`;
      setValue('subjectLine', subjectLine);
      toast.success('Subject line generated');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center space-x-2">
                <Calendar size={20} />
                <span>{editMode ? 'Edit Interview' : 'Schedule New Interview'}</span>
              </DialogTitle>
              <DialogDescription>
                Fill out the form to schedule a comprehensive interview
              </DialogDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant={isValid ? 'default' : 'secondary'}>
                {isValid ? 'Valid' : 'Incomplete'}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <form
          id="interview-form"
          onSubmit={handleSubmit(handleFormSubmit)}
          className="flex-1 overflow-y-auto"
        >
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic" className="flex items-center space-x-2">
                <Calendar size={16} />
                <span>Basic Info</span>
                {errors.requirementId || errors.interviewDate || errors.interviewTime ? (
                  <AlertCircle size={12} className="text-red-500" />
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="details" className="flex items-center space-x-2">
                <User size={16} />
                <span>Interview Details</span>
                {errors.interviewer || errors.vendorCompany ? (
                  <AlertCircle size={12} className="text-red-500" />
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="additional" className="flex items-center space-x-2">
                <Building size={16} />
                <span>Additional Info</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Basic Interview Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="requirementId">Requirement *</Label>
                      <FieldWrapper
                        error={getFieldError('requirementId')}
                        status={getFieldStatus('requirementId')}
                      >
                        <Controller
                          name="requirementId"
                          control={control}
                          render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select requirement" />
                              </SelectTrigger>
                              <SelectContent>
                                {(Array.isArray(requirements) ? requirements : []).map(
                                  (requirement: any) => (
                                    <SelectItem key={requirement?.id} value={requirement?.id}>
                                      {requirement?.jobTitle} - {requirement?.clientCompany}
                                    </SelectItem>
                                  )
                                )}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </FieldWrapper>
                    </div>

                    <div>
                      <Label htmlFor="consultantId">Assigned Consultant</Label>
                      <FieldWrapper error={getFieldError('consultantId')}>
                        <Controller
                          name="consultantId"
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
                                <SelectItem value="unassigned">No consultant assigned</SelectItem>
                                {(Array.isArray(consultants) ? consultants : [])
                                  .filter((c: any) => c?.status === 'Active')
                                  .map((consultant: any) => (
                                    <SelectItem key={consultant?.id} value={consultant?.id}>
                                      {consultant?.name} ({consultant?.email})
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </FieldWrapper>
                    </div>

                    <div>
                      <Label htmlFor="interviewDate">Interview Date *</Label>
                      <FieldWrapper
                        error={getFieldError('interviewDate')}
                        status={getFieldStatus('interviewDate')}
                      >
                        <Controller
                          name="interviewDate"
                          control={control}
                          render={({ field }) => (
                            <Input
                              {...field}
                              type="date"
                              value={
                                field.value ? new Date(field.value).toISOString().split('T')[0] : ''
                              }
                              onChange={(e) => field.onChange(new Date(e.target.value))}
                              className={errors.interviewDate ? 'border-red-500' : ''}
                            />
                          )}
                        />
                      </FieldWrapper>
                    </div>

                    <div>
                      <Label htmlFor="interviewTime">Interview Time *</Label>
                      <FieldWrapper
                        error={getFieldError('interviewTime')}
                        status={getFieldStatus('interviewTime')}
                      >
                        <Controller
                          name="interviewTime"
                          control={control}
                          render={({ field }) => (
                            <Input
                              {...field}
                              placeholder="e.g., 10:30 AM"
                              className={errors.interviewTime ? 'border-red-500' : ''}
                            />
                          )}
                        />
                      </FieldWrapper>
                    </div>

                    <div>
                      <Label htmlFor="timezone">Timezone *</Label>
                      <FieldWrapper error={getFieldError('timezone')}>
                        <Controller
                          name="timezone"
                          control={control}
                          render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="EST">Eastern (EST)</SelectItem>
                                <SelectItem value="CST">Central (CST)</SelectItem>
                                <SelectItem value="MST">Mountain (MST)</SelectItem>
                                <SelectItem value="PST">Pacific (PST)</SelectItem>
                              </SelectContent>
                            </Select>
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
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(InterviewStatus).map(([key, value]) => (
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
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="details" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Interview Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="vendorCompany">Vendor Company *</Label>
                      <FieldWrapper
                        error={getFieldError('vendorCompany')}
                        status={getFieldStatus('vendorCompany')}
                      >
                        <Controller
                          name="vendorCompany"
                          control={control}
                          render={({ field }) => (
                            <Input
                              {...field}
                              placeholder="Company conducting interview"
                              className={errors.vendorCompany ? 'border-red-500' : ''}
                            />
                          )}
                        />
                      </FieldWrapper>
                    </div>

                    <div>
                      <Label htmlFor="interviewer">Interviewer *</Label>
                      <FieldWrapper
                        error={getFieldError('interviewer')}
                        status={getFieldStatus('interviewer')}
                      >
                        <Controller
                          name="interviewer"
                          control={control}
                          render={({ field }) => (
                            <Input
                              {...field}
                              placeholder="Name of the interviewer"
                              className={errors.interviewer ? 'border-red-500' : ''}
                            />
                          )}
                        />
                      </FieldWrapper>
                    </div>

                    <div>
                      <Label htmlFor="interviewWith">Interview With *</Label>
                      <FieldWrapper error={getFieldError('interviewWith')}>
                        <Controller
                          name="interviewWith"
                          control={control}
                          render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Client">Client</SelectItem>
                                <SelectItem value="IMP">IMP</SelectItem>
                                <SelectItem value="Vendor">Vendor</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </FieldWrapper>
                    </div>

                    <div>
                      <Label htmlFor="round">Round *</Label>
                      <FieldWrapper error={getFieldError('round')}>
                        <Controller
                          name="round"
                          control={control}
                          render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1">Round 1</SelectItem>
                                <SelectItem value="2">Round 2</SelectItem>
                                <SelectItem value="3">Round 3</SelectItem>
                                <SelectItem value="Final">Final Round</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </FieldWrapper>
                    </div>

                    <div>
                      <Label htmlFor="mode">Mode *</Label>
                      <FieldWrapper error={getFieldError('mode')}>
                        <Controller
                          name="mode"
                          control={control}
                          render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Phone">
                                  <div className="flex items-center space-x-2">
                                    <Phone size={16} />
                                    <span>Phone</span>
                                  </div>
                                </SelectItem>
                                <SelectItem value="Video">
                                  <div className="flex items-center space-x-2">
                                    <Video size={16} />
                                    <span>Video</span>
                                  </div>
                                </SelectItem>
                                <SelectItem value="Video+Coding">
                                  <div className="flex items-center space-x-2">
                                    <Video size={16} />
                                    <span>Video + Coding</span>
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </FieldWrapper>
                    </div>

                    <div>
                      <Label htmlFor="duration">Duration *</Label>
                      <FieldWrapper
                        error={getFieldError('duration')}
                        status={getFieldStatus('duration')}
                      >
                        <Controller
                          name="duration"
                          control={control}
                          render={({ field }) => (
                            <Input
                              {...field}
                              placeholder="e.g., 1 hour, 30 mins"
                              className={errors.duration ? 'border-red-500' : ''}
                            />
                          )}
                        />
                      </FieldWrapper>
                    </div>

                    <div className="col-span-2">
                      <Label htmlFor="interviewLink">Interview Link</Label>
                      <FieldWrapper
                        error={getFieldError('interviewLink')}
                        status={getFieldStatus('interviewLink')}
                      >
                        <Controller
                          name="interviewLink"
                          control={control}
                          render={({ field }) => (
                            <Input
                              {...field}
                              value={field.value || ''}
                              placeholder="https://zoom.us/j/123456789 or meeting details"
                            />
                          )}
                        />
                      </FieldWrapper>
                    </div>

                    <div className="col-span-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="subjectLine">Subject Line</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={generateSubjectLine}
                        >
                          Auto-Generate
                        </Button>
                      </div>
                      <Controller
                        name="subjectLine"
                        control={control}
                        render={({ field }) => (
                          <Input
                            {...field}
                            value={field.value || ''}
                            placeholder="Interview subject line"
                          />
                        )}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="additional" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Additional Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="interviewType">Interview Type</Label>
                      <Controller
                        name="interviewType"
                        control={control}
                        render={({ field }) => (
                          <Input
                            {...field}
                            value={field.value || ''}
                            placeholder="e.g., Technical, HR, Managerial"
                          />
                        )}
                      />
                    </div>

                    <div>
                      <Label htmlFor="meetingType">Meeting Type</Label>
                      <Controller
                        name="meetingType"
                        control={control}
                        render={({ field }) => (
                          <Input
                            {...field}
                            value={field.value || ''}
                            placeholder="e.g., Zoom, Teams, Phone Call"
                          />
                        )}
                      />
                    </div>

                    <div>
                      <Label htmlFor="result">Result</Label>
                      <Controller
                        name="result"
                        control={control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value || ''}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select result" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="Offer">Offer</SelectItem>
                              <SelectItem value="Positive">Positive</SelectItem>
                              <SelectItem value="Negative">Negative</SelectItem>
                              <SelectItem value="No feedback">No feedback</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>

                    <div>
                      <Label htmlFor="interviewFocus">Interview Focus</Label>
                      <Controller
                        name="interviewFocus"
                        control={control}
                        render={({ field }) => (
                          <Input
                            {...field}
                            value={field.value || ''}
                            placeholder="e.g., React, Node.js, System Design"
                          />
                        )}
                      />
                    </div>

                    <div className="col-span-2">
                      <Label htmlFor="specialNote">Special Notes</Label>
                      <Controller
                        name="specialNote"
                        control={control}
                        render={({ field }) => (
                          <Textarea
                            {...field}
                            value={field.value ?? ''}
                            placeholder="Any special instructions or notes for the interview..."
                            rows={3}
                          />
                        )}
                      />
                    </div>

                    <div className="col-span-2">
                      <Label htmlFor="jobDescription">Job Description</Label>
                      <Controller
                        name="jobDescription"
                        control={control}
                        render={({ field }) => (
                          <Textarea
                            {...field}
                            value={field.value ?? ''}
                            placeholder="Job description for the interview (auto-filled from requirement)..."
                            rows={4}
                          />
                        )}
                      />
                    </div>

                    <div className="col-span-2">
                      <Label htmlFor="feedbackNotes">Feedback Notes</Label>
                      <Controller
                        name="feedbackNotes"
                        control={control}
                        render={({ field }) => (
                          <Textarea
                            {...field}
                            value={field.value ?? ''}
                            placeholder="Interview feedback and notes..."
                            rows={4}
                          />
                        )}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </form>

        <DialogFooter className="flex-shrink-0 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button type="button" variant="outline" size="sm" onClick={() => reset()}>
              Reset Form
            </Button>
          </div>

          <div className="flex items-center space-x-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" form="interview-form" disabled={isSubmitting || !isValid}>
              <Save className="h-4 w-4 mr-2" />
              {isSubmitting
                ? 'Scheduling...'
                : editMode
                ? 'Update Interview'
                : 'Schedule Interview'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
