# Next Step Comments Integration Instructions

## Overview
This document provides instructions for integrating the new Next Step Comments functionality into the CareerStack application.

## Files Created/Modified

### Database
- ✅ `migrations/0008_next_step_comments.sql` - Database migration for next step comments table
- ✅ `shared/schema.ts` - Updated with nextStepComments table, relations, and types

### Backend
- ✅ `server/routes/nextStepCommentsRoutes.ts` - New API routes for next step comments CRUD operations

### Frontend
- ✅ `client/src/components/marketing/next-step-comments.tsx` - React component for managing next step comments
- ✅ `client/src/components/marketing/requirements-section.tsx` - Updated to include NextStepComments component in view dialog

## Integration Steps

### 1. Run Database Migration
```bash
# Run the migration to create the next_step_comments table
npm run db:migrate
```

### 2. Integrate API Routes
Add the following to your main server file (likely `server/index.ts` or `server/app.ts`):

```typescript
import nextStepCommentsRoutes from './routes/nextStepCommentsRoutes';

// Add this line with your other route registrations
app.use('/api/marketing', nextStepCommentsRoutes);
```

### 3. Update Marketing Routes (Alternative)
If you prefer to integrate directly into `marketingRoutes.ts`, copy the route handlers from `nextStepCommentsRoutes.ts` and add them to the existing marketing routes file.

## API Endpoints

The following new endpoints are available:

- `GET /api/marketing/requirements/:id/next-step-comments` - Get all comments for a requirement
- `POST /api/marketing/requirements/:id/next-step-comments` - Add a new comment
- `PATCH /api/marketing/next-step-comments/:id` - Update a comment (owner only)
- `DELETE /api/marketing/next-step-comments/:id` - Delete a comment (owner only)

## Features Implemented

### ✅ Completed Features
1. **Database Schema**: New `next_step_comments` table with proper relations
2. **API Endpoints**: Full CRUD operations for next step comments
3. **Authentication**: Only authenticated users can manage comments
4. **Authorization**: Users can only edit/delete their own comments
5. **UI Component**: Rich comment thread interface with:
   - Add new comments
   - Edit existing comments (owner only)
   - Delete comments (owner only)
   - Real-time updates
   - User attribution with timestamps
   - Responsive design

### 🔄 Migration Strategy
- Legacy `next_step` field is preserved for backward compatibility
- Existing next step data is migrated to the new comments table
- Old next step field is shown as "Legacy Next Step" in the UI

## Usage

1. **View Comments**: Navigate to Marketing → Requirements → Click "View" on any requirement
2. **Add Comment**: Click "Add Comment" button in the Next Step Comments section
3. **Edit Comment**: Click the edit icon on your own comments
4. **Delete Comment**: Click the trash icon on your own comments (with confirmation)

## Testing Checklist

- [ ] Database migration runs successfully
- [ ] API routes are accessible and functional
- [ ] Comments can be added, viewed, edited, and deleted
- [ ] Only comment owners can edit/delete their comments
- [ ] UI updates in real-time
- [ ] Legacy next step data is preserved and displayed
- [ ] Error handling works properly
- [ ] Loading states are shown appropriately

## Notes

- Comments are ordered by creation date (newest first)
- The component auto-refreshes every 30 seconds to show new comments
- All operations include proper error handling and user feedback
- Audit logging is implemented for all CRUD operations
- CSRF protection is applied to all write operations
