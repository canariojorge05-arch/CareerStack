import 'dotenv/config'
import { sendEmail, emailTemplates } from '../server/utils/email'

async function main() {
  const to = process.env.TEST_EMAIL_TO || process.env.EMAIL_TO
  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER
  if (!to) {
    console.error('No recipient specified. Set TEST_EMAIL_TO or EMAIL_TO in your environment.')
    process.exit(1)
  }

  const subject = process.env.TEST_EMAIL_SUBJECT || 'Test email from Resume Customizer Pro'
  const html = `<p>This is a test email sent at ${new Date().toISOString()}.</p>`

  console.log(`📧 Preparing to send email to: ${to}`)
  console.log(`📧 From: ${from}`)
  if (!from) {
    console.warn('No sender configured (EMAIL_FROM or EMAIL_USER). The message will use the default from header.');
  }

  try {
  // sendEmail(to, subject, html, attachments?, options?)
  const ok = await sendEmail(to, subject, html, undefined, from ? { replyTo: from } : undefined)
    console.log('sendEmail returned:', ok)
    if (ok) process.exit(0)
    else process.exit(2)
  } catch (err: any) {
    console.error('Failed to send email:', err?.message || err)
    process.exit(1)
  }
}

main()
