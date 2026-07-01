import { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabase'
import Sidebar from './components/Sidebar'
import Dashboard from './components/Dashboard'
import ContactsView from './components/ContactsView'
import ContactDetail from './components/ContactDetail'
import ImportView from './components/ImportView'
import FollowUpsView from './components/FollowUpsView'
import AnalyticsView from './components/AnalyticsView'
import WorkflowView from './components/WorkflowView'

export default function App() {
  const [view, setView] = useState('dashboard')
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedContactId, setSelectedContactId] = useState(null)
  const [toast, setToast] = useState(null)

  const loadContacts = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .order('updated_at', { ascending: false })
    if (!error) setContacts(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadContacts()
  }, [loadContacts])

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  const openContact = (id) => {
    setSelectedContactId(id)
    setView('contact-detail')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar view={view} setView={setView} contactCount={contacts.length} contacts={contacts} />
      <main style={{ flex: 1, padding: '40px 48px', maxWidth: 1280 }}>
        {view === 'dashboard' && (
          <Dashboard contacts={contacts} loading={loading} openContact={openContact} setView={setView} />
        )}
        {view === 'contacts' && (
          <ContactsView
            contacts={contacts}
            loading={loading}
            openContact={openContact}
            reload={loadContacts}
            showToast={showToast}
          />
        )}
        {view === 'contact-detail' && (
          <ContactDetail
            contactId={selectedContactId}
            onBack={() => setView('contacts')}
            reload={loadContacts}
            showToast={showToast}
          />
        )}
        {view === 'import' && (
          <ImportView contacts={contacts} reload={loadContacts} showToast={showToast} setView={setView} />
        )}
        {view === 'followups' && (
          <FollowUpsView contacts={contacts} loading={loading} openContact={openContact} />
        )}
        {view === 'analytics' && <AnalyticsView />}
        {view === 'workflow' && (
          <WorkflowView
            contacts={contacts}
            openContact={openContact}
            reload={loadContacts}
            showToast={showToast}
          />
        )}
      </main>
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 32,
            right: 32,
            background: toast.type === 'error' ? 'var(--color-danger-bg)' : 'var(--color-success-bg)',
            color: toast.type === 'error' ? 'var(--color-danger)' : 'var(--color-success)',
            border: `1px solid ${toast.type === 'error' ? 'var(--color-danger)' : 'var(--color-success)'}`,
            padding: '14px 20px',
            borderRadius: 'var(--radius-md)',
            fontSize: 14,
            fontWeight: 500,
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            zIndex: 1000,
          }}
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}
