import { config } from 'dotenv';
config();

import { db } from '../server/db';
import { consultants, users } from '../shared/schema';

console.log('🚀 Quick Consultants Generator Starting...');

async function generateQuickConsultants() {
  try {
    console.log('👤 Getting user for consultants...');
    
    // Get the first user to use as createdBy
    const firstUser = await db.query.users.findFirst({
      columns: { id: true, email: true }
    });
    
    if (!firstUser) {
      throw new Error('No users found. Please create a user account first.');
    }
    
    console.log(`👤 Using user: ${firstUser.email} (${firstUser.id})`);
    console.log('👥 Generating 5 test consultants...');
    
    const consultantsData = [
      {
        name: 'Rahul Sharma',
        email: 'rahul.sharma@email.com',
        phone: '+1-555-001-0001',
        currentLocation: 'New York, NY',
        visaStatus: 'H1B',
        countryOfOrigin: 'India',
        techSkills: 'React, Node.js, TypeScript, AWS',
        experience: 8,
        currentRate: 120,
        availability: 'Immediate',
        status: 'Active',
        notes: 'Experienced React developer with strong background in full-stack development.',
        createdBy: firstUser.id
      },
      {
        name: 'Priya Patel',
        email: 'priya.patel@email.com', 
        phone: '+1-555-002-0002',
        currentLocation: 'San Francisco, CA',
        visaStatus: 'Green Card',
        countryOfOrigin: 'India',
        techSkills: 'Angular, .NET Core, Azure, SQL Server',
        experience: 6,
        currentRate: 110,
        availability: '2 weeks',
        status: 'Active',
        notes: 'Skilled Angular developer with extensive .NET experience.',
        createdBy: firstUser.id
      },
      {
        name: 'Amit Kumar',
        email: 'amit.kumar@email.com',
        phone: '+1-555-003-0003', 
        currentLocation: 'Austin, TX',
        visaStatus: 'USC',
        countryOfOrigin: 'USA',
        techSkills: 'Python, Django, PostgreSQL, Docker',
        experience: 10,
        currentRate: 130,
        availability: '1 month',
        status: 'Active',
        notes: 'Senior Python developer with DevOps expertise.',
        createdBy: firstUser.id
      },
      {
        name: 'Sarah Johnson',
        email: 'sarah.johnson@email.com',
        phone: '+1-555-004-0004',
        currentLocation: 'Seattle, WA', 
        visaStatus: 'USC',
        countryOfOrigin: 'USA',
        techSkills: 'Java, Spring Boot, Microservices, Kubernetes',
        experience: 7,
        currentRate: 115,
        availability: 'Immediate',
        status: 'Active',
        notes: 'Java architect with microservices and cloud experience.',
        createdBy: firstUser.id
      },
      {
        name: 'Michael Chen',
        email: 'michael.chen@email.com',
        phone: '+1-555-005-0005',
        currentLocation: 'Chicago, IL',
        visaStatus: 'L1',
        countryOfOrigin: 'Canada',
        techSkills: 'Vue.js, Express.js, MongoDB, Redis',
        experience: 5,
        currentRate: 105,
        availability: '2 weeks',
        status: 'Active', 
        notes: 'Full-stack JavaScript developer with modern framework expertise.',
        createdBy: firstUser.id
      }
    ];
    
    console.log('💾 Inserting consultants into database...');
    
    const createdConsultants = await db.insert(consultants).values(consultantsData).returning();
    
    console.log('🎉 Successfully created 5 test consultants!');
    console.log('👥 Consultants created:');
    createdConsultants.forEach((consultant, index) => {
      console.log(`   ${index + 1}. ${consultant.name} - ${consultant.techSkills?.split(',')[0]} Developer`);
    });
    console.log('🔍 Go to the consultants section to see them in action');
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

generateQuickConsultants()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('💥 Failed:', error);
    process.exit(1);
  });
