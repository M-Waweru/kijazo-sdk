import test from 'node:test'
import assert from 'node:assert/strict'
import { createKeyboardBoundary } from '../src/keyboard.mjs'

function target() {
  const handlers = new Map()
  return {
    addEventListener(type, fn) { const entries = handlers.get(type) || new Set(); entries.add(fn); handlers.set(type, entries) },
    removeEventListener(type, fn) { handlers.get(type)?.delete(fn) },
    fire(type, event) { for (const fn of handlers.get(type) || []) fn(event) },
  }
}
function eventFor(host, inside) {
  const state = { prevented: false, stopped: false, immediate: false }
  return {
    ...state,
    composedPath: () => inside ? [{}, host] : [{}],
    preventDefault() { this.prevented = true },
    stopPropagation() { this.stopped = true },
    stopImmediatePropagation() { this.immediate = true },
  }
}

test('keystrokes in SDK are stopped without disabling default typing', () => {
  const host={}, shadow=target(), view=target(), doc=target()
  const attrs=new Set()
  doc.documentElement={setAttribute:key=>attrs.add(key),removeAttribute:key=>attrs.delete(key)}
  const editor=createKeyboardBoundary({host,shadow,panel:{hidden:false},view,doc})
  editor.take()
  for (const type of ['keydown','keyup','keypress']) {
    const event=eventFor(host,true)
    view.fire(type,event)
    shadow.fire(type,event)
    assert.equal(event.prevented,false)
    assert.equal(event.stopped,true)
    assert.equal(event.immediate,false)
  }
  assert.equal(attrs.has('data-kijazo-keyboard-active'),true)
  editor.destroy()
  assert.equal(attrs.size,0)
})

test('outside pointer restores host keyboard controls', () => {
  const host={},shadow=target(),view=target(),doc=target()
  doc.documentElement={setAttribute(){},removeAttribute(){}}
  const panel={hidden:false}
  const editor=createKeyboardBoundary({host,shadow,panel,view,doc})
  editor.take()
  const outsideWhileActive=eventFor(host,false)
  view.fire('keydown',outsideWhileActive)
  assert.equal(outsideWhileActive.prevented,true)
  assert.equal(outsideWhileActive.immediate,true)
  doc.fire('pointerdown',eventFor(host,false))
  const outsideAfterClick=eventFor(host,false)
  view.fire('keydown',outsideAfterClick)
  assert.equal(outsideAfterClick.prevented,false)
  assert.equal(outsideAfterClick.immediate,false)
  editor.destroy()
})

test('when editor is hidden the host receives keys normally', () => {
  const host={},shadow=target(),view=target(),doc=target()
  doc.documentElement={setAttribute(){},removeAttribute(){}}
  const panel={hidden:true}
  const editor=createKeyboardBoundary({host,shadow,panel,view,doc})
  editor.take()
  const ev=eventFor(host,false)
  view.fire('keydown',ev)
  assert.equal(ev.prevented,false)
  editor.destroy()
})
