export function roundRobinItem(items, sequence) {
  if (!Array.isArray(items) || items.length === 0) return null
  const position = Math.max(1, Number(sequence) || 1)
  return items[(position - 1) % items.length]
}
