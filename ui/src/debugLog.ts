const DEFAULT_DEBUG_LOG_LIMIT = 12000;

export function formatDebugEntry(entry: string, date = new Date()): string {
  const time = date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  return `[${time}] ${entry}`;
}

export function appendDebugEntry(
  current: string,
  entry: string,
  date = new Date(),
  limit = DEFAULT_DEBUG_LOG_LIMIT,
): string {
  const formatted = formatDebugEntry(entry, date);
  const next = current ? `${current}\n${formatted}` : formatted;
  return next.slice(-limit);
}
