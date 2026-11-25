/* eslint-disable react/only-export-components -- Provider and its hook share one private context. */
import { createContext, useContext, useState } from 'react'
const Context = createContext(null)
export function BugDraftProvider({ children }) {
  const [drafts, setDrafts] = useState({})
  return <Context.Provider value={{ drafts, setDrafts }}>{children}</Context.Provider>
}
export function useBugDraft(key) {
  const { drafts, setDrafts } = useContext(Context)
  return [drafts[key], (next) => setDrafts((all) => ({ ...all, [key]: typeof next === 'function' ? next(all[key]) : next }))]
}
