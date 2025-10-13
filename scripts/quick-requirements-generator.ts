import { config } from 'dotenv';
config();

import { db } from '../server/db';
import { requirements, users } from '../shared/schema';
import { randomUUID } from 'crypto';

console.log('🚀 Quick Requirements Generator Starting...');

// Simplified data for faster generation
const jobTitles = [
  'Senior Full Stack Developer', 'React Developer', 'Node.js Developer', 'Python Developer',
  'Java Developer', 'DevOps Engineer', 'Cloud Architect', 'Frontend Developer',
  'Backend Developer', 'Mobile Developer', 'Data Engineer', 'QA Engineer',
  'Product Manager', 'Scrum Master', 'UI/UX Designer', 'Security Analyst'
];

const companies = [
  'Microsoft', 'Google', 'Amazon', 'Apple', 'Meta', 'Netflix', 'Tesla', 'Salesforce',
  'Oracle', 'IBM', 'Adobe', 'Uber', 'Airbnb', 'Spotify', 'Slack', 'Zoom'
];

const techStacks = [
  'React, Node.js, TypeScript', 'Angular, .NET, C#', 'Vue.js, Python, Django',
  'Java, Spring Boot, MySQL', 'React Native, Firebase', 'Flutter, Dart, MongoDB'
];

const statuses = ['New', 'In Progress', 'Submitted', 'Closed'];

function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

async function generateQuickRequirements() {
  try {
    console.log('📝 Getting user for requirements...');
    
    // Get the first user to use as createdBy
    const firstUser = await db.query.users.findFirst({
      columns: { id: true, email: true }
    });
    
    if (!firstUser) {
      throw new Error('No users found. Please create a user account first.');
    }
    
    console.log(`👤 Using user: ${firstUser.email} (${firstUser.id})`);
    console.log('📝 Generating 70 test requirements...');
    
    const requirementsData = [];
    
    for (let i = 1; i <= 70; i++) {
      const jobTitle = getRandomItem(jobTitles);
      const clientCompany = getRandomItem(companies);
      
      requirementsData.push({
        id: randomUUID(),
        jobTitle: `${jobTitle} - ${i}`,
        status: getRandomItem(statuses),
        appliedFor: 'Rahul',
        consultantId: null,
        rate: `$${(Math.floor(Math.random() * 10) + 10) * 10}/hour`,
        primaryTechStack: getRandomItem(techStacks),
        clientCompany,
        impName: `${clientCompany} Hiring Manager`,
        clientWebsite: `https://www.${clientCompany.toLowerCase()}.com`,
        impWebsite: `https://careers.${clientCompany.toLowerCase()}.com`,
        vendorCompany: `Vendor Company ${i}`,
        vendorWebsite: `https://vendor${i}.com`,
        vendorPersonName: `Contact Person ${i}`,
        vendorPhone: `+1-555-000-${String(i).padStart(4, '0')}`,
        vendorEmail: `contact${i}@vendor.com`,
        completeJobDescription: `We are looking for an experienced ${jobTitle} to join our team at ${clientCompany}. 

Key Requirements:
• 5+ years of experience in software development
• Strong expertise in ${getRandomItem(techStacks)}
• Experience with cloud platforms and modern development practices
• Excellent problem-solving and communication skills
• Ability to work in a fast-paced, collaborative environment

This is a great opportunity to work on cutting-edge projects and grow your career with a leading technology company.`,
        nextStep: 'Submit resume and schedule initial interview',
        remote: getRandomItem(['Fully Remote', 'Hybrid', 'On-site']),
        duration: getRandomItem(['6 months', '1 year', 'Permanent']),
        createdBy: firstUser.id,
        createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        updatedAt: new Date()
      });
      
      if (i % 10 === 0) {
        console.log(`✅ Prepared ${i}/70 requirements`);
      }
    }
    
    console.log('💾 Inserting requirements into database...');
    
    // Insert in smaller batches
    const batchSize = 5;
    for (let i = 0; i < requirementsData.length; i += batchSize) {
      const batch = requirementsData.slice(i, i + batchSize);
      await db.insert(requirements).values(batch);
      console.log(`📊 Inserted batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(requirementsData.length/batchSize)}`);
    }
    
    console.log('🎉 Successfully created 70 test requirements!');
    console.log('🔍 Go to the marketing page to test the functionality');
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

generateQuickRequirements()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('💥 Failed:', error);
    process.exit(1);
  });
