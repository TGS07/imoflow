type ToastType = 'success' | 'error' | 'info' | 'warning'

export function toast(message: string, type: ToastType = 'info') {
  window.dispatchEvent(new CustomEvent('formacr:toast', { detail: { message, type, id: Date.now() } }))
}
