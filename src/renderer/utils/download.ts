function triggerDownload(href: string, filename: string) {
  const element = document.createElement('a')
  element.setAttribute('href', href)
  element.setAttribute('download', filename)
  element.style.display = 'none'
  document.body.appendChild(element)
  element.click()
  document.body.removeChild(element)
}

export function downloadTextFile(content: string, filename: string, mime: string) {
  triggerDownload(`data:${mime};charset=utf-8,` + encodeURIComponent(content), filename)
}

export function downloadBase64File(base64: string, filename: string, mime: string) {
  triggerDownload(`data:${mime};base64,${base64}`, filename)
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}
