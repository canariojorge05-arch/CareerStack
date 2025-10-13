import { db } from '../server/db';
import { requirements, consultants, users, type InsertRequirement } from '../shared/schema';
import { randomUUID } from 'crypto';

// Sample data arrays for generating realistic requirements
const jobTitles = [
  'Senior Full Stack Developer', 'React Developer', 'Node.js Backend Developer',
  'DevOps Engineer', 'Cloud Solutions Architect', 'Frontend Developer',
  'Python Developer', 'Java Developer', 'Mobile App Developer',
  'Data Engineer', 'Machine Learning Engineer', 'QA Automation Engineer',
  'Product Manager', 'Scrum Master', 'UI/UX Designer',
  'Cybersecurity Analyst', 'Database Administrator', 'Site Reliability Engineer',
  'Blockchain Developer', 'AI/ML Researcher', 'Technical Lead',
  'Software Architect', 'Platform Engineer', 'Integration Developer',
  'API Developer', 'Microservices Developer', 'Cloud Engineer',
  'Kubernetes Engineer', 'Docker Specialist', 'AWS Solutions Architect',
  'Azure Developer', 'GCP Engineer', 'Salesforce Developer',
  'SharePoint Developer', 'Power BI Developer', 'Tableau Developer',
  'ETL Developer', 'Big Data Engineer', 'Hadoop Developer',
  'Spark Developer', 'Kafka Engineer', 'Redis Specialist',
  'MongoDB Developer', 'PostgreSQL DBA', 'MySQL Developer',
  'Oracle Developer', 'SQL Server DBA', 'Elasticsearch Developer',
  'GraphQL Developer', 'REST API Developer', 'SOAP Developer',
  'Microservices Architect', 'Event-Driven Architect', 'System Designer',
  'Performance Engineer', 'Security Engineer', 'Penetration Tester',
  'Compliance Analyst', 'Risk Analyst', 'Business Analyst',
  'Technical Writer', 'Documentation Specialist', 'Training Specialist',
  'Support Engineer', 'Field Engineer', 'Implementation Specialist',
  'Solutions Consultant', 'Pre-Sales Engineer', 'Post-Sales Engineer',
  'Customer Success Manager', 'Account Manager', 'Project Manager',
  'Program Manager', 'Delivery Manager', 'Operations Manager'
];

const companies = [
  'Microsoft', 'Google', 'Amazon', 'Apple', 'Meta', 'Netflix', 'Tesla',
  'Salesforce', 'Oracle', 'IBM', 'Intel', 'NVIDIA', 'Adobe', 'Uber',
  'Airbnb', 'Spotify', 'Slack', 'Zoom', 'Dropbox', 'Atlassian',
  'ServiceNow', 'Workday', 'Palantir', 'Snowflake', 'MongoDB',
  'Elastic', 'Redis Labs', 'Confluent', 'DataBricks', 'Stripe',
  'Square', 'PayPal', 'Visa', 'Mastercard', 'JPMorgan Chase',
  'Goldman Sachs', 'Morgan Stanley', 'Bank of America', 'Wells Fargo',
  'Citigroup', 'American Express', 'Capital One', 'Discover',
  'Fidelity', 'Vanguard', 'BlackRock', 'State Street', 'T. Rowe Price',
  'Charles Schwab', 'E*TRADE', 'TD Ameritrade', 'Interactive Brokers',
  'Robinhood', 'Coinbase', 'Kraken', 'Binance', 'FTX', 'Gemini',
  'Accenture', 'Deloitte', 'PwC', 'EY', 'KPMG', 'McKinsey',
  'Boston Consulting Group', 'Bain & Company', 'Capgemini', 'Cognizant',
  'Infosys', 'TCS', 'Wipro', 'HCL Technologies', 'Tech Mahindra'
];

const techStacks = [
  'React, Node.js, TypeScript, PostgreSQL',
  'Angular, .NET Core, C#, SQL Server',
  'Vue.js, Python, Django, MySQL',
  'React Native, Firebase, GraphQL',
  'Flutter, Dart, Firebase, MongoDB',
  'Java, Spring Boot, Hibernate, Oracle',
  'Python, FastAPI, Redis, Elasticsearch',
  'Go, Gin, PostgreSQL, Docker',
  'Rust, Actix, MongoDB, Kubernetes',
  'PHP, Laravel, MySQL, Redis',
  'Ruby, Rails, PostgreSQL, Sidekiq',
  'Scala, Akka, Cassandra, Kafka',
  'Kotlin, Spring Boot, MongoDB, RabbitMQ',
  'Swift, iOS, Core Data, Alamofire',
  'C++, Qt, SQLite, Boost',
  'JavaScript, Express.js, MongoDB, Socket.io',
  'TypeScript, NestJS, Prisma, PostgreSQL',
  'Python, Flask, SQLAlchemy, Celery',
  'Java, Micronaut, GraalVM, PostgreSQL',
  'C#, ASP.NET Core, Entity Framework, Azure SQL'
];

const statuses = ['New', 'In Progress', 'Submitted', 'Closed'];
const appliedForOptions = ['Rahul', 'Sarah Johnson', 'Mike Chen', 'Lisa Rodriguez'];
const remoteOptions = ['Fully Remote', 'Hybrid', 'On-site', 'Remote Friendly'];
const durations = ['3 months', '6 months', '1 year', '2 years', 'Permanent', 'Contract to Hire'];

const rates = [
  '$80/hour', '$90/hour', '$100/hour', '$110/hour', '$120/hour', '$130/hour',
  '$140/hour', '$150/hour', '$160/hour', '$170/hour', '$180/hour', '$190/hour',
  '$200/hour', '$220/hour', '$250/hour', '$300/hour'
];

const vendorCompanies = [
  'TechStaff Solutions', 'Global IT Staffing', 'Elite Consulting Group',
  'Premier Tech Resources', 'Innovative Staffing Partners', 'NextGen Talent',
  'Strategic IT Solutions', 'Professional Staffing Network', 'Apex Consulting',
  'Dynamic Workforce Solutions', 'Talent Bridge Partners', 'Core IT Staffing',
  'Advanced Technical Resources', 'Prime Consulting Group', 'Vertex Staffing',
  'Pinnacle IT Solutions', 'Excellence Staffing Partners', 'Summit Tech Resources'
];

function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function generateJobDescription(jobTitle: string, techStack: string): string {
  const descriptions = [
    `We are seeking an experienced ${jobTitle} to join our dynamic team. The ideal candidate will have strong expertise in ${techStack} and a passion for building scalable, high-performance applications.

Key Responsibilities:
• Design and develop robust, scalable applications using modern technologies
• Collaborate with cross-functional teams to deliver high-quality software solutions
• Participate in code reviews and maintain coding standards
• Optimize application performance and ensure security best practices
• Mentor junior developers and contribute to technical documentation
• Work in an Agile environment with continuous integration/deployment

Requirements:
• 5+ years of experience in software development
• Strong proficiency in ${techStack}
• Experience with cloud platforms (AWS/Azure/GCP)
• Knowledge of microservices architecture and containerization
• Excellent problem-solving and communication skills
• Bachelor's degree in Computer Science or equivalent experience`,

    `Join our innovative team as a ${jobTitle} and help us build the next generation of software solutions. We're looking for a talented professional with expertise in ${techStack}.

What you'll do:
• Architect and implement scalable software solutions
• Lead technical discussions and provide guidance on best practices
• Collaborate with product managers and designers to deliver exceptional user experiences
• Ensure code quality through testing and peer reviews
• Stay current with emerging technologies and industry trends
• Contribute to technical strategy and roadmap planning

What we're looking for:
• Proven experience with ${techStack}
• Strong understanding of software design patterns and principles
• Experience with DevOps practices and CI/CD pipelines
• Ability to work in a fast-paced, collaborative environment
• Excellent analytical and problem-solving skills
• Strong communication and leadership abilities`,

    `We have an exciting opportunity for a ${jobTitle} to work on cutting-edge projects using ${techStack}. This role offers the chance to work with the latest technologies and make a significant impact.

Your responsibilities:
• Develop and maintain high-quality software applications
• Implement automated testing strategies and ensure code coverage
• Collaborate with stakeholders to gather requirements and provide technical solutions
• Optimize system performance and scalability
• Participate in architectural decisions and technology evaluations
• Support production systems and troubleshoot issues

Required qualifications:
• Extensive experience with ${techStack}
• Strong background in software engineering principles
• Experience with database design and optimization
• Knowledge of security best practices and compliance requirements
• Ability to work independently and as part of a team
• Continuous learning mindset and adaptability to new technologies`
  ];
  
  return getRandomItem(descriptions);
}

async function generateTestRequirements() {
  console.log('🚀 Starting to generate test requirements and consultants...');
  
  try {
    // Get an existing user to use as createdBy (required field)
    const existingUsers = await db.query.users.findMany({
      columns: { id: true, email: true },
      limit: 1
    });
    
    if (existingUsers.length === 0) {
      throw new Error('No users found in database. Please create a user first before generating test data.');
    }
    
    const createdByUserId = existingUsers[0].id;
    console.log(`👤 Using user ${existingUsers[0].email} as creator for test data`);
    
    // Generate 5 test consultants first
    console.log('👥 Generating 5 test consultants...');
    const consultantNames = [
      'Rahul Sharma',
      'Priya Patel', 
      'Amit Kumar',
      'Sarah Johnson',
      'Michael Chen'
    ];
    
    const consultantEmails = [
      'rahul.sharma@email.com',
      'priya.patel@email.com',
      'amit.kumar@email.com', 
      'sarah.johnson@email.com',
      'michael.chen@email.com'
    ];
    
    
    const visaStatuses = ['H1B', 'Green Card', 'USC', 'L1', 'OPT'];
    const countries = ['India', 'USA', 'Canada', 'UK', 'Australia'];
    const locations = ['New York, NY', 'San Francisco, CA', 'Austin, TX', 'Seattle, WA', 'Chicago, IL'];
    
    const consultantsToCreate = [];
    
    for (let i = 0; i < 5; i++) {
      const consultant = {
        displayId: `CONST ID - ${i + 1}`,
        name: consultantNames[i],
        email: consultantEmails[i],
        phone: `+1-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
        address: getRandomItem(locations),
        visaStatus: getRandomItem(visaStatuses),
        countryOfOrigin: getRandomItem(countries),
        status: 'Active' as const,
        createdBy: createdByUserId
      };
      
      consultantsToCreate.push(consultant);
    }
    
    // Insert consultants
    const createdConsultants = await db.insert(consultants).values(consultantsToCreate).returning();
    console.log(`✅ Created ${createdConsultants.length} test consultants`);
    
    // Now get all consultants (existing + newly created) to assign requirements to
    const allConsultants = await db.query.consultants.findMany({
      columns: { id: true, name: true }
    });
    
    console.log(`📋 Total consultants available: ${allConsultants.length}`);
    
    // Generate 70 requirements for good testing
    const requirementsToCreate: InsertRequirement[] = [];
    const totalRequirements = 70;
    
    for (let i = 1; i <= totalRequirements; i++) {
      const jobTitle = getRandomItem(jobTitles);
      const clientCompany = getRandomItem(companies);
      const techStack = getRandomItem(techStacks);
      const status = getRandomItem(statuses);
      const appliedFor = getRandomItem(appliedForOptions);
      const remote = getRandomItem(remoteOptions);
      const duration = getRandomItem(durations);
      const rate = getRandomItem(rates);
      const vendorCompany = getRandomItem(vendorCompanies);
      
      // Assign to random consultant (if any exist)
      const consultantId = allConsultants.length > 0 
        ? (getRandomItem(allConsultants) as { id: string; name: string }).id 
        : null;
      
      const requirement = {
        displayId: `REQ ID - ${i}`,
        jobTitle,
        status,
        appliedFor,
        consultantId,
        rate,
        primaryTechStack: techStack,
        clientCompany,
        impName: `${clientCompany} Hiring Manager`,
        clientWebsite: `https://www.${clientCompany.toLowerCase().replace(/\s+/g, '')}.com`,
        impWebsite: `https://careers.${clientCompany.toLowerCase().replace(/\s+/g, '')}.com`,
        vendorCompany,
        vendorWebsite: `https://www.${vendorCompany.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')}.com`,
        vendorPersonName: `${getRandomItem(['John', 'Jane', 'Mike', 'Sarah', 'David', 'Lisa', 'Chris', 'Amy'])} ${getRandomItem(['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'])}`,
        vendorPhone: `+1-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
        vendorEmail: `contact@${vendorCompany.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '')}.com`,
        completeJobDescription: generateJobDescription(jobTitle, techStack),
        nextStep: getRandomItem([
          'Schedule technical interview',
          'Submit resume to client',
          'Await client feedback',
          'Prepare for final round',
          'Negotiate terms',
          'Complete background check',
          'Finalize contract details'
        ]),
        remote,
        duration,
        createdBy: createdByUserId
      };
      
      requirementsToCreate.push(requirement);
      
      if (i % 10 === 0) {
        console.log(`📝 Generated ${i}/${totalRequirements} requirements...`);
      }
    }
    
    // Insert requirements in batches to avoid overwhelming the database
    const batchSize = 10;
    let inserted = 0;
    
    for (let i = 0; i < requirementsToCreate.length; i += batchSize) {
      const batch = requirementsToCreate.slice(i, i + batchSize);
      
      await db.insert(requirements).values(batch);
      inserted += batch.length;
      
      console.log(`💾 Inserted batch ${Math.ceil((i + 1) / batchSize)} - Total: ${inserted}/${totalRequirements}`);
    }
    
    console.log(`✅ Successfully created 5 test consultants and ${totalRequirements} test requirements!`);
    console.log('🎯 You can now test both consultants and requirements sections with plenty of data');
    
  } catch (error) {
    console.error('❌ Error generating test requirements:', error);
    throw error;
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  generateTestRequirements()
    .then(() => {
      console.log('🏁 Test data generation completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Failed to generate test data:', error);
      process.exit(1);
    });
}

export { generateTestRequirements };
