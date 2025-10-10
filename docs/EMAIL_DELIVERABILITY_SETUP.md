# Email Deliverability Setup Guide

## 📧 Preventing Emails from Landing in Spam/Junk Folders

This guide will help you configure your email system to ensure maximum deliverability and prevent your emails from being marked as spam.

---

## 🔐 Email Authentication (CRITICAL)

### 1. SPF (Sender Policy Framework)

SPF tells email servers which IP addresses are authorized to send emails from your domain.

**Add this TXT record to your domain's DNS:**

```
Type: TXT
Name: @ (or your domain name)
Value: v=spf1 include:_spf.google.com include:spf.protection.outlook.com ~all
```

**For different providers:**
- **Gmail/Google Workspace:** `v=spf1 include:_spf.google.com ~all`
- **Outlook/Microsoft 365:** `v=spf1 include:spf.protection.outlook.com ~all`
- **SendGrid:** `v=spf1 include:sendgrid.net ~all`
- **Custom SMTP:** `v=spf1 ip4:YOUR_SERVER_IP ~all`

**Testing SPF:**
```bash
dig TXT yourdomain.com
# or
nslookup -type=TXT yourdomain.com
```

### 2. DKIM (DomainKeys Identified Mail)

DKIM adds a digital signature to your emails to verify authenticity.

#### For Gmail/Google Workspace:

1. Go to **Google Admin Console** → **Apps** → **Google Workspace** → **Gmail**
2. Navigate to **Authenticate email**
3. Click **Generate new record**
4. Copy the DNS record provided

**Add to your DNS:**
```
Type: TXT
Name: google._domainkey
Value: [the long key provided by Google]
```

#### For Outlook/Microsoft 365:

1. Go to **Microsoft 365 Admin Center** → **Settings** → **Domains**
2. Select your domain → **DNS records**
3. Add the DKIM records provided

**Add to your DNS:**
```
Type: CNAME
Name: selector1._domainkey
Value: selector1-<domain>._domainkey.<initial-domain>.onmicrosoft.com

Type: CNAME
Name: selector2._domainkey
Value: selector2-<domain>._domainkey.<initial-domain>.onmicrosoft.com
```

**Testing DKIM:**
- Send a test email to yourself
- Check email headers for `DKIM-Signature` field
- Use tools like https://dkimvalidator.com/

### 3. DMARC (Domain-based Message Authentication)

DMARC tells email servers what to do if SPF or DKIM checks fail.

**Add this TXT record to your domain's DNS:**

```
Type: TXT
Name: _dmarc
Value: v=DMARC1; p=quarantine; rua=mailto:postmaster@yourdomain.com; pct=100; adkim=s; aspf=s
```

**DMARC Policy Options:**
- `p=none` - Monitor only (recommended for testing)
- `p=quarantine` - Mark as spam if authentication fails
- `p=reject` - Reject emails that fail authentication (strictest)

**Recommended DMARC for production:**
```
v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com; ruf=mailto:dmarc@yourdomain.com; fo=1; pct=100; adkim=s; aspf=s
```

**Testing DMARC:**
```bash
dig TXT _dmarc.yourdomain.com
```

---

## 📋 DNS Records Summary

Here's what your DNS should look like:

| Type | Name | Value | Priority |
|------|------|-------|----------|
| TXT | @ | `v=spf1 include:_spf.google.com ~all` | - |
| TXT | google._domainkey | `v=DKIM1; k=rsa; p=[your-key]` | - |
| TXT | _dmarc | `v=DMARC1; p=quarantine; rua=mailto:...` | - |
| MX | @ | `aspmx.l.google.com` (Gmail) | 1 |
| MX | @ | `alt1.aspmx.l.google.com` | 5 |

---

## ✅ Email Best Practices

### Content Guidelines

✅ **DO:**
- Use a clear, descriptive subject line
- Include both HTML and plain text versions
- Use normal capitalization (avoid ALL CAPS)
- Include an unsubscribe link for bulk emails
- Keep a good text-to-image ratio
- Use your real name and address in the "From" field
- Include your physical mailing address (for marketing emails)
- Make sure content is relevant to recipients

❌ **DON'T:**
- Use spam trigger words (FREE, WINNER, URGENT!!!, ACT NOW, etc.)
- Use excessive punctuation (!!!, ???)
- Send image-only emails
- Use URL shorteners (bit.ly, tinyurl, etc.)
- Include JavaScript or forms in emails
- Use misleading subject lines
- Send to purchased email lists

### Technical Guidelines

✅ **DO:**
- Authenticate your domain (SPF, DKIM, DMARC)
- Use a consistent "From" address
- Warm up new IP addresses gradually
- Monitor bounce rates (<5% is good)
- Remove invalid addresses promptly
- Use double opt-in for subscriptions
- Include proper email headers
- Test emails before sending

❌ **DON'T:**
- Send too many emails too quickly
- Send from free email providers (Gmail, Yahoo) for business use
- Use shared IPs with bad reputation
- Ignore unsubscribe requests
- Buy or rent email lists
- Use deceptive headers or sender information

---

## 🔍 Spam Score Checker

Our system automatically checks your emails for spam triggers before sending:

### Spam Score Interpretation:
- **0-2:** Excellent - Very unlikely to be marked as spam
- **2-4:** Good - Should deliver successfully
- **4-6:** Fair - May have some deliverability issues
- **6-10:** Poor - Likely to be marked as spam

### Common Issues and Fixes:

| Issue | Fix |
|-------|-----|
| No subject line | Add a clear, descriptive subject |
| All caps subject | Use normal capitalization |
| Too many exclamation marks | Use at most one exclamation mark |
| Spam trigger words | Avoid "free", "winner", "urgent", etc. |
| Too many links | Keep links under 10 per email |
| Image-only email | Add substantial text content |
| No plain text version | Always include plain text |
| Shortened URLs | Use full, legitimate URLs |

---

## 🛠️ Setup Checklist

### Initial Setup (One-time)

- [ ] Add SPF record to DNS
- [ ] Configure DKIM with email provider
- [ ] Add DMARC record to DNS
- [ ] Verify MX records are correct
- [ ] Set up proper "From" address
- [ ] Create email signature
- [ ] Set up unsubscribe mechanism (for bulk emails)
- [ ] Configure email headers properly

### Before Every Campaign

- [ ] Check spam score using our built-in tool
- [ ] Review content for spam trigger words
- [ ] Test email in multiple email clients
- [ ] Verify all links work correctly
- [ ] Ensure unsubscribe link is present (bulk emails)
- [ ] Check text-to-image ratio
- [ ] Verify personalization is working
- [ ] Send test email to yourself

### Ongoing Monitoring

- [ ] Monitor bounce rates (should be <5%)
- [ ] Check spam complaint rates (should be <0.1%)
- [ ] Review DMARC reports weekly
- [ ] Monitor sender reputation
- [ ] Clean email list regularly
- [ ] Track open and click rates
- [ ] Respond to unsubscribe requests promptly

---

## 📊 Monitoring Tools

### Free Tools:
- **Mail Tester:** https://www.mail-tester.com/
- **DKIM Validator:** https://dkimvalidator.com/
- **MXToolbox:** https://mxtoolbox.com/
- **Google Postmaster Tools:** https://postmaster.google.com/
- **Microsoft SNDS:** https://sendersupport.olc.protection.outlook.com/snds/

### What to Monitor:
- **Sender Score:** Aim for 90+
- **Blacklist Status:** Check regularly
- **Bounce Rate:** Keep below 5%
- **Complaint Rate:** Keep below 0.1%
- **Engagement Rate:** Higher is better

---

## 🚨 Troubleshooting

### Emails Going to Spam?

1. **Check Authentication:**
   - Verify SPF, DKIM, DMARC are set up correctly
   - Use https://mxtoolbox.com/SuperTool.aspx

2. **Review Content:**
   - Run spam score checker
   - Remove spam trigger words
   - Add more text content

3. **Check Sender Reputation:**
   - Use Google Postmaster Tools
   - Check if IP is blacklisted: https://mxtoolbox.com/blacklists.aspx

4. **Technical Issues:**
   - Verify reverse DNS (PTR record)
   - Check if ports 25, 587, 465 are open
   - Ensure SSL/TLS is configured

### High Bounce Rate?

1. **Clean Your List:**
   - Remove invalid email addresses
   - Use email verification service
   - Implement double opt-in

2. **Technical Fixes:**
   - Check MX records
   - Verify SPF record
   - Ensure sending limits aren't exceeded

### Low Engagement?

1. **Content Improvements:**
   - More personalization
   - Better subject lines
   - Relevant content

2. **List Quality:**
   - Segment your audience
   - Remove inactive subscribers
   - Target engaged users

---

## 💡 Provider-Specific Tips

### Gmail

- Authenticate with Google Workspace
- Use Google Postmaster Tools
- Limit to 500 emails/day for free accounts
- 2000 emails/day for paid accounts
- Warm up new accounts gradually

### Outlook/Microsoft 365

- Configure both DKIM selectors
- Use Microsoft SNDS for monitoring
- SmartScreen filter is strict
- Test thoroughly before bulk sending

### SMTP/Custom Server

- Use dedicated IP for high volume
- Warm up IP gradually (start with 50/day)
- Monitor blacklists daily
- Implement feedback loops
- Keep bounce rate <5%

---

## 📞 Support

If you're still having deliverability issues:

1. Run our built-in spam score checker
2. Verify all DNS records are correct
3. Check Google Postmaster Tools
4. Review DMARC reports
5. Contact your email service provider

---

## 🎯 Quick Wins for Better Deliverability

1. ✅ Set up SPF, DKIM, and DMARC (CRITICAL)
2. ✅ Use our spam score checker before sending
3. ✅ Include unsubscribe link for bulk emails
4. ✅ Use consistent "From" address
5. ✅ Clean your email list regularly
6. ✅ Test emails before sending
7. ✅ Monitor bounce and complaint rates
8. ✅ Engage with your audience regularly
9. ✅ Use double opt-in for new subscribers
10. ✅ Remove inactive subscribers after 6 months

---

## 📝 Summary

**Three Pillars of Email Deliverability:**

1. **Authentication** - SPF, DKIM, DMARC (prevents spoofing)
2. **Reputation** - Sender score, engagement, complaints (trustworthiness)
3. **Content** - No spam triggers, good formatting, relevant (quality)

**Remember:** Our system automatically:
- ✅ Checks spam score before sending
- ✅ Sanitizes HTML to remove dangerous elements
- ✅ Adds proper email headers
- ✅ Validates recipient email addresses
- ✅ Provides real-time deliverability feedback

Follow this guide, and your emails will have the best chance of reaching the inbox! 📬
