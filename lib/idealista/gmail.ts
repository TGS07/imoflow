import { google } from 'googleapis'

function getOAuth2Client() {
  const client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET
  )
  client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN })
  return client
}

export function isGmailConfigured(): boolean {
  return Boolean(
    process.env.GMAIL_CLIENT_ID &&
    process.env.GMAIL_CLIENT_SECRET &&
    process.env.GMAIL_REFRESH_TOKEN
  )
}

export async function listAlertMessageIds(
  query = 'from:naoresponder@idealista.pt',
  maxResults = 25
): Promise<string[]> {
  const auth = getOAuth2Client()
  const gmail = google.gmail({ version: 'v1', auth })
  const res = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults,
  })
  return (res.data.messages ?? []).map((m) => m.id!)
}

export async function getRawMessage(messageId: string): Promise<string> {
  const auth = getOAuth2Client()
  const gmail = google.gmail({ version: 'v1', auth })
  const res = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'raw',
  })
  const raw = res.data.raw!
  return Buffer.from(raw, 'base64url').toString('utf-8')
}
