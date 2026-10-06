export function formatCompletedAt(value,language='en') {
  if(!value || !Number.isFinite(Date.parse(value))) return '—';
  return new Intl.DateTimeFormat(language==='zh'?'zh-CN':'en-GB',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(value));
}
