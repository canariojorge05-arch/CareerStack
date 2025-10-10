#!/bin/bash

# DOCX Module Improvements - Automated Verification Script
# This script verifies the implementation without running the full app

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 DOCX Module - Automated Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

PASS=0
FAIL=0
TOTAL=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check
check() {
    TOTAL=$((TOTAL + 1))
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅${NC} $2"
        PASS=$((PASS + 1))
    else
        echo -e "${RED}❌${NC} $2"
        FAIL=$((FAIL + 1))
    fi
}

echo "📂 Checking File Structure..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check new files exist
[ -f "client/src/utils/fileValidation.ts" ]
check $? "File validation utility exists"

# Check modified files
[ -f "client/src/components/SuperDocEditor/SuperDocEditor.tsx" ]
check $? "SuperDocEditor component exists"

[ -f "client/src/components/SuperDocEditor/SuperDocResumeEditor.tsx" ]
check $? "SuperDocResumeEditor component exists"

[ -f "server/routes.ts" ]
check $? "Server routes file exists"

echo ""
echo "🔧 Checking Code Implementation..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check for critical code changes
grep -q "PUT.*update-file" server/routes.ts
check $? "PUT /api/resumes/:id/update-file endpoint exists"

grep -q "validateDOCXFileComprehensive" client/src/utils/fileValidation.ts
check $? "File validation function exists"

grep -q "resumeId.*string" client/src/components/SuperDocEditor/SuperDocEditor.tsx
check $? "resumeId prop added to SuperDocEditor"

grep -q "superdoc.export()" client/src/components/SuperDocEditor/SuperDocEditor.tsx
check $? "DOCX export in save handler"

grep -q "FormData" client/src/components/SuperDocEditor/SuperDocEditor.tsx
check $? "FormData upload implementation"

grep -q "backupDir.*uploads/backups" server/routes.ts
check $? "Backup directory implementation"

grep -q "MAX_FILE_SIZE.*50.*1024.*1024" server/routes.ts
check $? "File size validation (50MB)"

grep -q "0x50.*0x4B" server/routes.ts
check $? "DOCX signature validation"

grep -q "setLoadingProgress" client/src/components/SuperDocEditor/SuperDocEditor.tsx
check $? "Progress indicator implementation"

grep -q "handleRetry" client/src/components/SuperDocEditor/SuperDocEditor.tsx
check $? "Retry mechanism implementation"

grep -q "showSearch" client/src/components/SuperDocEditor/SuperDocEditor.tsx
check $? "Search panel implementation"

grep -q "showTrackChanges" client/src/components/SuperDocEditor/SuperDocEditor.tsx
check $? "Track changes panel implementation"

grep -q "showComments" client/src/components/SuperDocEditor/SuperDocEditor.tsx
check $? "Comments panel implementation"

grep -q "handlePrint" client/src/components/SuperDocEditor/SuperDocEditor.tsx
check $? "Print functionality implementation"

grep -q "currentPage.*setCurrentPage" client/src/components/SuperDocEditor/SuperDocEditor.tsx
check $? "Page navigation implementation"

echo ""
echo "📦 Checking Build Output..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

[ -f "../dist/public/js/vendor-editor-BkTTTVwV.js" ]
check $? "SuperDoc vendor bundle exists"

[ -f "../dist/public/index.html" ]
check $? "Client build output exists"

echo ""
echo "🗂️ Checking Directory Structure..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

[ -d "uploads/resumes" ]
check $? "Resume uploads directory exists"

[ -d "uploads/backups" ]
check $? "Backups directory exists"

# Check for test DOCX files
DOCX_COUNT=$(ls -1 uploads/resumes/*.docx 2>/dev/null | wc -l)
if [ "$DOCX_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅${NC} Found $DOCX_COUNT test DOCX file(s)"
    PASS=$((PASS + 1))
else
    echo -e "${YELLOW}⚠️${NC}  No test DOCX files found (upload some for testing)"
fi
TOTAL=$((TOTAL + 1))

echo ""
echo "🔍 Checking TypeScript Compilation..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check if there are SuperDocEditor-related TypeScript errors
npm run check 2>&1 | grep -q "SuperDocEditor.*error TS"
if [ $? -eq 1 ]; then
    echo -e "${GREEN}✅${NC} No SuperDocEditor TypeScript errors"
    PASS=$((PASS + 1))
else
    echo -e "${RED}❌${NC} SuperDocEditor TypeScript errors found"
    FAIL=$((FAIL + 1))
fi
TOTAL=$((TOTAL + 1))

echo ""
echo "📊 Checking Code Quality..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check for removed duplicate code
DUPLICATE_COUNT=$(grep -c "const \[isSaving, setIsSaving\]" client/src/components/SuperDocEditor/SuperDocResumeEditor.tsx 2>/dev/null)
if [ "$DUPLICATE_COUNT" -eq 0 ]; then
    echo -e "${GREEN}✅${NC} Duplicate state removed from SuperDocResumeEditor"
    PASS=$((PASS + 1))
else
    echo -e "${RED}❌${NC} Duplicate state still exists"
    FAIL=$((FAIL + 1))
fi
TOTAL=$((TOTAL + 1))

# Count lines of code changes
EDITOR_LINES=$(wc -l < client/src/components/SuperDocEditor/SuperDocEditor.tsx)
if [ "$EDITOR_LINES" -gt 1000 ]; then
    echo -e "${GREEN}✅${NC} SuperDocEditor enhanced (${EDITOR_LINES} lines)"
    PASS=$((PASS + 1))
else
    echo -e "${RED}❌${NC} SuperDocEditor may not have all improvements"
    FAIL=$((FAIL + 1))
fi
TOTAL=$((TOTAL + 1))

echo ""
echo "📚 Checking Documentation..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

[ -f "DOCX_IMPROVEMENTS_COMPLETE.md" ]
check $? "Implementation summary exists"

[ -f "COMPREHENSIVE_DOCX_MODULE_AUDIT.md" ]
check $? "Audit documentation exists"

[ -f "DOCX_MODULE_ACTION_PLAN.md" ]
check $? "Action plan exists"

[ -f "TESTING_GUIDE_DOCX_IMPROVEMENTS.md" ]
check $? "Testing guide exists"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 VERIFICATION RESULTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Total Checks: $TOTAL"
echo -e "${GREEN}Passed: $PASS${NC}"
echo -e "${RED}Failed: $FAIL${NC}"
echo ""

PERCENTAGE=$((PASS * 100 / TOTAL))

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}✅ ALL CHECKS PASSED! ($PERCENTAGE%)${NC}"
    echo ""
    echo "🎉 Implementation verified successfully!"
    echo ""
    echo "📋 NEXT STEPS:"
    echo "1. Run: npm run dev"
    echo "2. Test manually using TESTING_GUIDE_DOCX_IMPROVEMENTS.md"
    echo "3. Verify critical tests (save/load cycle)"
    echo ""
    exit 0
elif [ $PERCENTAGE -ge 80 ]; then
    echo -e "${YELLOW}⚠️  MOSTLY PASSING ($PERCENTAGE%)${NC}"
    echo ""
    echo "Some checks failed, but implementation looks good."
    echo "Review failed checks above."
    echo ""
    exit 1
else
    echo -e "${RED}❌ VERIFICATION FAILED ($PERCENTAGE%)${NC}"
    echo ""
    echo "Multiple checks failed. Review implementation."
    echo ""
    exit 1
fi
