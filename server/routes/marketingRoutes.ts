import { Router } from 'express';
import { db } from '../db';
import { isAuthenticated } from '../localAuth';
import { EmailService } from '../services/emailService';
import { ImapService } from '../services/imapService';
import { GmailOAuthService } from '../services/gmailOAuthService';
import { OutlookOAuthService } from '../services/outlookOAuthService';
import { MultiAccountEmailService } from '../services/multiAccountEmailService';
import { EmailSyncService } from '../services/emailSyncService';
import multer from 'multer';
import { 
  consultants,
  consultantProjects,
  requirements, 
  interviews, 
  emailThreads, 
  emailMessages, 
  emailAttachments,
  emailAccounts,
  insertConsultantSchema,
  insertConsultantProjectSchema,
  insertRequirementSchema,
  insertInterviewSchema,
  insertEmailThreadSchema,
  insertEmailMessageSchema,
  insertEmailAttachmentSchema,
  insertEmailAccountSchema,
  type Consultant,
  type ConsultantProject,
  type Requirement,
  type Interview,
  type EmailThread,
  type EmailMessage,
  type EmailAccount,
  type MarketingComment
} from '@shared/schema';
import { eq, desc, asc, and, or, like, gte, lte, sql } from 'drizzle-orm';
import { z } from 'zod';

const router = Router();

// Public OAuth callbacks (do NOT require authentication)
// These use the OAuth 'state' parameter (set to userId during auth URL generation)
router.get('/oauth/gmail/callback', async (req, res) => {
  try {
    const code = String(req.query.code || '');
    const userId = String(req.query.state || '');
    if (!code || !userId) {
      return res
        .status(400)
        .send('<html><body>Missing authorization code or state</body></html>');
    }

    const result = await GmailOAuthService.handleCallback(code, userId);
    const success = !!result.success;
    const msg = success
      ? 'Gmail account connected successfully'
      : (result.error || 'Failed to connect Gmail account');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Gmail OAuth</title></head><body>
<script>
  (function(){
    try {
      if (window.opener) {
        window.opener.postMessage({ type: 'GMAIL_OAUTH_SUCCESS', success: ${success ? 'true' : 'false'}, message: ${JSON.stringify(msg)} }, '*');
      }
    } catch (e) {}
    window.close();
  })();
</script>
<p>${msg}. You may close this window.</p>
</body></html>`;
    res.setHeader('Content-Type', 'text/html');
    return res.status(success ? 200 : 400).send(html);
  } catch (error) {
    console.error('Error handling public Gmail callback:', error);
    res.status(500).send('<html><body>Failed to process Gmail authorization</body></html>');
  }
});

router.get('/oauth/outlook/callback', async (req, res) => {
  try {
    const code = String(req.query.code || '');
    const userId = String(req.query.state || '');
    if (!code || !userId) {
      return res
        .status(400)
        .send('<html><body>Missing authorization code or state</body></html>');
    }

    const result = await OutlookOAuthService.handleCallback(code, userId);
    const success = !!result.success;
    const msg = success
      ? 'Outlook account connected successfully'
      : (result.error || 'Failed to connect Outlook account');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Outlook OAuth</title></head><body>
<script>
  (function(){
    try {
      if (window.opener) {
        window.opener.postMessage({ type: 'OUTLOOK_OAUTH_SUCCESS', success: ${success ? 'true' : 'false'}, message: ${JSON.stringify(msg)} }, '*');
      }
    } catch (e) {}
    window.close();
  })();
</script>
<p>${msg}. You may close this window.</p>
</body></html>`;
    res.setHeader('Content-Type', 'text/html');
    return res.status(success ? 200 : 400).send(html);
  } catch (error) {
    console.error('Error handling public Outlook callback:', error);
    res.status(500).send('<html><body>Failed to process Outlook authorization</body></html>');
  }
});

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.MAX_FILE_SIZE || 25_000_000),
    files: Number(process.env.MAX_FILES_PER_REQUEST || 3),
  }
});

// Middleware to check if user has marketing role
const requireMarketingRole = async (req: any, res: any, next: any) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // For now, allow all authenticated users access to marketing module
    // In production, you'd check if user has 'marketing' or 'admin' role
    // const user = await db.query.users.findFirst({
    //   where: eq(users.id, req.user.id)
    // });
    // if (!user || !['marketing', 'admin'].includes(user.role)) {
    //   return res.status(403).json({ message: 'Marketing role required' });
    // }

    next();
  } catch (error) {
    return res.status(500).json({ message: 'Authorization check failed' });
  }
};

// Apply authentication and authorization to all routes
router.use(isAuthenticated);
router.use(requireMarketingRole);

// CONSULTANTS ROUTES

// Get all consultants with filters
router.get('/consultants', async (req, res) => {
  try {
    const { status, search, page = '1', limit = '50' } = req.query;
    
    let whereConditions: any[] = [];
    
    if (status && status !== 'All') {
      whereConditions.push(eq(consultants.status, status as string));
    }
    if (search) {
      whereConditions.push(
        or(
          like(consultants.name, `%${search}%`),
          like(consultants.email, `%${search}%`),
          like(consultants.visaStatus, `%${search}%`),
          like(consultants.countryOfOrigin, `%${search}%`)
        )
      );
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;
    
    const allConsultants = await db.query.consultants.findMany({
      where: whereClause,
      with: {
        projects: {
          orderBy: [desc(consultantProjects.createdAt)],
        },
        createdByUser: {
          columns: { firstName: true, lastName: true, email: true }
        }
      },
      orderBy: [desc(consultants.createdAt)],
      limit: parseInt(limit as string),
      offset: (parseInt(page as string) - 1) * parseInt(limit as string),
    });

    res.json(allConsultants);
  } catch (error) {
    console.error('Error fetching consultants:', error);
    res.status(500).json({ message: 'Failed to fetch consultants' });
  }
});

// Get consultant by ID
router.get('/consultants/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const consultant = await db.query.consultants.findFirst({
      where: eq(consultants.id, id),
      with: {
        projects: {
          orderBy: [desc(consultantProjects.createdAt)],
        },
        requirements: {
          orderBy: [desc(requirements.createdAt)],
          limit: 10,
        },
        interviews: {
          orderBy: [desc(interviews.createdAt)],
          limit: 10,
        },
        createdByUser: {
          columns: { firstName: true, lastName: true, email: true }
        }
      },
    });

    if (!consultant) {
      return res.status(404).json({ message: 'Consultant not found' });
    }

    res.json(consultant);
  } catch (error) {
    console.error('Error fetching consultant:', error);
    res.status(500).json({ message: 'Failed to fetch consultant' });
  }
});

// Create consultant with projects
router.post('/consultants', async (req, res) => {
  try {
    const { consultant: consultantData, projects = [] } = req.body;
    
    // Validate consultant data
    const validatedConsultant = insertConsultantSchema.parse({
      ...consultantData,
      createdBy: req.user!.id
    });
    
    // Create consultant
    const [newConsultant] = await db.insert(consultants).values(validatedConsultant).returning();
    
    // Create projects if any
    const createdProjects = [];
    if (projects.length > 0) {
      for (const project of projects) {
        const validatedProject = insertConsultantProjectSchema.parse({
          ...project,
          consultantId: newConsultant.id
        });
        const [createdProject] = await db.insert(consultantProjects).values(validatedProject).returning();
        createdProjects.push(createdProject);
      }
    }
    
    res.status(201).json({ ...newConsultant, projects: createdProjects });
  } catch (error) {
    console.error('Error creating consultant:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid data', errors: error.errors });
    }
    res.status(500).json({ message: 'Failed to create consultant' });
  }
});

// Update consultant
router.patch('/consultants/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { consultant: consultantData, projects = [] } = req.body;
    
    // Update consultant
    const updateData = insertConsultantSchema.partial().parse(consultantData);
    const [updatedConsultant] = await db
      .update(consultants)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(consultants.id, id))
      .returning();

    if (!updatedConsultant) {
      return res.status(404).json({ message: 'Consultant not found' });
    }

    // Update projects - delete existing and create new ones
    await db.delete(consultantProjects).where(eq(consultantProjects.consultantId, id));
    
    const createdProjects = [];
    if (projects.length > 0) {
      for (const project of projects) {
        const validatedProject = insertConsultantProjectSchema.parse({
          ...project,
          consultantId: id
        });
        const [createdProject] = await db.insert(consultantProjects).values(validatedProject).returning();
        createdProjects.push(createdProject);
      }
    }

    res.json({ ...updatedConsultant, projects: createdProjects });
  } catch (error) {
    console.error('Error updating consultant:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid data', errors: error.errors });
    }
    res.status(500).json({ message: 'Failed to update consultant' });
  }
});

// Delete consultant
router.delete('/consultants/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if consultant has associated requirements or interviews
    const consultant = await db.query.consultants.findFirst({
      where: eq(consultants.id, id),
      with: {
        requirements: { limit: 1 },
        interviews: { limit: 1 },
      }
    });
    
    if (!consultant) {
      return res.status(404).json({ message: 'Consultant not found' });
    }
    
    if (consultant.requirements.length > 0 || consultant.interviews.length > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete consultant with associated requirements or interviews. Please reassign or remove them first.' 
      });
    }
    
    const [deletedConsultant] = await db
      .delete(consultants)
      .where(eq(consultants.id, id))
      .returning();

    res.json({ message: 'Consultant deleted successfully' });
  } catch (error) {
    console.error('Error deleting consultant:', error);
    res.status(500).json({ message: 'Failed to delete consultant' });
  }
});

// REQUIREMENTS ROUTES

// Get all requirements with filters
router.get('/requirements', async (req, res) => {
  try {
    const { status, consultantId, clientCompany, dateFrom, dateTo, page = '1', limit = '50' } = req.query;
    
    let whereConditions: any[] = [];
    
    if (status && status !== 'All') {
      whereConditions.push(eq(requirements.status, status as string));
    }
    // Consultant filtering removed
    if (clientCompany) {
      whereConditions.push(like(requirements.clientCompany, `%${clientCompany}%`));
    }
    if (dateFrom) {
      whereConditions.push(gte(requirements.createdAt, new Date(dateFrom as string)));
    }
    if (dateTo) {
      whereConditions.push(lte(requirements.createdAt, new Date(dateTo as string)));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;
    
    const allRequirements = await db.query.requirements.findMany({
      where: whereClause,
      with: {
        interviews: true,
        createdByUser: {
          columns: { firstName: true, lastName: true, email: true }
        }
      },
      orderBy: [desc(requirements.createdAt)],
      limit: parseInt(limit as string),
      offset: (parseInt(page as string) - 1) * parseInt(limit as string),
    });

    res.json(allRequirements);
  } catch (error) {
    console.error('Error fetching requirements:', error);
    res.status(500).json({ message: 'Failed to fetch requirements' });
  }
});

// Get requirement by ID
router.get('/requirements/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const requirement = await db.query.requirements.findFirst({
      where: eq(requirements.id, id),
      with: {
        interviews: true,
        createdByUser: {
          columns: { firstName: true, lastName: true, email: true }
        }
      },
    });

    if (!requirement) {
      return res.status(404).json({ message: 'Requirement not found' });
    }

    res.json(requirement);
  } catch (error) {
    console.error('Error fetching requirement:', error);
    res.status(500).json({ message: 'Failed to fetch requirement' });
  }
});

// Create requirement (single or bulk)
router.post('/requirements', async (req, res) => {
  try {
    const { requirements: reqArray, single } = req.body;
    
    if (single) {
      // Single requirement
      const requirementData = insertRequirementSchema.parse({
        ...req.body,
        createdBy: req.user!.id,
        marketingComments: []
      });
      
      const [newRequirement] = await db.insert(requirements).values(requirementData).returning();
      res.status(201).json(newRequirement);
    } else {
      // Bulk requirements
      if (!Array.isArray(reqArray) || reqArray.length === 0) {
        return res.status(400).json({ message: 'Requirements array is required for bulk creation' });
      }

      const requirementDataArray = reqArray.map(req => insertRequirementSchema.parse({
        ...req,
        createdBy: req.user!.id,
        marketingComments: []
      }));

      const newRequirements = await db.insert(requirements).values(requirementDataArray).returning();
      res.status(201).json(newRequirements);
    }
  } catch (error) {
    console.error('Error creating requirements:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid data', errors: error.errors });
    }
    res.status(500).json({ message: 'Failed to create requirements' });
  }
});

// Update requirement
router.patch('/requirements/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = insertRequirementSchema.partial().parse(req.body);
    
    const [updatedRequirement] = await db
      .update(requirements)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(requirements.id, id))
      .returning();

    if (!updatedRequirement) {
      return res.status(404).json({ message: 'Requirement not found' });
    }

    res.json(updatedRequirement);
  } catch (error) {
    console.error('Error updating requirement:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid data', errors: error.errors });
    }
    res.status(500).json({ message: 'Failed to update requirement' });
  }
});

// Add comment to requirement
router.post('/requirements/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    const { comment } = req.body;

    if (!comment || typeof comment !== 'string') {
      return res.status(400).json({ message: 'Comment is required' });
    }

    // Get current requirement
    const requirement = await db.query.requirements.findFirst({
      where: eq(requirements.id, id),
    });

    if (!requirement) {
      return res.status(404).json({ message: 'Requirement not found' });
    }

    // Add new comment to the array
    const newComment: MarketingComment = {
      comment,
      timestamp: new Date(),
      userId: req.user!.id,
      userName: (req.user as any).firstName ? `${(req.user as any).firstName} ${(req.user as any).lastName || ''}`.trim() : req.user!.email
    };

    const currentComments = Array.isArray(requirement.marketingComments) ? requirement.marketingComments as MarketingComment[] : [];
    const updatedComments = [...currentComments, newComment];

    const [updatedRequirement] = await db
      .update(requirements)
      .set({ 
        marketingComments: updatedComments as any,
        updatedAt: new Date() 
      })
      .where(eq(requirements.id, id))
      .returning();

    res.json(updatedRequirement);
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ message: 'Failed to add comment' });
  }
});

// Delete requirement
router.delete('/requirements/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [deletedRequirement] = await db
      .delete(requirements)
      .where(eq(requirements.id, id))
      .returning();

    if (!deletedRequirement) {
      return res.status(404).json({ message: 'Requirement not found' });
    }

    res.json({ message: 'Requirement deleted successfully' });
  } catch (error) {
    console.error('Error deleting requirement:', error);
    res.status(500).json({ message: 'Failed to delete requirement' });
  }
});

// INTERVIEWS ROUTES

// Get all interviews with filters
router.get('/interviews', async (req, res) => {
  try {
    const { status, consultantId, requirementId, dateFrom, dateTo, page = '1', limit = '50' } = req.query;
    
    let whereConditions: any[] = [];
    
    if (status && status !== 'All') {
      whereConditions.push(eq(interviews.status, status as string));
    }
    // Consultant filtering removed
    if (requirementId) {
      whereConditions.push(eq(interviews.requirementId, requirementId as string));
    }
    if (dateFrom) {
      whereConditions.push(gte(interviews.interviewDate, new Date(dateFrom as string)));
    }
    if (dateTo) {
      whereConditions.push(lte(interviews.interviewDate, new Date(dateTo as string)));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;
    
    const allInterviews = await db.query.interviews.findMany({
      where: whereClause,
      with: {
        requirement: true,
        marketingPerson: {
          columns: { firstName: true, lastName: true, email: true }
        },
        createdByUser: {
          columns: { firstName: true, lastName: true, email: true }
        }
      },
      orderBy: [desc(interviews.interviewDate)],
      limit: parseInt(limit as string),
      offset: (parseInt(page as string) - 1) * parseInt(limit as string),
    });

    res.json(allInterviews);
  } catch (error) {
    console.error('Error fetching interviews:', error);
    res.status(500).json({ message: 'Failed to fetch interviews' });
  }
});

// Get interview by ID
router.get('/interviews/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const interview = await db.query.interviews.findFirst({
      where: eq(interviews.id, id),
      with: {
        requirement: true,
        marketingPerson: {
          columns: { firstName: true, lastName: true, email: true }
        },
        createdByUser: {
          columns: { firstName: true, lastName: true, email: true }
        }
      },
    });

    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }

    res.json(interview);
  } catch (error) {
    console.error('Error fetching interview:', error);
    res.status(500).json({ message: 'Failed to fetch interview' });
  }
});

// Create interview
router.post('/interviews', async (req, res) => {
  try {
    const interviewData = insertInterviewSchema.parse({
      ...req.body,
      createdBy: req.user!.id
    });
    
    const [newInterview] = await db.insert(interviews).values(interviewData).returning();
    res.status(201).json(newInterview);
  } catch (error) {
    console.error('Error creating interview:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid data', errors: error.errors });
    }
    res.status(500).json({ message: 'Failed to create interview' });
  }
});

// Update interview
router.patch('/interviews/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = insertInterviewSchema.partial().parse(req.body);
    
    const [updatedInterview] = await db
      .update(interviews)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(interviews.id, id))
      .returning();

    if (!updatedInterview) {
      return res.status(404).json({ message: 'Interview not found' });
    }

    res.json(updatedInterview);
  } catch (error) {
    console.error('Error updating interview:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid data', errors: error.errors });
    }
    res.status(500).json({ message: 'Failed to update interview' });
  }
});

// Delete interview
router.delete('/interviews/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [deletedInterview] = await db
      .delete(interviews)
      .where(eq(interviews.id, id))
      .returning();

    if (!deletedInterview) {
      return res.status(404).json({ message: 'Interview not found' });
    }

    res.json({ message: 'Interview deleted successfully' });
  } catch (error) {
    console.error('Error deleting interview:', error);
    res.status(500).json({ message: 'Failed to delete interview' });
  }
});

// OAUTH2 ROUTES

// Gmail OAuth2 - Get authorization URL
router.get('/oauth/gmail/auth', async (req, res) => {
  try {
    const authUrl = GmailOAuthService.getAuthUrl(req.user!.id);
    res.json({ authUrl });
  } catch (error) {
    console.error('Error generating Gmail auth URL:', error);
    res.status(500).json({ message: 'Failed to generate authorization URL' });
  }
});

// Gmail OAuth2 - Handle callback (GET for OAuth redirect with query params)
router.get('/oauth/gmail/callback', async (req, res) => {
  try {
    const code = String(req.query.code || '');
    if (!code) {
      return res.status(400).send('<html><body>Missing authorization code</body></html>');
    }

    const result = await GmailOAuthService.handleCallback(code, req.user!.id);

    const success = !!result.success;
    const msg = success ? 'Gmail account connected successfully' : (result.error || 'Failed to connect Gmail account');

    // Return a tiny HTML page that notifies the opener window and closes.
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Gmail OAuth</title></head><body>
<script>
  (function(){
    try {
      if (window.opener) {
        window.opener.postMessage({ type: 'GMAIL_OAUTH_SUCCESS', success: ${success ? 'true' : 'false'}, message: ${JSON.stringify(msg)} }, '*');
      }
    } catch (e) {}
    window.close();
  })();
</script>
<p>${msg}. You may close this window.</p>
</body></html>`;
    res.setHeader('Content-Type', 'text/html');
    return res.status(success ? 200 : 400).send(html);
  } catch (error) {
    console.error('Error handling Gmail callback (GET):', error);
    res.status(500).send('<html><body>Failed to process Gmail authorization</body></html>');
  }
});

// Gmail OAuth2 - Handle callback (legacy POST support if popup posts code)
router.post('/oauth/gmail/callback', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ message: 'Authorization code is required' });
    }

    const result = await GmailOAuthService.handleCallback(code, req.user!.id);
    
    if (result.success) {
      res.json({ 
        success: true, 
        account: result.account,
        message: 'Gmail account connected successfully' 
      });
    } else {
      res.status(400).json({ 
        success: false, 
        message: result.error || 'Failed to connect Gmail account' 
      });
    }
  } catch (error) {
    console.error('Error handling Gmail callback:', error);
    res.status(500).json({ message: 'Failed to process Gmail authorization' });
  }
});

// Outlook OAuth2 - Get authorization URL
router.get('/oauth/outlook/auth', async (req, res) => {
  try {
    const authUrl = OutlookOAuthService.getAuthUrl(req.user!.id);
    res.json({ authUrl });
  } catch (error) {
    console.error('Error generating Outlook auth URL:', error);
    res.status(500).json({ message: 'Failed to generate authorization URL' });
  }
});

// Outlook OAuth2 - Handle callback (GET for OAuth redirect with query params)
router.get('/oauth/outlook/callback', async (req, res) => {
  try {
    const code = String(req.query.code || '');
    if (!code) {
      return res.status(400).send('<html><body>Missing authorization code</body></html>');
    }

    const result = await OutlookOAuthService.handleCallback(code, req.user!.id);

    const success = !!result.success;
    const msg = success ? 'Outlook account connected successfully' : (result.error || 'Failed to connect Outlook account');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Outlook OAuth</title></head><body>
<script>
  (function(){
    try {
      if (window.opener) {
        window.opener.postMessage({ type: 'OUTLOOK_OAUTH_SUCCESS', success: ${success ? 'true' : 'false'}, message: ${JSON.stringify(msg)} }, '*');
      }
    } catch (e) {}
    window.close();
  })();
</script>
<p>${msg}. You may close this window.</p>
</body></html>`;
    res.setHeader('Content-Type', 'text/html');
    return res.status(success ? 200 : 400).send(html);
  } catch (error) {
    console.error('Error handling Outlook callback (GET):', error);
    res.status(500).send('<html><body>Failed to process Outlook authorization</body></html>');
  }
});

// Outlook OAuth2 - Handle callback (legacy POST support)
router.post('/oauth/outlook/callback', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({ message: 'Authorization code is required' });
    }

    const result = await OutlookOAuthService.handleCallback(code, req.user!.id);
    
    if (result.success) {
      res.json({ 
        success: true, 
        account: result.account,
        message: 'Outlook account connected successfully' 
      });
    } else {
      res.status(400).json({ 
        success: false, 
        message: result.error || 'Failed to connect Outlook account' 
      });
    }
  } catch (error) {
    console.error('Error handling Outlook callback:', error);
    res.status(500).json({ message: 'Failed to process Outlook authorization' });
  }
});

// EMAIL ACCOUNT ROUTES

// Get user's email accounts
router.get('/email-accounts', async (req, res) => {
  try {
    const accounts = await db.query.emailAccounts.findMany({
      where: eq(emailAccounts.userId, req.user!.id),
      orderBy: [desc(emailAccounts.isDefault), desc(emailAccounts.createdAt)],
    });

    // Don't return sensitive data
    const safeAccounts = accounts.map(account => ({
      ...account,
      accessToken: undefined,
      refreshToken: undefined,
      password: undefined,
    }));

    res.json(safeAccounts);
  } catch (error) {
    console.error('Error fetching email accounts:', error);
    res.status(500).json({ message: 'Failed to fetch email accounts' });
  }
});

// Create email account
router.post('/email-accounts', async (req, res) => {
  try {
    const accountData = insertEmailAccountSchema.parse({
      ...req.body,
      userId: req.user!.id,
    });

    // If this is the first account or marked as default, make it default
    if (accountData.isDefault) {
      // Remove default from other accounts
      await db.update(emailAccounts)
        .set({ isDefault: false })
        .where(eq(emailAccounts.userId, req.user!.id));
    }

    const [newAccount] = await db.insert(emailAccounts).values(accountData).returning();

    // Don't return sensitive data
    const safeAccount = {
      ...newAccount,
      accessToken: undefined,
      refreshToken: undefined,
      password: undefined,
    };

    res.status(201).json(safeAccount);
  } catch (error) {
    console.error('Error creating email account:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid data', errors: error.errors });
    }
    res.status(500).json({ message: 'Failed to create email account' });
  }
});

// Update email account
router.patch('/email-accounts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = insertEmailAccountSchema.partial().parse(req.body);

    // Verify ownership
    const account = await db.query.emailAccounts.findFirst({
      where: and(
        eq(emailAccounts.id, id),
        eq(emailAccounts.userId, req.user!.id)
      )
    });

    if (!account) {
      return res.status(404).json({ message: 'Email account not found' });
    }

    // If setting as default, remove default from other accounts
    if (updateData.isDefault) {
      await db.update(emailAccounts)
        .set({ isDefault: false })
        .where(and(
          eq(emailAccounts.userId, req.user!.id),
          sql`${emailAccounts.id} != ${id}`
        ));
    }

    const [updatedAccount] = await db
      .update(emailAccounts)
      .set({ ...updateData, updatedAt: new Date() })
      .where(eq(emailAccounts.id, id))
      .returning();

    // Don't return sensitive data
    const safeAccount = {
      ...updatedAccount,
      accessToken: undefined,
      refreshToken: undefined,
      password: undefined,
    };

    res.json(safeAccount);
  } catch (error) {
    console.error('Error updating email account:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Invalid data', errors: error.errors });
    }
    res.status(500).json({ message: 'Failed to update email account' });
  }
});

// Delete email account
router.delete('/email-accounts/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const account = await db.query.emailAccounts.findFirst({
      where: and(
        eq(emailAccounts.id, id),
        eq(emailAccounts.userId, req.user!.id)
      )
    });

    if (!account) {
      return res.status(404).json({ message: 'Email account not found' });
    }

    await db.delete(emailAccounts).where(eq(emailAccounts.id, id));

    res.json({ message: 'Email account deleted successfully' });
  } catch (error) {
    console.error('Error deleting email account:', error);
    res.status(500).json({ message: 'Failed to delete email account' });
  }
});

// Test email account connection
router.post('/email-accounts/:id/test', async (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const account = await db.query.emailAccounts.findFirst({
      where: and(
        eq(emailAccounts.id, id),
        eq(emailAccounts.userId, req.user!.id)
      )
    });

    if (!account) {
      return res.status(404).json({ message: 'Email account not found' });
    }

    // Test connection using multi-account service
    const testResult = await MultiAccountEmailService.testAccountConnection(id);
    
    res.json({ 
      success: testResult.success, 
      message: testResult.success ? 'Connection test successful' : testResult.error,
      provider: account.provider 
    });
  } catch (error) {
    console.error('Error testing email account:', error);
    res.status(500).json({ message: 'Failed to test email account' });
  }
});

// Sync emails from account
router.post('/email-accounts/:id/sync', async (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const account = await db.query.emailAccounts.findFirst({
      where: and(
        eq(emailAccounts.id, id),
        eq(emailAccounts.userId, req.user!.id)
      )
    });

    if (!account) {
      return res.status(404).json({ message: 'Email account not found' });
    }

    if (!account.isActive) {
      return res.status(400).json({ message: 'Account is not active' });
    }

    // Sync emails using multi-account service
    const syncResult = await EmailSyncService.syncAccountOnDemand(id, req.user!.id);
    
    if (syncResult.success) {
      res.json({ 
        success: true,
        message: `Synced ${syncResult.syncedCount} new emails`,
        syncedCount: syncResult.syncedCount,
        lastSyncAt: new Date().toISOString()
      });
    } else {
      res.status(500).json({
        success: false,
        message: syncResult.error || 'Sync failed'
      });
    }
  } catch (error) {
    console.error('Error syncing emails:', error);
    res.status(500).json({ 
      message: 'Failed to sync emails',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get account mailboxes
router.get('/email-accounts/:id/mailboxes', async (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const account = await db.query.emailAccounts.findFirst({
      where: and(
        eq(emailAccounts.id, id),
        eq(emailAccounts.userId, req.user!.id)
      )
    });

    if (!account) {
      return res.status(404).json({ message: 'Email account not found' });
    }

    // Get mailboxes
    const mailboxes = await ImapService.getMailboxes(account as any);
    
    res.json({ mailboxes });
  } catch (error) {
    console.error('Error getting mailboxes:', error);
    res.status(500).json({ message: 'Failed to get mailboxes' });
  }
});

// Sync management routes
router.get('/sync/status', async (req, res) => {
  try {
    const status = EmailSyncService.getSyncStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting sync status:', error);
    res.status(500).json({ message: 'Failed to get sync status' });
  }
});

router.post('/sync/start', async (req, res) => {
  try {
    await EmailSyncService.startBackgroundSync();
    res.json({ message: 'Background sync started successfully' });
  } catch (error) {
    console.error('Error starting background sync:', error);
    res.status(500).json({ message: 'Failed to start background sync' });
  }
});

router.post('/sync/stop', async (req, res) => {
  try {
    await EmailSyncService.stopBackgroundSync();
    res.json({ message: 'Background sync stopped successfully' });
  } catch (error) {
    console.error('Error stopping background sync:', error);
    res.status(500).json({ message: 'Failed to stop background sync' });
  }
});

router.get('/email-accounts/:id/sync-stats', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Verify ownership
    const account = await db.query.emailAccounts.findFirst({
      where: and(
        eq(emailAccounts.id, id),
        eq(emailAccounts.userId, req.user!.id)
      )
    });

    if (!account) {
      return res.status(404).json({ message: 'Email account not found' });
    }

    const stats = await EmailSyncService.getAccountSyncStats(id);
    res.json(stats);
  } catch (error) {
    console.error('Error getting sync stats:', error);
    res.status(500).json({ message: 'Failed to get sync stats' });
  }
});

// EMAIL ROUTES

// Search emails
router.get('/emails/search', async (req, res) => {
  try {
    const { q, page = '1', limit = '20' } = req.query;
    
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ message: 'Search query is required' });
    }
    
    const searchTerm = `%${q}%`;
    
    // Search in email messages
    const messages = await db.query.emailMessages.findMany({
      where: and(
        eq(emailMessages.createdBy, req.user!.id),
        or(
          like(emailMessages.subject, searchTerm),
          like(emailMessages.textBody, searchTerm),
          like(emailMessages.htmlBody, searchTerm),
          like(emailMessages.fromEmail, searchTerm),
          sql`array_to_string(${emailMessages.toEmails}, ',') LIKE ${searchTerm}`
        )
      ),
      with: {
        attachments: true
      },
      orderBy: [desc(emailMessages.sentAt)],
      limit: parseInt(limit as string),
      offset: (parseInt(page as string) - 1) * parseInt(limit as string),
    });
    
    // Get unique thread IDs from search results
    const threadIds = [...new Set(messages.map(m => m.threadId))];
    
    // Get thread info for these messages
    const threads = await db.query.emailThreads.findMany({
      where: and(
        eq(emailThreads.createdBy, req.user!.id),
        sql`${emailThreads.id} = ANY(${threadIds})`
      ),
      with: {
        messages: {
          limit: 1,
          orderBy: [desc(emailMessages.sentAt)]
        }
      }
    });
    
    res.json({ messages, threads, total: messages.length });
  } catch (error) {
    console.error('Error searching emails:', error);
    res.status(500).json({ message: 'Failed to search emails' });
  }
});

// Get email threads
router.get('/emails/threads', async (req, res) => {
  try {
    const { type = 'inbox', page = '1', limit = '20', search } = req.query;
    
    let whereConditions: any[] = [eq(emailThreads.createdBy, req.user!.id)];
    
    // Add conditions based on email type
    if (type === 'archived') {
      whereConditions.push(eq(emailThreads.isArchived, true));
    } else if (type === 'inbox') {
      whereConditions.push(eq(emailThreads.isArchived, false));
    }

    const whereClause = and(...whereConditions);
    
    const threads = await db.query.emailThreads.findMany({
      where: whereClause,
      with: {
        messages: {
          limit: 1,
          orderBy: [desc(emailMessages.sentAt)],
          columns: {
            fromEmail: true,
            subject: true,
            sentAt: true,
            isRead: true,
            messageType: true,
            textBody: true,
            htmlBody: true
          }
        }
      },
      orderBy: [desc(emailThreads.lastMessageAt)],
      limit: parseInt(limit as string),
      offset: (parseInt(page as string) - 1) * parseInt(limit as string),
    });

    // Add preview to each thread from the latest message
    const threadsWithPreview = threads.map(thread => {
      const latestMessage = thread.messages?.[0];
      let preview = '';

      if (latestMessage) {
        const text = latestMessage.textBody || latestMessage.htmlBody?.replace(/<[^>]*>/g, '') || '';
        preview = text.slice(0, 100) + (text.length > 100 ? '...' : '');
      }

      return {
        ...thread,
        preview
      };
    });

    res.json(threadsWithPreview);
  } catch (error) {
    console.error('Error fetching email threads:', error);
    res.status(500).json({ message: 'Failed to fetch email threads' });
  }
});

// Get total unread messages count for inbox and per-account breakdown
router.get('/emails/unread-count', async (req, res) => {
  try {
    const { emailMessages, emailThreads, emailAccounts } = await import('@shared/schema');

    // Total unread messages for non-archived threads
    const totalResult = await db.select({ count: sql`COUNT(*)` }).from(emailMessages)
      .where(and(
        eq(emailMessages.createdBy, req.user!.id),
        eq(emailMessages.isRead, false),
        sql`EXISTS (select 1 from email_threads t where t.id = ${emailMessages.threadId} and t.created_by = ${req.user!.id} and (t.is_archived = FALSE or t.is_archived IS NULL))`
      ));

    const totalRow: any = totalResult && totalResult[0];
    const rawTotal = totalRow?.count ?? 0;
    const totalUnread = typeof rawTotal === 'string' ? parseInt(rawTotal, 10) : Number(rawTotal || 0);

    // Per-account unread counts
    // Group by email_account_id
    const perAccountRows: any[] = await db.select({ accountId: emailMessages.emailAccountId, count: sql`COUNT(*)` })
      .from(emailMessages)
      .where(and(
        eq(emailMessages.createdBy, req.user!.id),
        eq(emailMessages.isRead, false),
        sql`EXISTS (select 1 from email_threads t where t.id = ${emailMessages.threadId} and t.created_by = ${req.user!.id} and (t.is_archived = FALSE or t.is_archived IS NULL))`
      ))
      .groupBy(emailMessages.emailAccountId);

    // Map to include account metadata
    const accountIds = perAccountRows.map(r => r.accountId).filter(Boolean);
    let accountsById: Record<string, any> = {};
    if (accountIds.length > 0) {
      // Fetch all accounts for the user and map locally to avoid driver-specific 'in' helpers
      const accountRows = await db.select().from(emailAccounts).where(eq(emailAccounts.userId, req.user!.id));
      accountsById = (accountRows || []).reduce((acc: any, a: any) => ({ ...acc, [a.id]: a }), {});
    }

    const perAccount = perAccountRows.map((r: any) => {
      const raw = r.count;
      const c = typeof raw === 'string' ? parseInt(raw, 10) : Number(raw || 0);
      const acct = r.accountId ? accountsById[r.accountId] : null;
      return {
        accountId: r.accountId || null,
        accountName: acct?.accountName || acct?.emailAddress || null,
        emailAddress: acct?.emailAddress || null,
        unreadCount: c,
      };
    });

    res.json({ unreadCount: totalUnread, perAccount });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ message: 'Failed to fetch unread count' });
  }
});

// Get messages in a thread
router.get('/emails/threads/:threadId/messages', async (req, res) => {
  try {
    const { threadId } = req.params;
    
    const messages = await db.query.emailMessages.findMany({
      where: eq(emailMessages.threadId, threadId),
      with: {
        attachments: true
      },
      orderBy: [asc(emailMessages.sentAt)],
    });

    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Failed to fetch messages' });
  }
});

// Send email
router.post('/emails/send', upload.array('attachments'), async (req, res) => {
  try {
    const {
      to,
      cc = [],
      bcc = [],
      subject,
      htmlBody,
      textBody,
      threadId,
      accountId, // New: specify which account to send from
    } = req.body;

    // Parse recipients
    const toEmails = Array.isArray(to) ? to : [to];
    const ccEmails = Array.isArray(cc) ? cc : (cc ? [cc] : []);
    const bccEmails = Array.isArray(bcc) ? bcc : (bcc ? [bcc] : []);

    // Handle attachments
    const files = req.files as Express.Multer.File[];
    const attachmentData = files?.map(file => ({
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      fileContent: file.buffer.toString('base64'),
    })) || [];

    // Get sending account (use specified or default)
    let sendingAccount;
    if (accountId) {
      sendingAccount = await db.query.emailAccounts.findFirst({
        where: and(
          eq(emailAccounts.id, accountId),
          eq(emailAccounts.userId, req.user!.id)
        )
      });
    } else {
      sendingAccount = await MultiAccountEmailService.getDefaultAccount(req.user!.id);
    }

    let finalThreadId = threadId;

    // Create thread if not provided
    if (!threadId) {
      const [newThread] = await db.insert(emailThreads).values({
        subject,
        participantEmails: [sendingAccount?.emailAddress || req.user!.email, ...toEmails],
        lastMessageAt: new Date(),
        messageCount: 0,
        createdBy: req.user!.id,
      }).returning();
      
      finalThreadId = newThread.id;
    }

    // Create message record
    const [message] = await db.insert(emailMessages).values({
      threadId: finalThreadId,
      emailAccountId: sendingAccount?.id,
      fromEmail: sendingAccount?.emailAddress || req.user!.email,
      toEmails,
      ccEmails,
      bccEmails,
      subject,
      htmlBody,
      textBody,
      messageType: 'sent',
      sentAt: new Date(),
      createdBy: req.user!.id,
    }).returning();

    // Save attachments
    if (attachmentData.length > 0) {
      await db.insert(emailAttachments).values(
        attachmentData.map(att => ({
          messageId: message.id,
          fileName: att.fileName,
          fileSize: att.fileSize,
          mimeType: att.mimeType,
          fileContent: att.fileContent,
        }))
      );
    }

    // Send email using multi-account service
    let sendResult: { success: boolean; messageId?: string; error?: string } = { success: false, error: 'No account configured' };
    
    if (sendingAccount) {
      sendResult = await MultiAccountEmailService.sendFromAccount(sendingAccount.id, {
        to: toEmails,
        cc: ccEmails,
        bcc: bccEmails,
        subject,
        htmlBody,
        textBody,
        attachments: files?.map(file => ({
          filename: file.originalname,
          content: file.buffer,
          contentType: file.mimetype,
        })),
      });
    } else {
      // Fallback to original SMTP service
      try {
        await EmailService.sendMarketingEmail(
          toEmails[0] || '',
          subject || 'No Subject',
          htmlBody || '',
          textBody || ''
        );
        sendResult = { success: true };
      } catch (smtpError) {
        sendResult = { success: false, error: 'SMTP fallback failed' };
      }
    }

    if (sendResult.success) {
      console.log('✅ Email sent successfully');
    } else {
      console.warn('⚠️ Email sending failed, but message saved:', sendResult.error);
    }

    // Update thread
    await db.update(emailThreads)
      .set({
        lastMessageAt: new Date(),
        messageCount: sql`${emailThreads.messageCount} + 1`,
      })
      .where(eq(emailThreads.id, finalThreadId));

    res.status(201).json({
      message: sendResult.success ? 'Email sent successfully' : 'Email saved but sending failed',
      messageId: message.id,
      threadId: finalThreadId,
      sendResult,
    });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ message: 'Failed to send email' });
  }
});
// Save draft
router.post('/emails/drafts', async (req, res) => {
  try {
    const { to, cc, bcc, subject, htmlBody, textBody } = req.body;
    
    // Create draft message without thread
    const [draftMessage] = await db.insert(emailMessages).values({
      threadId: '', // Will be set when sent
      fromEmail: req.user!.email,
      toEmails: to || [],
      ccEmails: cc || [],
      bccEmails: bcc || [],
      subject: subject || 'No Subject',
      htmlBody,
      textBody,
      messageType: 'draft',
      createdBy: req.user!.id
    }).returning();

    res.status(201).json(draftMessage);
  } catch (error) {
    console.error('Error saving draft:', error);
    res.status(500).json({ message: 'Failed to save draft' });
  }
});

// Get drafts
router.get('/emails/drafts', async (req, res) => {
  try {
    const drafts = await db.query.emailMessages.findMany({
      where: and(
        eq(emailMessages.createdBy, req.user!.id),
        eq(emailMessages.messageType, 'draft')
      ),
      orderBy: [desc(emailMessages.createdAt)],
    });

    res.json(drafts);
  } catch (error) {
    console.error('Error fetching drafts:', error);
    res.status(500).json({ message: 'Failed to fetch drafts' });
  }
});

// Delete email thread
router.delete('/emails/threads/:threadId', async (req, res) => {
  try {
    const { threadId } = req.params;
    
    // Verify ownership
    const thread = await db.query.emailThreads.findFirst({
      where: and(
        eq(emailThreads.id, threadId),
        eq(emailThreads.createdBy, req.user!.id)
      )
    });
    
    if (!thread) {
      return res.status(404).json({ message: 'Thread not found' });
    }
    
    // Delete messages first (cascade should handle this, but being explicit)
    await db.delete(emailMessages).where(eq(emailMessages.threadId, threadId));
    
    // Delete thread
    await db.delete(emailThreads).where(eq(emailThreads.id, threadId));
    
    res.json({ message: 'Thread deleted successfully' });
  } catch (error) {
    console.error('Error deleting thread:', error);
    res.status(500).json({ message: 'Failed to delete thread' });
  }
});

// REPORTS ROUTES REMOVED

export default router;