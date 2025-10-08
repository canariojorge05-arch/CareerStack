import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Calendar, Plus, Clock, User, Building } from 'lucide-react';
import { toast } from 'sonner';
import InterviewForm from './interview-form';

export default function InterviewsSection() {
  const [activeTab, setActiveTab] = useState('All');
  const [showInterviewForm, setShowInterviewForm] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState<any>(null);
  const [showEditForm, setShowEditForm] = useState(false);

  const interviewTabs = ['All', 'Cancelled', 'Re-Scheduled', 'Confirmed', 'Completed'];
  // Mock data
  const mockInterviews = [
    {
      id: '1',
      jobTitle: 'Senior React Developer',
      consultantName: 'John Doe',
      interviewDate: '2024-01-15',
      interviewTime: '10:30 AM',
      status: 'Confirmed',
      round: '1',
      mode: 'Video',
      vendorCompany: 'Tech Solutions Inc',
    },
    {
      id: '2',
      jobTitle: 'Full Stack Developer',
      consultantName: 'Jane Smith',
      interviewDate: '2024-01-16',
      interviewTime: '2:00 PM',
      status: 'Completed',
      round: 'Final',
      mode: 'Phone',
      vendorCompany: 'StartupCorp',
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Confirmed': return 'bg-blue-100 text-blue-800';
      case 'Completed': return 'bg-green-100 text-green-800';
      case 'Cancelled': return 'bg-red-100 text-red-800';
      case 'Re-Scheduled': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleScheduleInterview = () => {
    setSelectedInterview(null);
    setShowInterviewForm(true);
  };

  const handleEditInterview = (interview: any) => {
    setSelectedInterview(interview);
    setShowEditForm(true);
  };

  const handleFormClose = () => {
    setShowInterviewForm(false);
    setShowEditForm(false);
    setSelectedInterview(null);
  };

  const handleFormSubmit = async (interviewData: any) => {
    console.log('Submitting interview:', interviewData);
    // Handle form submission - this would typically call an API
    toast.success('Interview scheduled successfully!');
    return Promise.resolve();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Interview Management</h2>
        <Button onClick={handleScheduleInterview} className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-md hover:shadow-lg transition-all">
          <Plus size={16} className="mr-2" />
          Schedule Interview
        </Button>
      </div>

      <Tabs defaultValue="All" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          {interviewTabs.map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        {interviewTabs.map((tab) => (
          <TabsContent key={tab} value={tab} className="space-y-4">
            {mockInterviews
              .filter(interview => tab === 'All' || interview.status === tab)
              .map((interview) => (
                <Card key={interview.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-3">
                          <h3 className="font-semibold text-lg">{interview.jobTitle}</h3>
                          <Badge className={getStatusColor(interview.status)}>
                            {interview.status}
                          </Badge>
                          <Badge variant="outline">
                            Round {interview.round}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div className="flex items-center space-x-2 text-muted-foreground">
                            <User size={16} />
                            <span>{interview.consultantName}</span>
                          </div>
                          <div className="flex items-center space-x-2 text-muted-foreground">
                            <Building size={16} />
                            <span>{interview.vendorCompany}</span>
                          </div>
                          <div className="flex items-center space-x-2 text-muted-foreground">
                            <Calendar size={16} />
                            <span>{interview.interviewDate}</span>
                          </div>
                          <div className="flex items-center space-x-2 text-muted-foreground">
                            <Clock size={16} />
                            <span>{interview.interviewTime} ({interview.mode})</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Button variant="outline" size="sm">
                          View Details
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleEditInterview(interview)}>
                          Edit
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

            {mockInterviews.filter(interview => tab === 'All' || interview.status === tab).length === 0 && (
              <Card>
                <CardContent className="p-12 text-center">
                  <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No {tab.toLowerCase()} interviews</h3>
                  <p className="text-muted-foreground mb-4">
                    {tab === 'All' ? 'Schedule your first interview to get started.' : `No ${tab.toLowerCase()} interviews found.`}
                  </p>
                  <Button onClick={handleScheduleInterview} className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-md hover:shadow-lg transition-all">
                    <Plus size={16} className="mr-2" />
                    Schedule Interview
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Feature Preview */}
      <Card>
        <CardHeader>
          <CardTitle>📅 Interview Management Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <p className="mb-4">This section will include:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto text-left">
              <ul className="space-y-2">
                <li>✅ Interview scheduling</li>
                <li>📊 Status tracking</li>
                <li>🔄 Rescheduling support</li>
                <li>📝 Feedback collection</li>
              </ul>
              <ul className="space-y-2">
                <li>🎯 Auto-generated subject lines</li>
                <li>🔗 Meeting links integration</li>
                <li>⏰ Timezone support</li>
                <li>📈 Result tracking</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Interview Form */}
      {(showInterviewForm || showEditForm) && (
        <InterviewForm
          open={showInterviewForm || showEditForm}
          onClose={handleFormClose}
          onSubmit={handleFormSubmit}
          initialData={showEditForm ? selectedInterview : undefined}
          editMode={showEditForm}
        />
      )}
    </div>
  );
}