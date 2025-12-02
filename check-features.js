// Feature Implementation Checker for Project Management Platform
// Run this with: node check-features.js

const fs = require('fs');
const path = require('path');

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Feature checks
const features = {
  'Real-time Socket.IO Updates': {
    files: [
      'backend/src/socket.ts',
      'backend/src/controllers/taskController.ts',
      'backend/src/controllers/projectController.ts'
    ],
    patterns: [
      /io\.emit\(['"]task:/,
      /io\.emit\(['"]project:/,
      /socket\.on\(/
    ],
    description: 'Check if Socket.IO events are emitted in controllers'
  },
  'Role-Based Access Control': {
    files: [
      'backend/src/middlewares/authorization.ts',
      'backend/src/routes/taskRoutes.ts',
      'backend/src/routes/projectRoutes.ts'
    ],
    patterns: [
      /authorize\(/,
      /checkRole/,
      /(admin|editor|viewer)/i,
      /\.use\(authorize/
    ],
    description: 'Check if authorization middleware is used in routes'
  },
  'File Uploads (Cloudinary)': {
    files: [
      'backend/src/config/cloudinary.ts',
      'backend/src/middlewares/upload.ts',
      'backend/src/controllers/uploadController.ts',
      'backend/src/routes/uploadRoutes.ts'
    ],
    patterns: [
      /cloudinary/i,
      /upload\./,
      /multer/
    ],
    description: 'Check Cloudinary integration'
  },
  'Comment System (Nested)': {
    files: [
      'backend/src/models/Comment.ts',
      'backend/src/controllers/commentController.ts',
      'backend/src/routes/commentRoutes.ts'
    ],
    patterns: [
      /parentId/i,
      /replies/i,
      /populate.*comment/i
    ],
    description: 'Check nested comment structure'
  },
  'Notifications (Backend)': {
    files: [
      'backend/src/models/Notification.ts',
      'backend/src/controllers/notificationController.ts',
      'backend/src/routes/notificationRoutes.ts'
    ],
    patterns: [
      /Notification\.create/,
      /notification/i
    ],
    description: 'Check notification system'
  },
  'Email Notifications': {
    files: [
      'backend/src/utils/mailer.ts',
      'backend/src/controllers/notificationController.ts'
    ],
    patterns: [
      /nodemailer/i,
      /sendMail/i,
      /transport\./
    ],
    description: 'Check email integration'
  },
  'Redis Caching': {
    files: [
      'backend/src/config/redisClient.ts',
      'backend/src/middlewares/cache.ts',
      'backend/src/routes/projectRoutes.ts'
    ],
    patterns: [
      /redis/i,
      /\.get\(.*key/,
      /\.setex\(/,
      /cache\(/
    ],
    description: 'Check if Redis is used for caching'
  },
  'Pagination': {
    files: [
      'backend/src/utils/paginate.ts',
      'backend/src/controllers/taskController.ts',
      'backend/src/controllers/projectController.ts'
    ],
    patterns: [
      /paginate/i,
      /skip.*limit/,
      /page.*limit/
    ],
    description: 'Check pagination implementation'
  },
  'Activity Logging': {
    files: [
      'backend/src/models/ActivityLog.ts',
      'backend/src/utils/activityLogger.ts',
      'backend/src/utils/logActivity.ts',
      'backend/src/controllers/taskController.ts'
    ],
    patterns: [
      /ActivityLog\.create/,
      /logActivity/i,
      /activityLogger/i
    ],
    description: 'Check activity logging'
  },
  'JWT Authentication': {
    files: [
      'backend/src/routes/authRoutes.ts',
      'backend/src/middlewares/authorization.ts'
    ],
    patterns: [
      /jwt/i,
      /sign\(/,
      /verify\(/,
      /bcrypt/i
    ],
    description: 'Check JWT + bcrypt authentication'
  },
  'Invite System': {
    files: [
      'backend/src/models/Invite.ts',
      'backend/src/controllers/taskInviteController.ts'
    ],
    patterns: [
      /Invite\.create/,
      /invite/i,
      /accept.*invite/i
    ],
    description: 'Check project invite system'
  },
  'Swagger Documentation': {
    files: [
      'backend/src/app.ts',
      'backend/src/server.ts',
      'package.json'
    ],
    patterns: [
      /swagger/i,
      /openapi/i,
      /swagger-ui-express/
    ],
    description: 'Check Swagger/OpenAPI docs'
  },
  'Docker Setup': {
    files: [
      'Dockerfile',
      'docker-compose.yml',
      '.dockerignore'
    ],
    patterns: [
      /FROM node/i,
      /WORKDIR/,
      /services:/
    ],
    description: 'Check Docker configuration'
  },
  'CI/CD (GitHub Actions)': {
    files: [
      '.github/workflows/main.yml',
      '.github/workflows/deploy.yml',
      '.github/workflows/ci.yml'
    ],
    patterns: [
      /on:.*push/,
      /runs-on:/,
      /actions\//
    ],
    description: 'Check GitHub Actions workflows'
  },
  'React Query (Frontend)': {
    files: [
      'frontend/src/hooks/useUpdateTask.ts',
      'package.json'
    ],
    patterns: [
      /@tanstack\/react-query/,
      /useQuery/,
      /useMutation/,
      /queryClient/i
    ],
    description: 'Check React Query implementation'
  },
  'Optimistic UI Updates': {
    files: [
      'frontend/src/hooks/useUpdateTask.ts'
    ],
    patterns: [
      /onMutate/,
      /setQueryData/,
      /rollback/i,
      /optimistic/i
    ],
    description: 'Check optimistic updates in React Query'
  }
};

function checkFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf-8');
    }
    return null;
  } catch (error) {
    return null;
  }
}

function checkFeature(featureName, config) {
  console.log(`\n${colors.cyan}Checking: ${featureName}${colors.reset}`);
  console.log(`${colors.blue}${config.description}${colors.reset}`);
  
  let filesFound = 0;
  let patternsMatched = 0;
  let totalFiles = config.files.length;
  
  for (const file of config.files) {
    const content = checkFile(file);
    
    if (content) {
      filesFound++;
      console.log(`  ${colors.green}✓${colors.reset} Found: ${file}`);
      
      // Check patterns
      let fileMatches = 0;
      for (const pattern of config.patterns) {
        if (pattern.test(content)) {
          fileMatches++;
        }
      }
      
      if (fileMatches > 0) {
        patternsMatched++;
        console.log(`    ${colors.green}→ Pattern matches: ${fileMatches}/${config.patterns.length}${colors.reset}`);
      } else {
        console.log(`    ${colors.yellow}→ No pattern matches found${colors.reset}`);
      }
    } else {
      console.log(`  ${colors.red}✗${colors.reset} Missing: ${file}`);
    }
  }
  
  // Determine status
  let status = 'missing';
  let statusColor = colors.red;
  let statusIcon = '✗';
  
  if (filesFound === totalFiles && patternsMatched === totalFiles) {
    status = 'complete';
    statusColor = colors.green;
    statusIcon = '✓';
  } else if (filesFound > 0 && patternsMatched > 0) {
    status = 'partial';
    statusColor = colors.yellow;
    statusIcon = '⚠';
  }
  
  console.log(`  ${statusColor}${statusIcon} Status: ${status.toUpperCase()}${colors.reset} (${filesFound}/${totalFiles} files, ${patternsMatched}/${totalFiles} with patterns)`);
  
  return { status, filesFound, totalFiles, patternsMatched };
}

function generateReport() {
  console.log(`${colors.cyan}
╔════════════════════════════════════════════════════════════╗
║   Project Management Platform - Feature Audit Report      ║
╚════════════════════════════════════════════════════════════╝
${colors.reset}`);
  
  const results = {};
  
  for (const [featureName, config] of Object.entries(features)) {
    results[featureName] = checkFeature(featureName, config);
  }
  
  // Summary
  console.log(`\n${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}SUMMARY:${colors.reset}\n`);
  
  const complete = Object.values(results).filter(r => r.status === 'complete').length;
  const partial = Object.values(results).filter(r => r.status === 'partial').length;
  const missing = Object.values(results).filter(r => r.status === 'missing').length;
  const total = Object.keys(features).length;
  
  const percentage = Math.round(((complete + partial * 0.5) / total) * 100);
  
  console.log(`${colors.green}✓ Complete:${colors.reset} ${complete}/${total} features`);
  console.log(`${colors.yellow}⚠ Partial:${colors.reset}  ${partial}/${total} features`);
  console.log(`${colors.red}✗ Missing:${colors.reset}  ${missing}/${total} features`);
  console.log(`\n${colors.cyan}Overall Progress: ${percentage}%${colors.reset}`);
  
  // Priority Actions
  console.log(`\n${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}PRIORITY ACTIONS:${colors.reset}\n`);
  
  const missingFeatures = Object.entries(results)
    .filter(([_, result]) => result.status === 'missing')
    .map(([name]) => name);
  
  const partialFeatures = Object.entries(results)
    .filter(([_, result]) => result.status === 'partial')
    .map(([name]) => name);
  
  if (missingFeatures.length > 0) {
    console.log(`${colors.red}Missing Features:${colors.reset}`);
    missingFeatures.forEach((name, i) => {
      console.log(`  ${i + 1}. ${name}`);
    });
  }
  
  if (partialFeatures.length > 0) {
    console.log(`\n${colors.yellow}Incomplete Features:${colors.reset}`);
    partialFeatures.forEach((name, i) => {
      console.log(`  ${i + 1}. ${name}`);
    });
  }
  
  console.log(`\n${colors.cyan}═══════════════════════════════════════════════════════════${colors.reset}\n`);
}

// Run the checker
try {
  generateReport();
} catch (error) {
  console.error(`${colors.red}Error running checker:${colors.reset}`, error.message);
  console.log(`\n${colors.yellow}Make sure you run this script from your project root directory.${colors.reset}`);
}