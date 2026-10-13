import { createHash } from 'node:crypto';

export function detect(messages) {
  const groups = new Map();
  for (const message of messages) {
    const text = `${message.subject || ''}\n${message.body || ''}`.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ');
    if (!/subscription|membership|renew|recurring|monthly|annual|per month|per year/i.test(text)) continue;
    if (/cancelled|canceled|refund issued|payment failed|payment declined/i.test(text)) continue;
    const candidates = [];
    for (const line of text.split(/\n/)) {
      const pattern = /(?:(USD|EUR|GBP|ILS|[$€£₪])\s*(\d+(?:,\d{3})*(?:\.\d{1,2})?)|(\d+(?:,\d{3})*(?:\.\d{1,2})?)\s*(USD|EUR|GBP|ILS))/gi;
      for (const match of line.matchAll(pattern)) {
        const currency = ({'$':'USD','€':'EUR','£':'GBP','₪':'ILS'})[match[1]] || (match[1] || match[4]).toUpperCase();
        const amount = Number((match[2] || match[3]).replaceAll(',', ''));
        if (amount > 0) candidates.push({ currency, amount, score: (/total|amount paid|charged|payment of/i.test(line) ? 4 : 1) - (/subtotal|tax|discount|save|credit/i.test(line) ? 4 : 0) });
      }
    }
    candidates.sort((a,b) => b.score-a.score);
    if (!candidates.length) continue;
    const price = candidates[0];
    const cycle = /annual|yearly|per year|\/year|\/yr/i.test(text) ? 'yearly' : /monthly|per month|\/month|\/mo/i.test(text) ? 'monthly' : 'unknown';
    const sender = message.from || 'Unknown sender';
    const email = sender.match(/<([^>]+)>/)?.[1] || sender;
    const provider = sender.includes('<') ? sender.split('<')[0].replaceAll('"','').trim() || email : sender;
    const key = `${email.toLowerCase()}|${price.currency}|${price.amount}|${cycle}`;
    const date = new Date(message.date);
    if (Number.isNaN(date.getTime())) continue;
    const record = { id: createHash('sha256').update(key).digest('hex').slice(0,16), provider, ...price, cycle, date: date.toISOString(), subject: message.subject || '', evidence: text.slice(0,1800), sourceUrl: message.sourceUrl || null, receipts: 1, status: 'review', confidence: cycle === 'unknown' ? 'Possible' : 'Likely' };
    const prior = groups.get(key);
    if (prior) { record.receipts = prior.receipts+1; groups.set(key, new Date(prior.date)>date ? {...prior, receipts:record.receipts} : record); }
    else groups.set(key,record);
  }
  return [...groups.values()].sort((a,b)=>b.date.localeCompare(a.date));
}

export function parseEml(raw) {
  const split = raw.search(/\r?\n\r?\n/);
  const headers = raw.slice(0,split).replace(/\r?\n[ \t]+/g,' ');
  const header = name => headers.match(new RegExp(`^${name}:\\s*(.+)$`,'im'))?.[1]?.trim() || '';
  if (split < 0 || /multipart\//i.test(header('Content-Type'))) throw new Error('Import plain-text .eml files, or use JSON for multipart receipts.');
  let body = raw.slice(split).trim();
  if (/base64/i.test(header('Content-Transfer-Encoding'))) body = Buffer.from(body,'base64').toString('utf8');
  if (/quoted-printable/i.test(header('Content-Transfer-Encoding'))) body = body.replace(/=\r?\n/g,'').replace(/=([A-F0-9]{2})/gi, (_,h)=>String.fromCharCode(parseInt(h,16)));
  return { from:header('From'), subject:header('Subject'), date:header('Date'), body };
}
