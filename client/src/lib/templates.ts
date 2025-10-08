export interface ResumeTemplate {
  id: string;
  name: string;
  description: string;
  category: 'modern' | 'classic' | 'creative' | 'minimal' | 'executive';
  preview: string;
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  colorScheme: {
    primary: string;
    secondary: string;
    accent: string;
    text: string;
    background: string;
  };
  typography: {
    headings: string;
    body: string;
    size: string;
  };
  layout: {
    columns: 1 | 2 | 3;
    spacing: 'tight' | 'normal' | 'loose';
    margins: string;
  };
  generateContent: (data?: any) => string;
}

export const resumeTemplates: ResumeTemplate[] = [
  {
    id: 'modern-professional',
    name: 'Modern Professional',
    description: 'Clean, contemporary design perfect for tech and business roles',
    category: 'modern',
    preview: '/templates/modern-professional.png',
    tags: ['tech', 'business', 'clean', 'ats-friendly'],
    difficulty: 'beginner',
    colorScheme: {
      primary: '#2563eb',
      secondary: '#f8fafc',
      accent: '#06d6a0',
      text: '#1e293b',
      background: '#ffffff'
    },
    typography: {
      headings: 'Inter',
      body: 'Inter',
      size: '11pt'
    },
    layout: {
      columns: 1,
      spacing: 'normal',
      margins: '0.75in'
    },
    generateContent: (data = {}) => `
<div style="font-family: Inter, sans-serif; font-size: 11pt; line-height: 1.4; margin: 0; padding: 40px; max-width: 8.5in; background: white;">
  <!-- Header Section -->
  <header style="text-align: center; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 3px solid #2563eb;">
    <h1 style="font-size: 28pt; font-weight: 700; color: #1e293b; margin: 0 0 8px 0; letter-spacing: -0.02em;">${data.name || 'Your Name'}</h1>
    <h2 style="font-size: 16pt; color: #64748b; margin: 0 0 12px 0; font-weight: 400;">${data.title || 'Professional Title'}</h2>
    <div style="font-size: 10pt; color: #475569; display: flex; justify-content: center; flex-wrap: wrap; gap: 16px;">
      <span>📧 ${data.email || 'your.email@example.com'}</span>
      <span>📱 ${data.phone || '(555) 123-4567'}</span>
      <span>🔗 ${data.linkedin || 'linkedin.com/in/yourname'}</span>
      <span>📍 ${data.location || 'City, State'}</span>
    </div>
  </header>

  <!-- Professional Summary -->
  <section style="margin-bottom: 28px;">
    <h3 style="font-size: 14pt; font-weight: 600; color: #2563eb; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.05em;">Professional Summary</h3>
    <p style="margin: 0; text-align: justify; line-height: 1.5; color: #374151;">
      ${data.summary || 'Dynamic and results-driven professional with expertise in driving innovation and delivering exceptional results. Proven track record of leading cross-functional teams and implementing strategic solutions that enhance operational efficiency and drive business growth.'}
    </p>
  </section>

  <!-- Core Competencies -->
  <section style="margin-bottom: 28px;">
    <h3 style="font-size: 14pt; font-weight: 600; color: #2563eb; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.05em;">Core Competencies</h3>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 8px;">
      ${(data.skills || ['Leadership & Team Management', 'Strategic Planning', 'Project Management', 'Data Analysis', 'Process Optimization', 'Stakeholder Relations']).map((skill: string) => 
        `<div style="background: #f1f5f9; padding: 6px 12px; border-radius: 20px; font-size: 9pt; text-align: center; border-left: 3px solid #06d6a0;">• ${skill}</div>`
      ).join('')}
    </div>
  </section>

  <!-- Professional Experience -->
  <section style="margin-bottom: 28px;">
    <h3 style="font-size: 14pt; font-weight: 600; color: #2563eb; margin: 0 0 16px 0; text-transform: uppercase; letter-spacing: 0.05em;">Professional Experience</h3>
    
    <div style="margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
        <h4 style="font-size: 12pt; font-weight: 600; margin: 0; color: #1e293b;">${data.currentRole || 'Senior Professional'}</h4>
        <span style="font-size: 10pt; color: #64748b; background: #f8fafc; padding: 2px 8px; border-radius: 12px;">${data.currentDates || '2022 - Present'}</span>
      </div>
      <p style="font-size: 10pt; color: #4f46e5; margin: 0 0 12px 0; font-weight: 500;">${data.currentCompany || 'Leading Technology Company'} • ${data.currentLocation || 'San Francisco, CA'}</p>
      <ul style="margin: 0 0 0 20px; padding: 0; list-style: none;">
        ${(data.currentAchievements || [
          'Led strategic initiatives that resulted in 40% improvement in operational efficiency and $2M cost savings',
          'Managed cross-functional team of 12+ professionals across multiple departments and time zones',
          'Implemented data-driven solutions that increased customer satisfaction scores by 25%',
          'Spearheaded digital transformation project affecting 500+ users and streamlining core processes'
        ]).map((achievement: string) => 
          `<li style="margin-bottom: 8px; line-height: 1.4; position: relative; padding-left: 12px;">
            <span style="position: absolute; left: 0; color: #06d6a0; font-weight: bold;">▸</span>
            ${achievement}
          </li>`
        ).join('')}
      </ul>
    </div>

    <div style="margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
        <h4 style="font-size: 12pt; font-weight: 600; margin: 0; color: #1e293b;">${data.previousRole || 'Professional'}</h4>
        <span style="font-size: 10pt; color: #64748b; background: #f8fafc; padding: 2px 8px; border-radius: 12px;">${data.previousDates || '2019 - 2022'}</span>
      </div>
      <p style="font-size: 10pt; color: #4f46e5; margin: 0 0 12px 0; font-weight: 500;">${data.previousCompany || 'Growth-Stage Company'} • ${data.previousLocation || 'Remote'}</p>
      <ul style="margin: 0 0 0 20px; padding: 0; list-style: none;">
        ${(data.previousAchievements || [
          'Developed and executed strategic plans that drove 30% revenue growth over 18 months',
          'Built high-performing teams and established scalable processes for rapid organizational growth',
          'Collaborated with executive leadership to define product roadmap and market positioning'
        ]).map((achievement: string) => 
          `<li style="margin-bottom: 8px; line-height: 1.4; position: relative; padding-left: 12px;">
            <span style="position: absolute; left: 0; color: #06d6a0; font-weight: bold;">▸</span>
            ${achievement}
          </li>`
        ).join('')}
      </ul>
    </div>
  </section>

  <!-- Education & Certifications -->
  <section style="margin-bottom: 28px;">
    <h3 style="font-size: 14pt; font-weight: 600; color: #2563eb; margin: 0 0 12px 0; text-transform: uppercase; letter-spacing: 0.05em;">Education & Certifications</h3>
    <div style="display: flex; justify-content: space-between; items-baseline; margin-bottom: 12px;">
      <div>
        <h4 style="font-size: 11pt; font-weight: 600; margin: 0; color: #1e293b;">${data.degree || 'Master of Business Administration (MBA)'}</h4>
        <p style="font-size: 10pt; color: #64748b; margin: 0; font-style: italic;">${data.school || 'University of Excellence'}</p>
      </div>
      <span style="font-size: 10pt; color: #64748b;">${data.gradYear || '2018'}</span>
    </div>
    ${(data.certifications || ['PMP - Project Management Professional', 'Six Sigma Green Belt', 'Agile Certified Practitioner']).map((cert: string) => 
      `<p style="margin: 4px 0; font-size: 10pt; color: #374151;">• ${cert}</p>`
    ).join('')}
  </section>
</div>
    `.trim()
  },

  {
    id: 'classic-executive',
    name: 'Classic Executive',
    description: 'Traditional, sophisticated layout ideal for senior leadership positions',
    category: 'classic',
    preview: '/templates/classic-executive.png',
    tags: ['executive', 'leadership', 'traditional', 'sophisticated'],
    difficulty: 'advanced',
    colorScheme: {
      primary: '#1f2937',
      secondary: '#f9fafb',
      accent: '#d97706',
      text: '#374151',
      background: '#ffffff'
    },
    typography: {
      headings: 'Georgia',
      body: 'Times New Roman',
      size: '11pt'
    },
    layout: {
      columns: 1,
      spacing: 'normal',
      margins: '1in'
    },
    generateContent: (data = {}) => `
<div style="font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.3; margin: 0; padding: 50px; max-width: 8.5in; background: white;">
  <!-- Header Section -->
  <header style="text-align: center; margin-bottom: 36px; padding-bottom: 24px; border-bottom: 2px solid #1f2937;">
    <h1 style="font-family: Georgia, serif; font-size: 24pt; font-weight: bold; color: #1f2937; margin: 0 0 8px 0; letter-spacing: 0.02em;">${data.name || 'Executive Name'}</h1>
    <h2 style="font-size: 14pt; color: #d97706; margin: 0 0 16px 0; font-weight: normal; font-style: italic;">${data.title || 'Chief Executive Officer'}</h2>
    <div style="font-size: 10pt; color: #6b7280;">
      ${data.email || 'executive@company.com'} | ${data.phone || '(555) 123-4567'} | ${data.linkedin || 'linkedin.com/in/executive'} | ${data.location || 'New York, NY'}
    </div>
  </header>

  <!-- Executive Summary -->
  <section style="margin-bottom: 32px;">
    <h3 style="font-family: Georgia, serif; font-size: 13pt; font-weight: bold; color: #1f2937; margin: 0 0 12px 0; text-align: center; text-transform: uppercase; letter-spacing: 0.1em;">Executive Summary</h3>
    <hr style="width: 60px; height: 2px; background: #d97706; border: none; margin: 0 auto 16px auto;" />
    <p style="margin: 0; text-align: justify; line-height: 1.4; color: #374151; text-indent: 1em;">
      ${data.summary || 'Distinguished executive leader with 15+ years of progressive experience driving organizational transformation, strategic growth, and operational excellence across Fortune 500 companies. Proven expertise in leading large-scale initiatives, building high-performance teams, and delivering measurable results that consistently exceed stakeholder expectations. Track record of navigating complex market dynamics while maintaining focus on sustainable growth and shareholder value creation.'}
    </p>
  </section>

  <!-- Core Leadership Competencies -->
  <section style="margin-bottom: 32px;">
    <h3 style="font-family: Georgia, serif; font-size: 13pt; font-weight: bold; color: #1f2937; margin: 0 0 12px 0; text-align: center; text-transform: uppercase; letter-spacing: 0.1em;">Core Leadership Competencies</h3>
    <hr style="width: 60px; height: 2px; background: #d97706; border: none; margin: 0 auto 16px auto;" />
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 0 40px;">
      <div>
        ${(data.leftSkills || ['Strategic Planning & Execution', 'P&L Management', 'Mergers & Acquisitions', 'Digital Transformation', 'Global Market Expansion']).map((skill: string) => 
            `<p style="margin: 6px 0; font-size: 10pt; color: #374151;">• ${skill}</p>`
          ).join('')}
      </div>
      <div>
        ${(data.rightSkills || ['Board Relations & Governance', 'Stakeholder Management', 'Organizational Development', 'Risk Management', 'Change Leadership']).map((skill: string) => 
          `<p style="margin: 6px 0; font-size: 10pt; color: #374151;">• ${skill}</p>`
        ).join('')}
      </div>
    </div>
  </section>

  <!-- Professional Experience -->
  <section style="margin-bottom: 32px;">
    <h3 style="font-family: Georgia, serif; font-size: 13pt; font-weight: bold; color: #1f2937; margin: 0 0 12px 0; text-align: center; text-transform: uppercase; letter-spacing: 0.1em;">Executive Experience</h3>
    <hr style="width: 60px; height: 2px; background: #d97706; border: none; margin: 0 auto 20px auto;" />
    
    <div style="margin-bottom: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <h4 style="font-size: 12pt; font-weight: bold; margin: 0; color: #1f2937;">${data.currentRole || 'Chief Executive Officer'}</h4>
        <span style="font-size: 10pt; color: #6b7280; font-style: italic;">${data.currentDates || '2020 - Present'}</span>
      </div>
      <p style="font-size: 11pt; color: #d97706; margin: 0 0 12px 0; font-weight: bold;">${data.currentCompany || 'Global Technology Corporation'} | ${data.currentLocation || 'New York, NY'}</p>
      <p style="margin: 0 0 12px 0; font-size: 10pt; color: #4b5563; font-style: italic;">${data.companyDesc || 'Fortune 500 technology company with $5B+ annual revenue and 10,000+ employees globally'}</p>
      <ul style="margin: 0 0 0 24px; padding: 0;">
        ${(data.currentAchievements || [
          'Orchestrated comprehensive digital transformation initiative, resulting in 45% increase in operational efficiency and $150M cost savings over 3 years',
          'Led strategic acquisition of 3 companies totaling $800M, expanding market share by 25% and entering 2 new vertical markets',
          'Established global expansion strategy entering 5 new international markets, generating $200M+ in new revenue streams',
          'Built and developed C-suite leadership team, implementing succession planning and leadership development programs',
          'Delivered consistent shareholder value with 35% stock price appreciation and 12% year-over-year revenue growth'
        ]).map((achievement: string) => 
          `<li style="margin-bottom: 10px; line-height: 1.4; text-align: justify;">${achievement}</li>`
        ).join('')}
      </ul>
    </div>

    <div style="margin-bottom: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <h4 style="font-size: 12pt; font-weight: bold; margin: 0; color: #1f2937;">${data.previousRole || 'Chief Operating Officer'}</h4>
        <span style="font-size: 10pt; color: #6b7280; font-style: italic;">${data.previousDates || '2016 - 2020'}</span>
      </div>
      <p style="font-size: 11pt; color: #d97706; margin: 0 0 12px 0; font-weight: bold;">${data.previousCompany || 'Innovative Solutions Inc.'} | ${data.previousLocation || 'San Francisco, CA'}</p>
      <ul style="margin: 0 0 0 24px; padding: 0;">
        ${(data.previousAchievements || [
          'Directed operational strategy for $2B business unit, achieving 28% improvement in EBITDA over 4-year tenure',
          'Implemented lean methodology across 15 manufacturing facilities, reducing waste by 30% and improving quality metrics',
          'Led cross-functional team of 200+ professionals in successful product launch generating $100M first-year revenue'
        ]).map((achievement: string) => 
          `<li style="margin-bottom: 10px; line-height: 1.4; text-align: justify;">${achievement}</li>`
        ).join('')}
      </ul>
    </div>
  </section>

  <!-- Education & Board Positions -->
  <section>
    <h3 style="font-family: Georgia, serif; font-size: 13pt; font-weight: bold; color: #1f2937; margin: 0 0 12px 0; text-align: center; text-transform: uppercase; letter-spacing: 0.1em;">Education & Board Positions</h3>
    <hr style="width: 60px; height: 2px; background: #d97706; border: none; margin: 0 auto 16px auto;" />
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
      <div>
        <h4 style="font-size: 11pt; font-weight: bold; margin: 0 0 8px 0; color: #1f2937;">Education</h4>
        <p style="margin: 4px 0; font-size: 10pt;"><strong>${data.mba || 'Master of Business Administration'}</strong><br />${data.mbaSchool || 'Harvard Business School'} (${data.mbaYear || '2003'})</p>
        <p style="margin: 4px 0; font-size: 10pt;"><strong>${data.undergrad || 'Bachelor of Science, Engineering'}</strong><br />${data.undergradSchool || 'Stanford University'} (${data.undergradYear || '2001'})</p>
      </div>
      
      <div>
        <h4 style="font-size: 11pt; font-weight: bold; margin: 0 0 8px 0; color: #1f2937;">Board Positions</h4>
        ${(data.boards || ['Board of Directors, Tech Innovation Fund', 'Advisory Board, Startup Accelerator', 'Non-Profit Board, Education Foundation']).map((board: string) => 
          `<p style="margin: 4px 0; font-size: 10pt;">• ${board}</p>`
        ).join('')}
      </div>
    </div>
  </section>
</div>
    `.trim()
  },

  {
    id: 'creative-designer',
    name: 'Creative Designer',
    description: 'Bold, artistic layout perfect for creative professionals and designers',
    category: 'creative',
    preview: '/templates/creative-designer.png',
    tags: ['creative', 'design', 'artistic', 'portfolio'],
    difficulty: 'intermediate',
    colorScheme: {
      primary: '#8b5cf6',
      secondary: '#faf5ff',
      accent: '#f59e0b',
      text: '#1f2937',
      background: '#ffffff'
    },
    typography: {
      headings: 'Poppins',
      body: 'Poppins',
      size: '10pt'
    },
    layout: {
      columns: 2,
      spacing: 'tight',
      margins: '0.5in'
    },
    generateContent: (data = {}) => `
<div style="font-family: Poppins, sans-serif; font-size: 10pt; line-height: 1.3; margin: 0; padding: 30px; max-width: 8.5in; background: linear-gradient(135deg, #faf5ff 0%, #ffffff 100%);">
  <!-- Creative Header -->
  <header style="position: relative; margin-bottom: 30px; padding: 30px; background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%); border-radius: 20px; color: white; text-align: center;">
    <div style="position: absolute; top: -10px; right: -10px; width: 60px; height: 60px; background: #f59e0b; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
      <span style="font-size: 20pt; font-weight: bold;">🎨</span>
    </div>
    <h1 style="font-size: 26pt; font-weight: 700; margin: 0 0 8px 0; text-shadow: 2px 2px 4px rgba(0,0,0,0.1);">${data.name || 'Creative Professional'}</h1>
    <h2 style="font-size: 14pt; margin: 0 0 16px 0; font-weight: 300; opacity: 0.9;">${data.title || 'Visual Designer & Creative Director'}</h2>
    <div style="display: flex; justify-content: center; flex-wrap: wrap; gap: 16px; font-size: 9pt;">
      <span style="background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px;">📧 ${data.email || 'creative@designer.com'}</span>
      <span style="background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px;">📱 ${data.phone || '(555) 123-4567'}</span>
      <span style="background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px;">🌐 ${data.portfolio || 'portfolio.design'}</span>
    </div>
  </header>

  <!-- Two-Column Layout -->
  <div style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 30px;">
    
    <!-- Left Column -->
    <div>
      <!-- Creative Philosophy -->
      <section style="margin-bottom: 24px;">
        <h3 style="font-size: 12pt; font-weight: 600; color: #8b5cf6; margin: 0 0 12px 0; position: relative; padding-left: 20px;">
          <span style="position: absolute; left: 0; top: 0; width: 12px; height: 12px; background: linear-gradient(135deg, #f59e0b, #f97316); border-radius: 50%;"></span>
          Creative Philosophy
        </h3>
        <p style="margin: 0; line-height: 1.4; color: #374151;">
          ${data.philosophy || 'Passionate about creating meaningful experiences through innovative design. I believe in the power of visual storytelling to connect brands with their audiences, combining aesthetic excellence with strategic thinking to deliver solutions that not only look beautiful but drive real business results.'}
        </p>
      </section>

      <!-- Professional Experience -->
      <section style="margin-bottom: 24px;">
        <h3 style="font-size: 12pt; font-weight: 600; color: #8b5cf6; margin: 0 0 16px 0; position: relative; padding-left: 20px;">
          <span style="position: absolute; left: 0; top: 0; width: 12px; height: 12px; background: linear-gradient(135deg, #f59e0b, #f97316); border-radius: 50%;"></span>
          Experience
        </h3>
        
        <div style="margin-bottom: 16px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-radius: 12px; border-left: 4px solid #8b5cf6;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <h4 style="font-size: 11pt; font-weight: 600; margin: 0; color: #1f2937;">${data.currentRole || 'Senior Creative Director'}</h4>
            <span style="font-size: 9pt; color: #6b7280; background: white; padding: 2px 8px; border-radius: 10px;">${data.currentDates || '2022 - Present'}</span>
          </div>
          <p style="font-size: 9pt; color: #8b5cf6; margin: 0 0 8px 0; font-weight: 500;">${data.currentCompany || 'Innovation Design Studio'}</p>
          <ul style="margin: 0 0 0 16px; padding: 0; list-style: none;">
            ${(data.currentAchievements || [
              'Led creative strategy for 15+ major brand campaigns, resulting in 40% increase in client engagement',
              'Managed design team of 8 creatives, fostering collaborative environment and professional growth',
              'Developed comprehensive brand identity systems for Fortune 500 clients across multiple industries'
            ]).map((achievement: string) => 
              `<li style="margin-bottom: 6px; line-height: 1.3; position: relative; padding-left: 12px; font-size: 9pt;">
                <span style="position: absolute; left: 0; color: #f59e0b; font-weight: bold;">▶</span>
                ${achievement}
              </li>`
            ).join('')}
          </ul>
        </div>

        <div style="margin-bottom: 16px; padding: 16px; background: rgba(139, 92, 246, 0.05); border-radius: 12px; border-left: 4px solid #8b5cf6;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <h4 style="font-size: 11pt; font-weight: 600; margin: 0; color: #1f2937;">${data.previousRole || 'Visual Designer'}</h4>
            <span style="font-size: 9pt; color: #6b7280; background: white; padding: 2px 8px; border-radius: 10px;">${data.previousDates || '2019 - 2022'}</span>
          </div>
          <p style="font-size: 9pt; color: #8b5cf6; margin: 0 0 8px 0; font-weight: 500;">${data.previousCompany || 'Creative Agency Co.'}</p>
          <ul style="margin: 0 0 0 16px; padding: 0; list-style: none;">
            ${(data.previousAchievements || [
              'Designed award-winning campaigns for 20+ clients across digital and print media',
              'Collaborated with cross-functional teams to deliver projects on time and within budget',
              'Mentored junior designers and contributed to agency culture of creative excellence'
            ]).map((achievement: string) => 
              `<li style="margin-bottom: 6px; line-height: 1.3; position: relative; padding-left: 12px; font-size: 9pt;">
                <span style="position: absolute; left: 0; color: #f59e0b; font-weight: bold;">▶</span>
                ${achievement}
              </li>`
            ).join('')}
          </ul>
        </div>
      </section>

      <!-- Notable Projects -->
      <section>
        <h3 style="font-size: 12pt; font-weight: 600; color: #8b5cf6; margin: 0 0 12px 0; position: relative; padding-left: 20px;">
          <span style="position: absolute; left: 0; top: 0; width: 12px; height: 12px; background: linear-gradient(135deg, #f59e0b, #f97316); border-radius: 50%;"></span>
          Notable Projects
        </h3>
        <div style="display: grid; gap: 8px;">
          ${(data.projects || [
            'Brand Identity Redesign - TechCorp (2023)',
            'Digital Campaign - EcoFriendly Products (2023)',
            'Website Redesign - Healthcare Solutions (2022)'
          ]).map((project: string) => 
            `<div style="padding: 8px 12px; background: linear-gradient(135deg, #f59e0b22, #f9731622); border-radius: 8px; font-size: 9pt;">
              <strong style="color: #f59e0b;">•</strong> ${project}
            </div>`
          ).join('')}
        </div>
      </section>
    </div>

    <!-- Right Column -->
    <div>
      <!-- Skills & Expertise -->
      <section style="margin-bottom: 24px;">
        <h3 style="font-size: 12pt; font-weight: 600; color: #8b5cf6; margin: 0 0 12px 0; position: relative; padding-left: 20px;">
          <span style="position: absolute; left: 0; top: 0; width: 12px; height: 12px; background: linear-gradient(135deg, #f59e0b, #f97316); border-radius: 50%;"></span>
          Design Skills
        </h3>
        <div style="display: grid; gap: 8px;">
          ${(data.designSkills || ['Adobe Creative Suite', 'Figma & Sketch', 'UI/UX Design', 'Brand Identity', 'Print Design', 'Web Design', 'Motion Graphics', 'Typography']).map((skill: string, index: number) => {
            const colors = ['#8b5cf6', '#a855f7', '#c084fc', '#d8b4fe'];
            return `<div style="background: ${colors[index % colors.length]}; color: white; padding: 8px 12px; border-radius: 20px; text-align: center; font-size: 9pt; font-weight: 500;">${skill}</div>`;
          }).join('')}
        </div>
      </section>

      <!-- Software Proficiency -->
      <section style="margin-bottom: 24px;">
        <h3 style="font-size: 12pt; font-weight: 600; color: #8b5cf6; margin: 0 0 12px 0; position: relative; padding-left: 20px;">
          <span style="position: absolute; left: 0; top: 0; width: 12px; height: 12px; background: linear-gradient(135deg, #f59e0b, #f97316); border-radius: 50%;"></span>
          Software Mastery
        </h3>
        ${(data.software || [
          { name: 'Photoshop', level: 95 },
          { name: 'Illustrator', level: 90 },
          { name: 'InDesign', level: 85 },
          { name: 'Figma', level: 92 },
          { name: 'After Effects', level: 80 }
        ]).map((item: { name: string; level: number }) => 
          `<div style="margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
              <span style="font-size: 9pt; font-weight: 500;">${item.name}</span>
              <span style="font-size: 8pt; color: #6b7280;">${item.level}%</span>
            </div>
            <div style="height: 6px; background: #e5e7eb; border-radius: 3px; overflow: hidden;">
              <div style="height: 100%; width: ${item.level}%; background: linear-gradient(90deg, #8b5cf6, #f59e0b); border-radius: 3px;"></div>
            </div>
          </div>`
        ).join('')}
      </section>

      <!-- Awards & Recognition -->
      <section style="margin-bottom: 24px;">
        <h3 style="font-size: 12pt; font-weight: 600; color: #8b5cf6; margin: 0 0 12px 0; position: relative; padding-left: 20px;">
          <span style="position: absolute; left: 0; top: 0; width: 12px; height: 12px; background: linear-gradient(135deg, #f59e0b, #f97316); border-radius: 50%;"></span>
          Awards
        </h3>
        ${(data.awards || [
          'Design Excellence Award 2023',
          'Creative Campaign of the Year 2022',
          'Rising Star Designer 2021'
        ]).map((award: string) => 
          `<div style="margin-bottom: 6px; padding: 6px 10px; background: rgba(245, 158, 11, 0.1); border-radius: 8px; font-size: 9pt;">
            <span style="color: #f59e0b; font-weight: bold;">🏆</span> ${award}
          </div>`
        ).join('')}
      </section>

      <!-- Education -->
      <section>
        <h3 style="font-size: 12pt; font-weight: 600; color: #8b5cf6; margin: 0 0 12px 0; position: relative; padding-left: 20px;">
          <span style="position: absolute; left: 0; top: 0; width: 12px; height: 12px; background: linear-gradient(135deg, #f59e0b, #f97316); border-radius: 50%;"></span>
          Education
        </h3>
        <div style="padding: 12px; background: rgba(139, 92, 246, 0.05); border-radius: 10px;">
          <h4 style="font-size: 10pt; font-weight: 600; margin: 0 0 4px 0; color: #1f2937;">${data.degree || 'Bachelor of Fine Arts'}</h4>
          <p style="font-size: 9pt; color: #8b5cf6; margin: 0 0 4px 0;">${data.school || 'Art Institute of Design'}</p>
          <p style="font-size: 9pt; color: #6b7280; margin: 0;">${data.gradYear || '2019'} • ${data.gpa || 'Magna Cum Laude'}</p>
        </div>
      </section>
    </div>
  </div>
</div>
    `.trim()
  },

  {
    id: 'minimal-tech',
    name: 'Minimal Tech',
    description: 'Clean, minimal design optimized for ATS and tech recruiters',
    category: 'minimal',
    preview: '/templates/minimal-tech.png',
    tags: ['minimal', 'tech', 'ats-friendly', 'developer', 'engineer'],
    difficulty: 'beginner',
    colorScheme: {
      primary: '#111827',
      secondary: '#f9fafb',
      accent: '#10b981',
      text: '#374151',
      background: '#ffffff'
    },
    typography: {
      headings: 'JetBrains Mono',
      body: 'Inter',
      size: '11pt'
    },
    layout: {
      columns: 1,
      spacing: 'normal',
      margins: '0.75in'
    },
    generateContent: (data = {}) => `
<div style="font-family: Inter, sans-serif; font-size: 11pt; line-height: 1.4; margin: 0; padding: 40px; max-width: 8.5in; background: white; color: #374151;">
  <!-- Minimal Header -->
  <header style="margin-bottom: 40px;">
    <h1 style="font-family: 'JetBrains Mono', monospace; font-size: 24pt; font-weight: 700; color: #111827; margin: 0 0 4px 0;">${data.name || 'Software Engineer'}</h1>
    <p style="font-size: 12pt; color: #6b7280; margin: 0 0 12px 0;">${data.title || 'Full Stack Developer'}</p>
    <div style="font-size: 10pt; color: #9ca3af;">
      ${data.email || 'developer@email.com'} • ${data.phone || '(555) 123-4567'} • ${data.github || 'github.com/username'} • ${data.linkedin || 'linkedin.com/in/dev'}
    </div>
  </header>

  <!-- Summary -->
  <section style="margin-bottom: 32px;">
    <h2 style="font-family: 'JetBrains Mono', monospace; font-size: 12pt; font-weight: 600; color: #111827; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.05em;">Summary</h2>
    <div style="height: 1px; background: #e5e7eb; margin-bottom: 12px;"></div>
    <p style="margin: 0; line-height: 1.5;">
      ${data.summary || 'Software engineer with 5+ years of experience building scalable web applications and distributed systems. Expertise in JavaScript, Python, and cloud technologies. Passionate about clean code, system design, and continuous learning.'}
    </p>
  </section>

  <!-- Technical Skills -->
  <section style="margin-bottom: 32px;">
    <h2 style="font-family: 'JetBrains Mono', monospace; font-size: 12pt; font-weight: 600; color: #111827; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.05em;">Technical Skills</h2>
    <div style="height: 1px; background: #e5e7eb; margin-bottom: 12px;"></div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
      <div>
        <p style="margin: 0 0 4px 0; font-weight: 500; color: #111827;">Languages:</p>
        <p style="margin: 0 0 12px 0; font-size: 10pt;">${(data.languages || ['JavaScript (ES6+)', 'TypeScript', 'Python', 'Go', 'SQL']).join(', ')}</p>
        
        <p style="margin: 0 0 4px 0; font-weight: 500; color: #111827;">Frontend:</p>
        <p style="margin: 0 0 12px 0; font-size: 10pt;">${(data.frontend || ['React', 'Next.js', 'Vue.js', 'HTML5', 'CSS3', 'Tailwind']).join(', ')}</p>
      </div>
      <div>
        <p style="margin: 0 0 4px 0; font-weight: 500; color: #111827;">Backend:</p>
        <p style="margin: 0 0 12px 0; font-size: 10pt;">${(data.backend || ['Node.js', 'Express', 'FastAPI', 'PostgreSQL', 'MongoDB']).join(', ')}</p>
        
        <p style="margin: 0 0 4px 0; font-weight: 500; color: #111827;">Tools & Cloud:</p>
        <p style="margin: 0 0 12px 0; font-size: 10pt;">${(data.tools || ['Docker', 'AWS', 'Git', 'Linux', 'CI/CD', 'Kubernetes']).join(', ')}</p>
      </div>
    </div>
  </section>

  <!-- Experience -->
  <section style="margin-bottom: 32px;">
    <h2 style="font-family: 'JetBrains Mono', monospace; font-size: 12pt; font-weight: 600; color: #111827; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.05em;">Experience</h2>
    <div style="height: 1px; background: #e5e7eb; margin-bottom: 16px;"></div>
    
    <div style="margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
        <h3 style="font-size: 12pt; font-weight: 600; margin: 0; color: #111827;">${data.currentRole || 'Senior Software Engineer'}</h3>
        <span style="font-size: 10pt; color: #6b7280;">${data.currentDates || 'Jan 2022 - Present'}</span>
      </div>
      <p style="font-size: 10pt; color: #10b981; margin: 0 0 8px 0; font-weight: 500;">${data.currentCompany || 'TechCorp'} • ${data.currentLocation || 'San Francisco, CA'}</p>
      <ul style="margin: 0 0 0 20px; padding: 0;">
        ${(data.currentAchievements || [
          'Built and maintained microservices handling 10M+ requests/day using Node.js and PostgreSQL',
          'Implemented CI/CD pipeline reducing deployment time from 2 hours to 15 minutes',
          'Led architecture decisions for new product features serving 100K+ users',
          'Mentored 3 junior developers and conducted technical interviews'
        ]).map((achievement: string) => 
          `<li style="margin-bottom: 6px; line-height: 1.4;">${achievement}</li>`
        ).join('')}
      </ul>
    </div>

    <div style="margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
        <h3 style="font-size: 12pt; font-weight: 600; margin: 0; color: #111827;">${data.previousRole || 'Software Engineer'}</h3>
        <span style="font-size: 10pt; color: #6b7280;">${data.previousDates || 'Mar 2019 - Dec 2021'}</span>
      </div>
      <p style="font-size: 10pt; color: #10b981; margin: 0 0 8px 0; font-weight: 500;">${data.previousCompany || 'StartupXYZ'} • ${data.previousLocation || 'Remote'}</p>
      <ul style="margin: 0 0 0 20px; padding: 0;">
        ${(data.previousAchievements || [
          'Developed responsive web applications using React and TypeScript',
          'Optimized database queries improving application performance by 40%',
          'Collaborated with product and design teams to deliver user-centered features'
        ]).map((achievement: string) => 
          `<li style="margin-bottom: 6px; line-height: 1.4;">${achievement}</li>`
        ).join('')}
      </ul>
    </div>
  </section>

  <!-- Projects -->
  <section style="margin-bottom: 32px;">
    <h2 style="font-family: 'JetBrains Mono', monospace; font-size: 12pt; font-weight: 600; color: #111827; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.05em;">Key Projects</h2>
    <div style="height: 1px; background: #e5e7eb; margin-bottom: 16px;"></div>
    
    ${(data.projects || [
      {
        name: 'E-commerce Platform',
        tech: 'React, Node.js, PostgreSQL, AWS',
        description: 'Full-stack e-commerce solution with payment integration and admin dashboard'
      },
      {
        name: 'Real-time Chat Application',
        tech: 'Next.js, Socket.io, Redis, Docker',
        description: 'Scalable chat application supporting 1000+ concurrent users'
      }
    ]).map((project: { name: string; tech: string; description: string }) => 
      `<div style="margin-bottom: 12px;">
        <h3 style="font-size: 11pt; font-weight: 600; margin: 0 0 2px 0; color: #111827;">${project.name}</h3>
        <p style="font-size: 9pt; color: #10b981; margin: 0 0 4px 0; font-family: 'JetBrains Mono', monospace;">${project.tech}</p>
        <p style="font-size: 10pt; margin: 0; line-height: 1.3;">${project.description}</p>
      </div>`
    ).join('')}
  </section>

  <!-- Education -->
  <section>
    <h2 style="font-family: 'JetBrains Mono', monospace; font-size: 12pt; font-weight: 600; color: #111827; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 0.05em;">Education</h2>
    <div style="height: 1px; background: #e5e7eb; margin-bottom: 12px;"></div>
    <div style="display: flex; justify-content: space-between; align-items: baseline;">
      <div>
        <h3 style="font-size: 11pt; font-weight: 600; margin: 0; color: #111827;">${data.degree || 'Bachelor of Science in Computer Science'}</h3>
        <p style="font-size: 10pt; color: #6b7280; margin: 0;">${data.school || 'University of Technology'}</p>
      </div>
      <span style="font-size: 10pt; color: #6b7280;">${data.gradYear || '2019'}</span>
    </div>
  </section>
</div>
    `.trim()
  }
];

export const templateCategories = [
  { id: 'modern', name: 'Modern', description: 'Contemporary designs for today\'s professionals' },
  { id: 'classic', name: 'Classic', description: 'Timeless layouts for traditional industries' },
  { id: 'creative', name: 'Creative', description: 'Bold designs for creative professionals' },
  { id: 'minimal', name: 'Minimal', description: 'Clean, ATS-friendly layouts' },
  { id: 'executive', name: 'Executive', description: 'Sophisticated designs for senior leadership' }
];

export const getTemplateById = (id: string): ResumeTemplate | undefined => {
  return resumeTemplates.find(template => template.id === id);
};

export const getTemplatesByCategory = (category: string): ResumeTemplate[] => {
  return resumeTemplates.filter(template => template.category === category);
};

export const getTemplatesByTags = (tags: string[]): ResumeTemplate[] => {
  return resumeTemplates.filter(template => 
    template.tags.some(tag => tags.includes(tag))
  );
};

export const searchTemplates = (query: string): ResumeTemplate[] => {
  const lowercaseQuery = query.toLowerCase();
  return resumeTemplates.filter(template => 
    template.name.toLowerCase().includes(lowercaseQuery) ||
    template.description.toLowerCase().includes(lowercaseQuery) ||
    template.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery))
  );
};