import { Children, cloneElement, useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import './DialogPortal.css'

const dialogs = []
const background = new Map()
let bodyStyles
const top = () => dialogs[dialogs.length - 1]
const selector = 'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex]'

function visible(element) {
  return element instanceof HTMLElement && element.isConnected &&
    !element.matches(':disabled') && !element.closest('[inert], [hidden], [aria-hidden="true"]') &&
    element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden'
}

function controls(root) {
  return [...root.querySelectorAll(selector)].filter((element) =>
    element.tabIndex >= 0 && visible(element) && !element.hasAttribute('data-dialog-backdrop'))
}

function synchronize() {
  for (const element of document.body.children) {
    if (!(element instanceof HTMLElement) || element.hasAttribute('data-dialog-root') || /^(SCRIPT|STYLE)$/.test(element.tagName)) continue
    if (!background.has(element)) background.set(element, element.inert)
    element.inert = true
  }
  dialogs.forEach((entry, index) => {
    entry.node.style.zIndex = String(1000 + index * 10)
    entry.node.inert = entry !== top()
    entry.node.setAttribute('aria-modal', String(entry === top()))
  })
}

/** Portal dialogs outside page transforms; coordinate focus and scroll for stacked windows. */
export default function DialogPortal({ children, onClose, busy = false, label }) {
  const root = useRef(null)
  const latest = useRef({ onClose, busy })
  const opener = useRef(typeof document === 'undefined' ? null : document.activeElement)
  useLayoutEffect(() => { latest.current = { onClose, busy } }, [onClose, busy])

  useLayoutEffect(() => {
    const node = root.current
    const entry = { node }
    if (!dialogs.length) {
      bodyStyles = { overflow: document.body.style.overflow, paddingRight: document.body.style.paddingRight }
      const gap = Math.max(0, window.innerWidth - document.documentElement.clientWidth)
      if (gap) document.body.style.paddingRight = `${(parseFloat(getComputedStyle(document.body).paddingRight) || 0) + gap}px`
      document.body.style.overflow = 'hidden'
    }
    dialogs.push(entry)
    synchronize()
    if (!node.contains(document.activeElement)) node.focus({ preventScroll: true })

    function keydown(event) {
      if (entry !== top() || event.defaultPrevented || event.isComposing) return
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        if (!latest.current.busy) latest.current.onClose?.()
      }
      if (event.key !== 'Tab') return
      const items = controls(node)
      const current = document.activeElement
      const first = items[0]
      const last = items[items.length - 1]
      if (!items.length || !items.includes(current) || (event.shiftKey ? current === first : current === last)) {
        event.preventDefault()
        ;(event.shiftKey ? last || node : first || node).focus({ preventScroll: true })
      }
    }
    function focusin(event) {
      if (entry === top() && !node.contains(event.target)) node.focus({ preventScroll: true })
    }
    document.addEventListener('keydown', keydown)
    document.addEventListener('focusin', focusin)
    return () => {
      document.removeEventListener('keydown', keydown)
      document.removeEventListener('focusin', focusin)
      const wasTop = top() === entry
      const index = dialogs.indexOf(entry)
      if (index >= 0) dialogs.splice(index, 1)
      synchronize()
      if (!dialogs.length) {
        Object.assign(document.body.style, bodyStyles)
        for (const [element, inert] of background) element.inert = inert
        background.clear()
      }
      const expected = top()
      queueMicrotask(() => {
        if (!wasTop || dialogs.includes(entry) || top() !== expected || dialogs.some((item) => item.node === node)) return
        const target = opener.current
        if (visible(target) && (!expected || expected.node.contains(target))) target.focus({ preventScroll: true })
        else expected?.node.focus({ preventScroll: true })
      })
    }
  }, [])

  const child = Children.only(children)
  return createPortal(cloneElement(child, {
    ref: root,
    role: 'dialog',
    'aria-modal': true,
    'aria-label': child.props['aria-labelledby'] ? undefined : label,
    'data-dialog-root': '',
    tabIndex: -1,
    onClickCapture(event) {
      if (latest.current.busy && event.target.closest('[data-dialog-backdrop], [data-dialog-close]')) {
        event.preventDefault()
        event.stopPropagation()
        return
      }
      child.props.onClickCapture?.(event)
    },
  }), document.body)
}
