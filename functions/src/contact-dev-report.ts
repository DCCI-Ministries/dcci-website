import { SITE_CONTACTS } from './site-contacts';

export type HatunDeveloperReportType = 'question' | 'suspicious' | 'solicitation' | 'threatening';

const URGENT_SUBJECT = 'Urgent: Hatun Website Question';
const NORMAL_SUBJECT = 'Hatun Website Question';

const REPORT_LABELS: Record<HatunDeveloperReportType, string> = {
  question: 'Question about this contact form message',
  suspicious: 'Suspicious contact form message',
  solicitation: 'Solicitation / spam contact form message',
  threatening: 'Threatening or harassing contact form message'
};

export interface ContactFormReportContext {
  visitorName: string;
  visitorEmail: string;
  visitorSubject: string;
  visitorMessage: string;
  contactId: string;
  clientIP?: string;
  newsletterOptIn?: boolean;
}

const MAILTO_BODY_MAX = 1800;

function buildMailtoUrl(developerEmail: string, subject: string, body: string): string {
  return `mailto:${developerEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function truncateForMailto(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n\n[Message truncated — full text is in the contact form email above.]`;
}

function buildSubject(reportType: HatunDeveloperReportType): string {
  const label = REPORT_LABELS[reportType];
  if (reportType === 'question') {
    return `${NORMAL_SUBJECT} — ${label}`;
  }
  return `${URGENT_SUBJECT} — ${label}`;
}

function buildIntro(reportType: HatunDeveloperReportType): string {
  switch (reportType) {
    case 'question':
      return 'I have a question about this contact form message for the website developer:';
    case 'solicitation':
      return 'This contact form message looks like unwanted solicitation or marketing spam to me.';
    case 'threatening':
      return 'This contact form message feels threatening, harassing, or seriously concerning to me.';
    default:
      return 'This contact form message looks suspicious or unsafe to me.';
  }
}

function buildReportBody(reportType: HatunDeveloperReportType, ctx: ContactFormReportContext): string {
  const intro = buildIntro(reportType);
  const messageBlock = truncateForMailto(ctx.visitorMessage || '(empty)', 900);

  const lines = [
    'Hi,',
    '',
    intro,
    '',
    '--- Contact form details (for the developer) ---',
    `Visitor name: ${ctx.visitorName}`,
    `Visitor email: ${ctx.visitorEmail}`,
    `Subject: ${ctx.visitorSubject}`,
    `Contact ID: ${ctx.contactId}`,
    `Newsletter opt-in: ${ctx.newsletterOptIn ? 'yes' : 'no'}`,
    ctx.clientIP ? `Visitor IP (from form): ${ctx.clientIP}` : '',
    '',
    'Message:',
    messageBlock,
    '',
    '---',
    reportType === 'question'
      ? 'My question:\n\n[Type your question here]\n'
      : 'Please review and tighten contact form security if needed (filters, rate limits, etc.).',
    '',
    reportType !== 'question'
      ? 'I have the full message in the contact form email above. I have not clicked any links in the visitor message unless noted.'
      : 'Use Reply for genuine visitors. I am using this link only to ask the developer about this message.',
    '',
    'Thanks,',
    'Hatun'
  ].filter((line, index, arr) => line !== '' || (index > 0 && arr[index - 1] !== ''));

  return truncateForMailto(lines.join('\n'), MAILTO_BODY_MAX);
}

function buttonStyle(bg: string): string {
  return [
    'display:inline-block',
    'margin:6px 8px 6px 0',
    'padding:10px 14px',
    'background:' + bg,
    'color:#ffffff',
    'text-decoration:none',
    'border-radius:4px',
    'font-family:Arial,sans-serif',
    'font-size:14px',
    'font-weight:bold'
  ].join(';');
}

export function buildHatunDeveloperReportLinks(ctx: ContactFormReportContext): {
  developerEmail: string;
  questionMailto: string;
  suspiciousMailto: string;
  solicitationMailto: string;
  threateningMailto: string;
  textFooter: string;
  htmlFooter: string;
} {
  const developerEmail = SITE_CONTACTS.technicalAdminEmail;

  const questionMailto = buildMailtoUrl(
    developerEmail,
    buildSubject('question'),
    buildReportBody('question', ctx)
  );
  const suspiciousMailto = buildMailtoUrl(
    developerEmail,
    buildSubject('suspicious'),
    buildReportBody('suspicious', ctx)
  );
  const solicitationMailto = buildMailtoUrl(
    developerEmail,
    buildSubject('solicitation'),
    buildReportBody('solicitation', ctx)
  );
  const threateningMailto = buildMailtoUrl(
    developerEmail,
    buildSubject('threatening'),
    buildReportBody('threatening', ctx)
  );

  const textFooter = [
    '---',
    'Need help with this message?',
    'Use Reply for genuine visitors. For the website developer, open one of these links (your email app will draft a message with the details below):',
    '',
    `Ask a question: ${questionMailto}`,
    `Report suspicious: ${suspiciousMailto}`,
    `Report spam / solicitation: ${solicitationMailto}`,
    `Report threatening / harassment: ${threateningMailto}`,
    '',
    `Developer inbox: ${developerEmail}`,
    '(This address updates when a new developer maintains the site — see config/site-contacts.json.)'
  ].join('\n');

  const htmlFooter = `
    <hr>
    <p><strong>Need help with this message?</strong></p>
    <p>Use <strong>Reply</strong> for genuine visitors. To contact the <strong>website developer</strong>
    about this message, click a button below. Your email app will open with the visitor details and message
  pre-filled — add your question or notes, then send.</p>
    <p>
      <a href="${questionMailto}" style="${buttonStyle('#1565c0')}">Ask developer a question</a>
      <a href="${suspiciousMailto}" style="${buttonStyle('#c62828')}">Report suspicious</a>
      <a href="${solicitationMailto}" style="${buttonStyle('#6a1b9a')}">Report spam / solicitation</a>
      <a href="${threateningMailto}" style="${buttonStyle('#b71c1c')}">Report threatening / harassment</a>
    </p>
    <p><small>Developer: ${developerEmail} — changes automatically when site maintainer updates <code>technicalAdminEmail</code>.</small></p>
    <p><small>Do not click links in the visitor message unless you trust the sender.</small></p>
  `;

  return {
    developerEmail,
    questionMailto,
    suspiciousMailto,
    solicitationMailto,
    threateningMailto,
    textFooter,
    htmlFooter
  };
}
